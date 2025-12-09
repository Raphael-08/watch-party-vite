import { useEffect, useRef, useState, useCallback } from 'react';
import { useRoom } from '../room/RoomContext';
import { WSEventTypes } from '@/types/messages';
import type {
  User,
  WebRTCOfferBroadcastPayload,
  WebRTCAnswerBroadcastPayload,
  WebRTCICECandidateBroadcastPayload,
  ServerMessage,
} from '@/types/messages';

/**
 * WebRTC Configuration with multiple STUN/TURN servers
 * Uses Perfect Negotiation pattern as per MDN recommendation
 * https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
 */
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    // STUN servers for NAT discovery
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // Primary TURN server with TCP/TLS fallbacks
    {
      urls: [
        'turn:relay1.expressturn.com:3478',
        'turn:relay1.expressturn.com:80?transport=tcp',
        'turns:relay1.expressturn.com:443?transport=tcp',
      ],
      username: 'efPU52K4SLOQ34W2QY',
      credential: '1TJPNFxHKXr7feIz',
    },
    // Fallback TURN server
    {
      urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443'],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceCandidatePoolSize: 0,
  iceTransportPolicy: 'all',
};

/**
 * useWebRTC - Hook for managing WebRTC peer-to-peer video connection
 *
 * Implements Perfect Negotiation pattern for robust WebRTC connections:
 * - Automatic ICE restart on connection failure
 * - Glare-free offer/answer negotiation
 * - Polite/impolite peer roles for collision handling
 * - Connection recovery and reconnection
 *
 * Reference: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
 */
export function useWebRTC() {
  const { roomId, userId, wsClient, users } = useRoom();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Perfect Negotiation state variables
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const isSettingRemoteAnswerPendingRef = useRef(false);
  const politeRef = useRef(false); // Will be set based on userId comparison
  const currentIceGenerationRef = useRef(0); // Track ICE generation to filter stale candidates

  // Get partner user ID (the other user in the room)
  // Use findLast to get the most recent partner (avoiding ghost users)
  const partnerId = users.findLast((u: User) => u.userId !== userId)?.userId;

  // Debug logging for partner detection
  useEffect(() => {
    console.log('[WebRTC] Users in room:', users.map(u => ({ userId: u.userId, username: u.username })));
    console.log('[WebRTC] Current userId:', userId);
    console.log('[WebRTC] Partner userId:', partnerId);
    console.log('[WebRTC] hasPartner:', !!partnerId);
  }, [users, userId, partnerId]);

  /**
   * Initialize local media stream (camera + microphone)
   */
  const initializeLocalStream = useCallback(async () => {
    try {
      console.log('[WebRTC] Requesting media access...');
      
      // Try with specific constraints first
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch (firstErr) {
        console.warn('[WebRTC] Failed with specific constraints, trying basic constraints:', firstErr);
        try {
          // Fallback to basic constraints
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        } catch (secondErr) {
          console.warn('[WebRTC] Failed with video, trying audio-only mode:', secondErr);
          // Final fallback: audio-only (for testing on same computer)
          stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true,
          });
          console.log('[WebRTC] Running in audio-only mode (camera not available)');
        }
      }
      
      console.log('[WebRTC] Media access granted:', {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
      });
      
      setLocalStream(stream);
      return stream;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to access camera/microphone';
      setError(errorMsg);
      console.error('[WebRTC] Failed to get local stream:', err);
      
      // Provide user-friendly error messages
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          setError('Camera/microphone access denied. Please allow permissions and refresh.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera or microphone found.');
        } else if (err.name === 'NotReadableError') {
          setError('Camera is already in use by another application.');
        }
      }
      
      throw err;
    }
  }, []);

  /**
   * Create and configure RTCPeerConnection with Perfect Negotiation
   */
  const createPeerConnection = useCallback((stream: MediaStream) => {
    console.log('[WebRTC] Creating new RTCPeerConnection');
    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionRef.current = pc;

    // Add local tracks to peer connection
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote track');
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        setIsConnected(true);
        setIsConnecting(false);
      }
    };

    // Perfect Negotiation: Handle negotiation needed
    pc.onnegotiationneeded = async () => {
      try {
        console.log('[WebRTC] Negotiation needed - signaling state:', pc.signalingState);

        // Don't start new negotiation if already in progress
        if (pc.signalingState !== 'stable') {
          console.log('[WebRTC] Skipping negotiation - signaling state not stable:', pc.signalingState);
          return;
        }

        makingOfferRef.current = true;

        // Auto-generates offer when in stable state
        await pc.setLocalDescription();

        console.log('[WebRTC] Sending offer:', pc.localDescription?.type);
        if (wsClient && partnerId) {
          wsClient.send(WSEventTypes.WEBRTC_OFFER, {
            roomId,
            userId,
            offer: pc.localDescription,
          });
        }
      } catch (err) {
        console.error('[WebRTC] Failed during negotiation:', err);
      } finally {
        makingOfferRef.current = false;
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && wsClient && partnerId) {
        wsClient.send(WSEventTypes.WEBRTC_ICE_CANDIDATE, {
          roomId,
          userId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Handle connection state changes with automatic ICE restart
    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);

      switch (pc.connectionState) {
        case 'connected':
          console.log('[WebRTC] ✅ Connection established successfully');
          setIsConnected(true);
          setIsConnecting(false);
          setError(null);
          break;

        case 'disconnected':
          console.log('[WebRTC] ⚠️ Connection disconnected, attempting recovery...');
          setIsConnected(false);
          // Don't trigger ICE restart yet, wait to see if it recovers
          break;

        case 'failed':
          console.error('[WebRTC] ❌ Connection failed, triggering ICE restart...');
          setIsConnected(false);
          setError('Connection lost. Reconnecting...');

          // Automatic ICE restart on failure
          try {
            pc.restartIce();
            console.log('[WebRTC] ICE restart triggered - renegotiation will happen automatically');
          } catch (err) {
            console.error('[WebRTC] ICE restart failed:', err);
            setError('Reconnection failed. Please try manual reconnect.');
          }
          break;

        case 'closed':
          console.log('[WebRTC] Connection closed');
          setIsConnected(false);
          setIsConnecting(false);
          break;
      }
    };

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);

      switch (pc.iceConnectionState) {
        case 'checking':
          console.log('[WebRTC] Checking ICE candidates...');
          break;

        case 'connected':
        case 'completed':
          console.log('[WebRTC] ✅ ICE connection established');
          break;

        case 'disconnected':
          console.warn('[WebRTC] ⚠️ ICE connection disconnected');
          break;

        case 'failed':
          console.error('[WebRTC] ❌ ICE connection failed - TURN server may be needed');
          break;

        case 'closed':
          console.log('[WebRTC] ICE connection closed');
          break;
      }
    };

    // Handle ICE gathering state
    pc.onicegatheringstatechange = () => {
      console.log('[WebRTC] ICE gathering state:', pc.iceGatheringState);
    };

    return pc;
  }, [roomId, userId, wsClient, partnerId]);

  /**
   * Start WebRTC connection using Perfect Negotiation
   * Both peers run identical code - no initiator/responder distinction
   */
  const startConnection = useCallback(async () => {
    if (!wsClient || !partnerId) {
      console.log('[WebRTC] Cannot start - wsClient:', !!wsClient, 'partnerId:', partnerId);
      return;
    }

    // Determine politeness: lower userId is polite peer
    const isPolite = userId < partnerId;
    politeRef.current = isPolite;
    console.log('[WebRTC] Perfect Negotiation - userId:', userId, 'partnerId:', partnerId, 'isPolite:', isPolite);

    try {
      setIsConnecting(true);
      setError(null);

      // Get local stream
      const stream = await initializeLocalStream();

      // Create peer connection (this will automatically trigger negotiationneeded)
      createPeerConnection(stream);

      console.log('[WebRTC] Peer connection created, waiting for negotiation...');
    } catch (err) {
      console.error('[WebRTC] Failed to start connection:', err);
      setIsConnecting(false);
      setError(err instanceof Error ? err.message : 'Failed to start connection');
    }
  }, [wsClient, partnerId, roomId, userId, initializeLocalStream, createPeerConnection]);

  /**
   * Handle incoming signaling message (Perfect Negotiation pattern)
   * Handles both offers and answers with glare resolution
   */
  const handleSignalingMessage = useCallback(async (description: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.log('[WebRTC] ⚠️ No peer connection, cannot handle signaling message');
      return;
    }

    try {
      // Perfect Negotiation: Detect glare condition
      const readyForOffer =
        !makingOfferRef.current &&
        (pc.signalingState === 'stable' || isSettingRemoteAnswerPendingRef.current);

      const offerCollision = description.type === 'offer' && !readyForOffer;

      // Determine if we should ignore this offer (impolite peer ignores collisions)
      const isPolite = politeRef.current;
      ignoreOfferRef.current = !isPolite && offerCollision;

      if (ignoreOfferRef.current) {
        console.log('[WebRTC] 🚫 Impolite peer ignoring colliding offer');
        return;
      }

      // Track if we're setting an answer (for glare detection)
      isSettingRemoteAnswerPendingRef.current = description.type === 'answer';

      console.log('[WebRTC] 📨 Processing', description.type, '- polite:', isPolite, 'collision:', offerCollision);

      // Increment ICE generation counter when setting new remote description
      // This marks all future ICE candidates as belonging to this negotiation
      if (description.type === 'offer' || description.type === 'answer') {
        currentIceGenerationRef.current++;
        console.log('[WebRTC] ICE generation:', currentIceGenerationRef.current);
      }

      // Set remote description
      await pc.setRemoteDescription(description);

      isSettingRemoteAnswerPendingRef.current = false;

      // If it was an offer, automatically create and send answer
      if (description.type === 'offer') {
        console.log('[WebRTC] Received offer, creating answer...');

        // Auto-generates answer
        await pc.setLocalDescription();

        console.log('[WebRTC] Sending answer to partner');
        if (wsClient) {
          wsClient.send(WSEventTypes.WEBRTC_ANSWER, {
            roomId,
            userId,
            answer: pc.localDescription,
          });
        }
      }
    } catch (err) {
      console.error('[WebRTC] ❌ Failed to handle signaling message:', err);
      setError(err instanceof Error ? err.message : 'Failed to handle signaling');
    }
  }, [wsClient, roomId, userId]);

  /**
   * Handle incoming ICE candidate (Perfect Negotiation)
   */
  const handleICECandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      // Ignore errors if we ignored the offer this candidate belongs to
      if (!ignoreOfferRef.current) {
        console.error('[WebRTC] Failed to add ICE candidate:', err);
      }
    }
  }, []);

  /**
   * Stop WebRTC connection and clean up resources
   */
  const stopConnection = useCallback(() => {
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop local stream tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    // Clear remote stream
    setRemoteStream(null);
    setIsConnected(false);
    setIsConnecting(false);

    // Reset Perfect Negotiation state
    makingOfferRef.current = false;
    ignoreOfferRef.current = false;
    isSettingRemoteAnswerPendingRef.current = false;
  }, [localStream]);

  // Subscribe to WebRTC signaling messages (Perfect Negotiation)
  useEffect(() => {
    if (!wsClient) return;

    console.log('[WebRTC] Setting up Perfect Negotiation message listeners');

    const unsubscribe = wsClient.onMessage((message: ServerMessage) => {
      switch (message.type) {
        case WSEventTypes.WEBRTC_OFFER_BROADCAST: {
          const payload = message.payload as WebRTCOfferBroadcastPayload;
          if (payload.userId !== userId) {
            console.log('[WebRTC] 📨 Received offer from partner');
            handleSignalingMessage(payload.offer);
          }
          break;
        }

        case WSEventTypes.WEBRTC_ANSWER_BROADCAST: {
          const payload = message.payload as WebRTCAnswerBroadcastPayload;
          if (payload.userId !== userId) {
            console.log('[WebRTC] 📨 Received answer from partner');
            handleSignalingMessage(payload.answer);
          }
          break;
        }

        case WSEventTypes.WEBRTC_ICE_CANDIDATE_BROADCAST: {
          const payload = message.payload as WebRTCICECandidateBroadcastPayload;
          if (payload.userId !== userId) {
            handleICECandidate(payload.candidate);
          }
          break;
        }
      }
    });

    return unsubscribe;
  }, [wsClient, userId, handleSignalingMessage, handleICECandidate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopConnection();
    };
  }, [stopConnection]);

  return {
    localStream,
    remoteStream,
    isConnecting,
    isConnected,
    error,
    startConnection,
    stopConnection,
    hasPartner: !!partnerId,
  };
}

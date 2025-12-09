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
 * IMPROVED Configuration for WebRTC connection with multiple TURN servers
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
  iceCandidatePoolSize: 0, // Don't pre-gather ICE candidates
  iceTransportPolicy: 'all',
};

/**
 * useWebRTC - Hook for managing WebRTC peer-to-peer video connection
 *
 * Handles:
 * - RTCPeerConnection lifecycle
 * - WebRTC signaling via WebSocket
 * - Local/remote media stream management
 * - ICE candidate exchange
 * - Offer/Answer negotiation
 */
export function useWebRTC() {
  const { roomId, userId, wsClient, users } = useRoom();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const isInitiatorRef = useRef(false);

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
   * Create and configure RTCPeerConnection
   */
  const createPeerConnection = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionRef.current = pc;

    // Add local tracks to peer connection
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // Handle remote stream
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        setIsConnected(true);
        setIsConnecting(false);
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

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
      } else if (pc.connectionState === 'disconnected') {
        setIsConnected(false);
        console.log('[WebRTC] Connection disconnected, waiting for recovery...');
      } else if (pc.connectionState === 'failed') {
        setIsConnected(false);
        setIsConnecting(false);
        setError('Connection failed. Click reconnect.');
        console.error('[WebRTC] Connection failed - ICE connection may need restart');
      }
    };

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        console.error('[WebRTC] ICE connection failed - may need TURN servers for NAT traversal');
        setError('Connection failed. Network issues or firewall blocking.');
      } else if (pc.iceConnectionState === 'disconnected') {
        console.warn('[WebRTC] ICE connection disconnected');
      } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        console.log('[WebRTC] ICE connection established');
      }
    };

    return pc;
  }, [roomId, userId, wsClient, partnerId]);

  /**
   * Start WebRTC connection as initiator (creates offer)
   */
  const startConnection = useCallback(async () => {
    if (!wsClient || !partnerId) {
      console.log('[WebRTC] Cannot start - wsClient:', !!wsClient, 'partnerId:', partnerId);
      return;
    }

    // Only initiate if our userId is "greater" than partner's (deterministic initiator)
    const shouldInitiate = userId > partnerId;
    console.log('[WebRTC] Connection check - userId:', userId, 'partnerId:', partnerId, 'shouldInitiate:', shouldInitiate);
    
    if (!shouldInitiate) {
      console.log('[WebRTC] Waiting for partner to initiate connection (this user will receive offer)');
      // Still need to initialize local stream for when we receive offer
      setIsConnecting(true);
      await initializeLocalStream();
      return;
    }

    console.log('[WebRTC] This user is the initiator - creating and sending offer');
    try {
      setIsConnecting(true);
      setError(null);
      isInitiatorRef.current = true;

      // Get local stream
      const stream = await initializeLocalStream();

      // Create peer connection
      const pc = createPeerConnection(stream);

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log('[WebRTC] Sending offer to partner via Socket.IO');
      wsClient.send(WSEventTypes.WEBRTC_OFFER, {
        roomId,
        userId,
        offer: offer,
      });
      console.log('[WebRTC] Offer sent successfully');
    } catch (err) {
      console.error('[WebRTC] Failed to start connection:', err);
      setIsConnecting(false);
      setError(err instanceof Error ? err.message : 'Failed to start connection');
    }
  }, [wsClient, partnerId, roomId, userId, initializeLocalStream, createPeerConnection]);

  /**
   * Handle incoming WebRTC offer
   */
  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    console.log('[WebRTC] ✅ Received offer from partner:', offer);
    if (!wsClient) {
      console.log('[WebRTC] ❌ Cannot handle offer - no wsClient');
      return;
    }
    if (isInitiatorRef.current) {
      console.log('[WebRTC] ⚠️ Ignoring offer - this user is the initiator');
      return;
    }

    try {
      console.log('[WebRTC] 📞 Preparing to answer offer...');
      setIsConnecting(true);
      setError(null);

      // Get local stream if not already available
      let stream = localStream;
      if (!stream) {
        console.log('[WebRTC] Getting local stream for answer...');
        stream = await initializeLocalStream();
      }

      // Create peer connection if not exists
      let pc = peerConnectionRef.current;
      if (!pc) {
        console.log('[WebRTC] Creating peer connection for answer...');
        pc = createPeerConnection(stream);
      }

      // Set remote description
      console.log('[WebRTC] Setting remote description (offer)...');
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Create and send answer
      console.log('[WebRTC] Creating answer...');
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log('[WebRTC] Sending answer to partner via Socket.IO');
      wsClient.send(WSEventTypes.WEBRTC_ANSWER, {
        roomId,
        userId,
        answer: answer,
      });
      console.log('[WebRTC] ✅ Answer sent successfully');
    } catch (err) {
      console.error('[WebRTC] ❌ Failed to handle offer:', err);
      setIsConnecting(false);
      setError(err instanceof Error ? err.message : 'Failed to handle offer');
    }
  }, [wsClient, localStream, roomId, userId, initializeLocalStream, createPeerConnection]);

  /**
   * Handle incoming WebRTC answer
   */
  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    console.log('[WebRTC] ✅ Received answer from partner:', answer);
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.log('[WebRTC] ❌ Cannot handle answer - no peer connection');
      return;
    }
    if (!isInitiatorRef.current) {
      console.log('[WebRTC] ⚠️ Ignoring answer - this user is not the initiator');
      return;
    }

    try {
      console.log('[WebRTC] Setting remote description (answer)...');
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('[WebRTC] ✅ Remote description set - connection should establish now');
    } catch (err) {
      console.error('[WebRTC] ❌ Failed to handle answer:', err);
      setError(err instanceof Error ? err.message : 'Failed to handle answer');
    }
  }, []);

  /**
   * Handle incoming ICE candidate
   */
  const handleICECandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('[WebRTC] Failed to add ICE candidate:', err);
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
    isInitiatorRef.current = false;
  }, [localStream]);

  // Subscribe to WebRTC signaling messages
  useEffect(() => {
    if (!wsClient) return;

    console.log('[WebRTC] Setting up message listeners for signaling events');

    const unsubscribe = wsClient.onMessage((message: ServerMessage) => {
      switch (message.type) {
        case WSEventTypes.WEBRTC_OFFER_BROADCAST: {
          const payload = message.payload as WebRTCOfferBroadcastPayload;
          console.log('[WebRTC] 📨 Received WEBRTC_OFFER_BROADCAST from userId:', payload.userId);
          if (payload.userId !== userId) {
            console.log('[WebRTC] Offer is from partner, handling...');
            handleOffer(payload.offer);
          } else {
            console.log('[WebRTC] Offer is from self, ignoring');
          }
          break;
        }

        case WSEventTypes.WEBRTC_ANSWER_BROADCAST: {
          const payload = message.payload as WebRTCAnswerBroadcastPayload;
          console.log('[WebRTC] 📨 Received WEBRTC_ANSWER_BROADCAST from userId:', payload.userId);
          if (payload.userId !== userId) {
            console.log('[WebRTC] Answer is from partner, handling...');
            handleAnswer(payload.answer);
          } else {
            console.log('[WebRTC] Answer is from self, ignoring');
          }
          break;
        }

        case WSEventTypes.WEBRTC_ICE_CANDIDATE_BROADCAST: {
          const payload = message.payload as WebRTCICECandidateBroadcastPayload;
          if (payload.userId !== userId) {
            console.log('[WebRTC] 📨 Received ICE candidate from partner');
            handleICECandidate(payload.candidate);
          }
          break;
        }
      }
    });

    return unsubscribe;
  }, [wsClient, userId, handleOffer, handleAnswer, handleICECandidate]);

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

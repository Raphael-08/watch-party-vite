import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRoom } from '../room/RoomContext';
import { WSEventTypes } from '@/types/messages';
import type {
  WebRTCAnswerPayload,
  WebRTCICECandidatePayload,
  ServerMessage,
} from '@/types/messages';

/**
 * IMPROVED WebRTC Configuration with multiple TURN servers
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
  iceTransportPolicy: 'all', // Use all available candidates
};

/**
 * Connection state constants for better state management
 */
const ConnectionState = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  DISCONNECTED: 'disconnected',
  FAILED: 'failed',
} as const;

type ConnectionStateType = typeof ConnectionState[keyof typeof ConnectionState];

/**
 * IMPROVED useWebRTC Hook with Robustness Enhancements
 *
 * Key improvements:
 * 1. Wait for ICE gathering before sending offer
 * 2. Automatic ICE restart on disconnection
 * 3. Connection quality monitoring
 * 4. Exponential backoff for reconnection
 * 5. Perfect Negotiation pattern for glare handling
 * 6. Connection state machine
 */
export function useWebRTC() {
  const { roomId, userId, wsClient, users } = useRoom();

  // Media streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [remoteStreamVersion, setRemoteStreamVersion] = useState(0); // Force re-render on track changes

  // Connection state
  const [connectionState, setConnectionState] = useState<ConnectionStateType>(ConnectionState.IDLE);
  const [error, setError] = useState<string | null>(null);

  // Media control - REDESIGN: Audio always on, video optional
  const [hasVideoTrack, setHasVideoTrack] = useState(false); // Video starts OFF
  const [isAudioMuted, setIsAudioMuted] = useState(false); // Audio starts unmuted

  // Connection quality stats
  const [connectionStats, setConnectionStats] = useState<{
    rtt?: number;
    packetsLost?: number;
    jitter?: number;
    bytesReceived?: number;
  }>({});

  // Refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const iceCandidateBufferRef = useRef<RTCIceCandidateInit[]>([]);
  const isNegotiatingRef = useRef(false);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const isPolitePeerRef = useRef(true); // Client is always polite in SFU
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const connectionAttemptedRef = useRef(false);
  const messageHandlersSetupRef = useRef(false);

  const MAX_ICE_CANDIDATES = 50;

  // Get partners
  const partners = users.filter((u) => u.userId !== userId);
  const hasPartners = partners.length > 0;

  /**
   * IMPROVEMENT: Wait for ICE gathering to complete
   */
  const waitForIceGathering = useCallback((pc: RTCPeerConnection, timeoutMs = 5000): Promise<void> => {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        console.log('[WebRTC-SFU] ICE gathering already complete');
        resolve();
        return;
      }

      console.log('[WebRTC-SFU] Waiting for ICE gathering to complete...');
      const startTime = Date.now();

      const checkState = () => {
        const elapsed = Date.now() - startTime;
        console.log(`[WebRTC-SFU] ICE gathering state: ${pc.iceGatheringState} (${elapsed}ms elapsed)`);

        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', checkState);
          console.log(`[WebRTC-SFU] ✅ ICE gathering complete in ${elapsed}ms`);
          resolve();
        }
      };

      pc.addEventListener('icegatheringstatechange', checkState);

      // Timeout fallback
      setTimeout(() => {
        if (pc.iceGatheringState !== 'complete') {
          pc.removeEventListener('icegatheringstatechange', checkState);
          console.warn(`[WebRTC-SFU] ⚠️ ICE gathering timeout after ${timeoutMs}ms - proceeding anyway`);
          resolve();
        }
      }, timeoutMs);
    });
  }, []);

  /**
   * IMPROVEMENT: Exponential backoff for reconnection
   */
  const reconnectWithBackoff = useCallback(async () => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.error('[WebRTC-SFU] Max reconnect attempts reached');
      setConnectionState(ConnectionState.FAILED);
      setError('Connection failed after multiple attempts. Please refresh.');
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 16000);
    reconnectAttemptsRef.current++;

    console.log(`[WebRTC-SFU] 🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);

    setConnectionState(ConnectionState.RECONNECTING);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await startConnection();
    } catch (err) {
      console.error('[WebRTC-SFU] Reconnect failed:', err);
      reconnectWithBackoff(); // Retry with longer delay
    }
  }, []);

  /**
   * IMPROVEMENT: ICE restart for connection recovery
   */
  const attemptIceRestart = useCallback(async (pc: RTCPeerConnection) => {
    if (!pc || pc.connectionState === 'closed' || !wsClient) return;

    console.log('[WebRTC-SFU] 🔄 Attempting ICE restart...');
    setConnectionState(ConnectionState.RECONNECTING);

    try {
      // Create offer with iceRestart flag
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);

      // Wait for new ICE candidates
      await waitForIceGathering(pc);

      // Send restart offer to server
      wsClient.send(WSEventTypes.WEBRTC_OFFER, {
        roomId,
        userId,
        offer: pc.localDescription,
      });

      console.log('[WebRTC-SFU] ✅ ICE restart offer sent');
    } catch (err) {
      console.error('[WebRTC-SFU] ❌ ICE restart failed:', err);
      // Fall back to full reconnection
      reconnectWithBackoff();
    }
  }, [wsClient, roomId, userId, waitForIceGathering, reconnectWithBackoff]);

  /**
   * Initialize local media stream - AUDIO ONLY by default
   * Video will be added later via enableVideo()
   */
  const initializeLocalStream = useCallback(async () => {
    try {
      console.log('[WebRTC-SFU] Requesting AUDIO-ONLY access...');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false, // REDESIGN: Start with audio only
      });

      console.log('[WebRTC-SFU] ✅ Audio access granted:', {
        video: stream.getVideoTracks().length,
        audio: stream.getAudioTracks().length,
      });

      setLocalStream(stream);
      return stream;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to access media';
      setError(errorMsg);
      console.error('[WebRTC-SFU] Failed to get local stream:', err);

      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          setError('Microphone access denied. Please allow permissions.');
        } else if (err.name === 'NotFoundError') {
          setError('No microphone found.');
        } else if (err.name === 'NotReadableError') {
          setError('Microphone is already in use by another application.');
        }
      }

      throw err;
    }
  }, []);

  /**
   * IMPROVEMENT: Enhanced peer connection with better state handling
   */
  const createPeerConnection = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionRef.current = pc;

    // Add local tracks
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
      console.log('[WebRTC-SFU] Added local track:', track.kind);
    });

    // Handle remote tracks
    pc.ontrack = (event) => {
      console.log('[WebRTC-SFU] 🎥 Received remote track:', event.track.kind, 'streamId:', event.streams[0]?.id);

      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        const streamId = stream.id;

        // Track ended handler
        event.track.onended = () => {
          console.log(`[WebRTC-SFU] 🔴 Track ended: ${event.track.kind} from stream ${streamId}`);
          const activeTracks = stream.getTracks().filter(t => t.readyState === 'live');
          if (activeTracks.length === 0) {
            console.log(`[WebRTC-SFU] Removing stream ${streamId} (no active tracks)`);
            setRemoteStreams((prev) => {
              const newStreams = new Map(prev);
              newStreams.delete(streamId);
              return newStreams;
            });
            // CRITICAL: Force React re-render when stream is removed
            setRemoteStreamVersion(v => v + 1);
          } else {
            // Track removed but stream still has other tracks - still need to update
            console.log(`[WebRTC-SFU] Track removed but stream has ${activeTracks.length} active tracks remaining`);
            setRemoteStreamVersion(v => v + 1);
          }
        };

        // Force update even if stream ID is the same (track might have changed)
        setRemoteStreams((prev) => {
          const newStreams = new Map(prev);
          const existingStream = newStreams.get(streamId);

          let streamToUse = stream;

          if (existingStream) {
            console.log(`[WebRTC-SFU] Updating existing stream ${streamId} with new track ${event.track.kind}`);
            // Remove old track of the same kind
            const existingTracks = existingStream.getTracks().filter(t => t.kind === event.track.kind);
            existingTracks.forEach(t => {
              existingStream.removeTrack(t);
              console.log(`[WebRTC-SFU] Removed old ${t.kind} track`);
            });
            // Add new track
            existingStream.addTrack(event.track);
            console.log(`[WebRTC-SFU] Added new ${event.track.kind} track to stream`);
            streamToUse = existingStream; // CRITICAL: Use the modified existing stream

            // CRITICAL: Force React re-render by incrementing version
            setRemoteStreamVersion(v => v + 1);
          }

          newStreams.set(streamId, streamToUse);
          console.log('[WebRTC-SFU] Remote streams:', newStreams.size, 'tracks:', streamToUse.getTracks().length);
          return newStreams;
        });

        setConnectionState(ConnectionState.CONNECTED);
      }
    };

    // ICE candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate && wsClient) {
        console.log('[WebRTC-SFU] 📤 Sending ICE candidate');
        wsClient.send(WSEventTypes.WEBRTC_ICE_CANDIDATE, {
          roomId,
          userId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // IMPROVEMENT: Enhanced connection state handling
    pc.onconnectionstatechange = () => {
      console.log('[WebRTC-SFU] Connection state:', pc.connectionState);

      switch (pc.connectionState) {
        case 'connected':
          setConnectionState(ConnectionState.CONNECTED);
          setError(null);
          reconnectAttemptsRef.current = 0; // Reset on success
          break;

        case 'disconnected':
          setConnectionState(ConnectionState.DISCONNECTED);
          console.log('[WebRTC-SFU] Connection disconnected, attempting recovery...');
          // Wait 2 seconds before attempting ICE restart
          setTimeout(() => {
            if (pc.connectionState === 'disconnected') {
              attemptIceRestart(pc);
            }
          }, 2000);
          break;

        case 'failed':
          setConnectionState(ConnectionState.FAILED);
          setError('Connection failed. Reconnecting...');
          console.error('[WebRTC-SFU] Connection failed');
          reconnectWithBackoff();
          break;

        case 'closed':
          setConnectionState(ConnectionState.IDLE);
          break;
      }
    };

    // ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC-SFU] ICE connection state:', pc.iceConnectionState);

      if (pc.iceConnectionState === 'failed') {
        console.error('[WebRTC-SFU] ICE connection failed - attempting recovery');
        attemptIceRestart(pc);
      }
    };

    // CRITICAL: Handle renegotiation (tracks added/removed)
    pc.onnegotiationneeded = async () => {
      try {
        if (makingOfferRef.current) {
          console.log('[WebRTC-SFU] Already making offer, skipping negotiation');
          return;
        }

        console.log('[WebRTC-SFU] 🔄 Negotiation needed - creating new offer');
        makingOfferRef.current = true;

        // CRITICAL: Clear old ICE candidates when starting new negotiation
        // This prevents stale candidates from being added after camera toggle
        console.log('[WebRTC-SFU] 🧹 Clearing ICE candidate buffer for new negotiation');
        iceCandidateBufferRef.current = [];

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Wait for ICE gathering
        await waitForIceGathering(pc);

        makingOfferRef.current = false;

        if (wsClient) {
          wsClient.send(WSEventTypes.WEBRTC_OFFER, {
            roomId,
            userId,
            offer: pc.localDescription,
          });
          console.log('[WebRTC-SFU] ✅ Renegotiation offer sent');
        }
      } catch (err) {
        makingOfferRef.current = false;
        console.error('[WebRTC-SFU] ❌ Negotiation failed:', err);
      }
    };

    return pc;
  }, [roomId, userId, wsClient, attemptIceRestart, reconnectWithBackoff, waitForIceGathering]);

  /**
   * Cleanup connection
   */
  const cleanupConnection = useCallback((keepLocalStream = false) => {
    console.log('[WebRTC-SFU] 🧹 Cleaning up connection... (keepLocalStream:', keepLocalStream, ')');

    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
        console.log('[WebRTC-SFU] ✅ Peer connection closed');
      } catch (err) {
        console.error('[WebRTC-SFU] Error closing peer connection:', err);
      }
      peerConnectionRef.current = null;
    }

    iceCandidateBufferRef.current = [];
    isNegotiatingRef.current = false;
    makingOfferRef.current = false;
    ignoreOfferRef.current = false;

    setRemoteStreams(new Map());
    setConnectionState(ConnectionState.IDLE);
    setError(null);

    // Optionally stop local media tracks
    if (!keepLocalStream && localStream) {
      console.log('[WebRTC-SFU] Stopping local media tracks');
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
  }, [localStream]);

  /**
   * IMPROVEMENT: Start connection with ICE gathering wait
   * Reuses existing local stream for reconnection robustness
   */
  const startConnection = useCallback(async () => {
    if (!wsClient) {
      console.log('[WebRTC-SFU] Cannot start - no wsClient');
      return;
    }

    connectionAttemptedRef.current = true;

    if (connectionState === ConnectionState.CONNECTING) {
      console.log('[WebRTC-SFU] Already connecting - ignoring duplicate call');
      return;
    }

    console.log('[WebRTC-SFU] 🚀 Starting connection to SFU');

    // Cleanup existing connection if needed
    if (peerConnectionRef.current) {
      const state = peerConnectionRef.current.connectionState;
      if (state === 'connected') {
        console.log('[WebRTC-SFU] Already connected');
        return;
      }
      if (['disconnected', 'failed', 'closed'].includes(state)) {
        // Keep local stream alive during reconnection
        cleanupConnection(true);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    try {
      setConnectionState(ConnectionState.CONNECTING);
      setError(null);

      // IMPROVEMENT: Reuse existing local stream if available
      let stream = localStream;
      if (!stream || stream.getTracks().length === 0) {
        console.log('[WebRTC-SFU] Getting new local stream');
        stream = await initializeLocalStream();
      } else {
        console.log('[WebRTC-SFU] ♻️ Reusing existing local stream');
        // Verify tracks are still active
        const inactiveTracks = stream.getTracks().filter(t => t.readyState !== 'live');
        if (inactiveTracks.length > 0) {
          console.log('[WebRTC-SFU] Some tracks inactive, getting new stream');
          stream = await initializeLocalStream();
        }
      }

      // Create peer connection
      const pc = createPeerConnection(stream);

      // Create offer
      makingOfferRef.current = true;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // CRITICAL IMPROVEMENT: Wait for ICE gathering
      console.log('[WebRTC-SFU] ⏳ Waiting for ICE gathering...');
      await waitForIceGathering(pc);

      makingOfferRef.current = false;

      // Send complete offer with all ICE candidates
      const finalOffer = pc.localDescription;
      if (!finalOffer) {
        throw new Error('Local description is null after ICE gathering');
      }

      console.log('[WebRTC-SFU] 📤 Sending complete offer to SFU');
      wsClient.send(WSEventTypes.WEBRTC_OFFER, {
        roomId,
        userId,
        offer: finalOffer,
      });

      console.log('[WebRTC-SFU] ✅ Offer sent successfully');
    } catch (err) {
      console.error('[WebRTC-SFU] ❌ Failed to start connection:', err);
      setConnectionState(ConnectionState.FAILED);
      setError(err instanceof Error ? err.message : 'Failed to start connection');
      cleanupConnection();
    }
  }, [
    wsClient,
    roomId,
    userId,
    connectionState,
    localStream,
    initializeLocalStream,
    createPeerConnection,
    cleanupConnection,
    waitForIceGathering,
  ]);

  /**
   * Handle incoming answer from SFU
   */
  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    console.log('[WebRTC-SFU] 📨 Received answer from SFU');

    const pc = peerConnectionRef.current;
    if (!pc) {
      console.error('[WebRTC-SFU] No peer connection');
      return;
    }

    try {
      // CRITICAL: Clear stale ICE candidates before setting answer
      // This prevents ufrag mismatch errors during renegotiation
      console.log('[WebRTC-SFU] 🧹 Clearing stale ICE candidates before processing answer');
      iceCandidateBufferRef.current = [];

      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('[WebRTC-SFU] ✅ Remote description set');

      // Process any NEW ICE candidates that arrived while setting remote description
      if (iceCandidateBufferRef.current.length > 0) {
        console.log(`[WebRTC-SFU] Processing ${iceCandidateBufferRef.current.length} buffered candidates`);
        for (const candidate of iceCandidateBufferRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        iceCandidateBufferRef.current = [];
      }
    } catch (err) {
      console.error('[WebRTC-SFU] Failed to handle answer:', err);
      setError(err instanceof Error ? err.message : 'Failed to handle answer');
    }
  }, []);

  /**
   * IMPROVEMENT: Handle incoming offer with Perfect Negotiation pattern
   */
  const handleIncomingOffer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    console.log('[WebRTC-SFU] 🔄 Handling incoming offer (renegotiation)');

    const pc = peerConnectionRef.current;
    if (!pc) {
      console.error('[WebRTC-SFU] No peer connection');
      return;
    }

    // Perfect Negotiation pattern
    const isPolite = isPolitePeerRef.current;
    const offerCollision =
      offer.type === 'offer' &&
      (makingOfferRef.current || pc.signalingState !== 'stable');

    ignoreOfferRef.current = !isPolite && offerCollision;

    if (ignoreOfferRef.current) {
      console.log('[WebRTC-SFU] 🚫 Ignoring offer (collision, impolite peer)');
      return;
    }

    try {
      // Rollback if needed (polite peer)
      if (offerCollision && isPolite) {
        console.log('[WebRTC-SFU] Rolling back local description');
        await pc.setLocalDescription({ type: 'rollback' });
      }

      // CRITICAL: Clear stale ICE candidates before setting new remote description
      // This prevents ufrag mismatch errors when partner reconnects
      console.log('[WebRTC-SFU] 🧹 Clearing stale ICE candidates before processing new offer');
      iceCandidateBufferRef.current = [];

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Note: Buffer was cleared above, so this won't process stale candidates
      if (iceCandidateBufferRef.current.length > 0) {
        for (const candidate of iceCandidateBufferRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        iceCandidateBufferRef.current = [];
      }

      // Create and send answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (wsClient) {
        wsClient.send(WSEventTypes.WEBRTC_ANSWER, {
          roomId,
          userId,
          answer: answer,
        });
        console.log('[WebRTC-SFU] ✅ Answer sent for renegotiation');
      }
    } catch (err) {
      console.error('[WebRTC-SFU] Failed to handle incoming offer:', err);
    }
  }, [wsClient, roomId, userId]);

  /**
   * Handle ICE candidate
   */
  const handleICECandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;

    if (!pc || !pc.remoteDescription) {
      if (iceCandidateBufferRef.current.length >= MAX_ICE_CANDIDATES) {
        console.warn('[WebRTC-SFU] ICE buffer full, dropping oldest');
        iceCandidateBufferRef.current.shift();
      }
      iceCandidateBufferRef.current.push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('[WebRTC-SFU] ✅ ICE candidate added');
    } catch (err) {
      console.error('[WebRTC-SFU] Failed to add ICE candidate:', err);
    }
  }, []);

  /**
   * Stop connection
   */
  const stopConnection = useCallback(() => {
    console.log('[WebRTC-SFU] Stopping connection');
    cleanupConnection();

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
  }, [localStream, cleanupConnection]);

  /**
   * Manual reconnect
   */
  const reconnect = useCallback(() => {
    console.log('[WebRTC-SFU] 🔄 Manual reconnect');
    cleanupConnection();
    reconnectAttemptsRef.current = 0;
    connectionAttemptedRef.current = false;
    setError(null);
  }, [cleanupConnection]);

  /**
   * Enable video - adds video track to existing audio-only connection
   * REDESIGN: Video is optional, added after audio connection is established
   */
  const enableVideo = useCallback(async () => {
    if (!localStream || !peerConnectionRef.current) {
      console.warn('[WebRTC-SFU] Cannot enable video - no stream or peer connection');
      return;
    }

    if (hasVideoTrack) {
      console.log('[WebRTC-SFU] Video already enabled');
      return;
    }

    const pc = peerConnectionRef.current;
    console.log('[WebRTC-SFU] 📹 Enabling video...');

    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' }
      });
      const videoTrack = videoStream.getVideoTracks()[0];

      // Add video track to peer connection (triggers renegotiation)
      pc.addTrack(videoTrack, localStream);
      console.log('[WebRTC-SFU] ✅ Added video track (triggers renegotiation)');

      // Add to local stream
      localStream.addTrack(videoTrack);

      setHasVideoTrack(true);
      console.log('[WebRTC-SFU] Video enabled - renegotiation will forward to SFU');
    } catch (err) {
      console.error('[WebRTC-SFU] Failed to enable video:', err);
      setError('Failed to start camera. Please check permissions.');
    }
  }, [localStream, hasVideoTrack]);

  /**
   * Disable video - removes video track from connection
   * REDESIGN: Audio continues working, only video is removed
   */
  const disableVideo = useCallback(() => {
    if (!localStream || !peerConnectionRef.current) return;
    if (!hasVideoTrack) {
      console.log('[WebRTC-SFU] Video already disabled');
      return;
    }

    const pc = peerConnectionRef.current;
    console.log('[WebRTC-SFU] 📹 Disabling video...');

    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      // Remove from peer connection (triggers renegotiation)
      const sender = pc.getSenders().find(s => s.track === videoTrack);
      if (sender) {
        pc.removeTrack(sender);
        console.log('[WebRTC-SFU] ✅ Removed video sender (triggers renegotiation)');
      }

      // Stop and remove from local stream
      videoTrack.stop();
      localStream.removeTrack(videoTrack);
    }

    setHasVideoTrack(false);
    console.log('[WebRTC-SFU] Video disabled - audio continues');
  }, [localStream, hasVideoTrack]);

  /**
   * Mute audio - just disables the track, doesn't remove it
   * REDESIGN: Audio track always present, just muted/unmuted
   */
  const muteAudio = useCallback(() => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack) return;

    audioTrack.enabled = false;
    setIsAudioMuted(true);
    console.log('[WebRTC-SFU] 🔇 Audio muted');
  }, [localStream]);

  /**
   * Unmute audio
   */
  const unmuteAudio = useCallback(() => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack) return;

    audioTrack.enabled = true;
    setIsAudioMuted(false);
    console.log('[WebRTC-SFU] 🔊 Audio unmuted');
  }, [localStream]);

  /**
   * Toggle audio mute/unmute
   */
  const toggleAudio = useCallback(() => {
    if (isAudioMuted) {
      unmuteAudio();
    } else {
      muteAudio();
    }
  }, [isAudioMuted, muteAudio, unmuteAudio]);

  /**
   * IMPROVEMENT: Connection quality monitoring
   */
  useEffect(() => {
    if (!peerConnectionRef.current || connectionState !== ConnectionState.CONNECTED) return;

    const pc = peerConnectionRef.current;
    const statsInterval = setInterval(async () => {
      try {
        const stats = await pc.getStats();
        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            setConnectionStats((prev) => ({
              ...prev,
              packetsLost: report.packetsLost,
              jitter: report.jitter,
              bytesReceived: report.bytesReceived,
            }));
          }

          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            const rtt = report.currentRoundTripTime * 1000;
            setConnectionStats((prev) => ({ ...prev, rtt }));

            // Warn on high latency
            if (rtt > 500) {
              console.warn('[WebRTC-SFU] ⚠️ High latency detected:', rtt, 'ms');
            }
          }
        });
      } catch (err) {
        console.error('[WebRTC-SFU] Failed to get stats:', err);
      }
    }, 2000);

    return () => clearInterval(statsInterval);
  }, [connectionState]);

  /**
   * Setup message handlers
   */
  useEffect(() => {
    if (!wsClient) {
      messageHandlersSetupRef.current = false;
      return;
    }

    console.log('[WebRTC-SFU] Setting up message listeners');

    const unsubscribeDisconnect = wsClient.onDisconnect((reason) => {
      console.error('[WebRTC-SFU] WebSocket disconnected:', reason);
      if (peerConnectionRef.current) {
        cleanupConnection(true); // Keep local stream for quick reconnection
        setError('Connection lost. Please rejoin the room.');
      }
    });

    const unsubscribe = wsClient.onMessage((message: ServerMessage) => {
      switch (message.type) {
        case WSEventTypes.WEBRTC_OFFER:
          handleIncomingOffer((message.payload as any).offer);
          break;
        case WSEventTypes.WEBRTC_ANSWER:
          handleAnswer((message.payload as WebRTCAnswerPayload).answer);
          break;
        case WSEventTypes.WEBRTC_ICE_CANDIDATE:
          handleICECandidate((message.payload as WebRTCICECandidatePayload).candidate);
          break;
      }
    });

    messageHandlersSetupRef.current = true;

    return () => {
      messageHandlersSetupRef.current = false;
      unsubscribe();
      unsubscribeDisconnect();
    };
  }, [wsClient, handleAnswer, handleIncomingOffer, handleICECandidate, cleanupConnection]);

  /**
   * IMPROVEMENT: Auto-reconnect when partner rejoins
   */
  useEffect(() => {
    // Only auto-connect if we have partners and local stream is ready
    if (hasPartners && localStream && !peerConnectionRef.current && connectionAttemptedRef.current) {
      console.log('[WebRTC-SFU] 🔄 Partner rejoined - auto-reconnecting...');
      startConnection();
    }
  }, [hasPartners, localStream, startConnection]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      console.log('[WebRTC-SFU] Component unmounting');
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  // First remote stream for backwards compatibility
  const firstRemoteStream = useMemo(() => {
    return remoteStreams.size > 0 ? Array.from(remoteStreams.values())[0] : null;
  }, [remoteStreams, remoteStreamVersion]); // Include version to detect track changes

  return {
    localStream,
    remoteStream: firstRemoteStream,
    remoteStreams,
    connectionState, // Now using enum
    isConnecting: connectionState === ConnectionState.CONNECTING,
    isConnected: connectionState === ConnectionState.CONNECTED,
    error,
    startConnection,
    stopConnection,
    reconnect,
    // REDESIGN: New video control functions
    enableVideo,
    disableVideo,
    hasVideoTrack,
    // REDESIGN: New audio control functions
    muteAudio,
    unmuteAudio,
    toggleAudio, // Kept for convenience
    isAudioMuted,
    hasPartner: hasPartners,
    connectionStats, // NEW: Connection quality stats
  };
}

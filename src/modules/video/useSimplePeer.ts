import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import SimplePeer from 'simple-peer';
import { useRoom } from '../room/RoomContext';
import { WSEventTypes } from '@/types/messages';
import type { ServerMessage, User } from '@/types/messages';

/**
 * SimplePeer Configuration
 * Using the same STUN/TURN servers as before
 */
const PEER_CONFIG: SimplePeer.Options = {
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
  // SimplePeer-specific options
  trickle: true, // Enable trickle ICE
  reconnectTimer: 3000, // Reconnect after 3 seconds
  iceTransportPolicy: 'all', // Use all available candidates
};

/**
 * Connection state for tracking peer status
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
 * Interface for tracking individual peer connections
 */
interface PeerConnection {
  peer: SimplePeer.Instance;
  userId: string;
  username: string;
  stream: MediaStream | null;
  state: ConnectionStateType;
}

/**
 * SimplePeer-based WebRTC Hook for P2P Connections
 *
 * This hook manages full-mesh P2P connections between all users in a room.
 * - Each user connects directly to every other user
 * - User with lower ID acts as initiator
 * - Signals are relayed through WebSocket server
 * - Supports audio-only by default, video on-demand
 */
export function useSimplePeer() {
  const { roomId, userId, wsClient, users } = useRoom();

  // Local media stream
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Remote streams from all peers
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());

  // Connection state
  const [connectionState, setConnectionState] = useState<ConnectionStateType>(ConnectionState.IDLE);
  const [error, setError] = useState<string | null>(null);

  // Media control
  const [hasVideoTrack, setHasVideoTrack] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  // Store peer connections (one per remote user)
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const messageHandlersSetupRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Get partners (all users except current user)
  const partners = users.filter((u) => u.userId !== userId);
  const hasPartners = partners.length > 0;

  /**
   * Initialize local media stream - AUDIO ONLY by default
   */
  const initializeLocalStream = useCallback(async () => {
    try {
      console.log('[SimplePeer] Requesting AUDIO-ONLY access...');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false, // Start with audio only
      });

      console.log('[SimplePeer] ✅ Audio access granted');

      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to access media';
      setError(errorMsg);
      console.error('[SimplePeer] Failed to get local stream:', err);

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
   * Create a SimplePeer instance for a specific user
   */
  const createPeer = useCallback((
    remoteUserId: string,
    remoteUsername: string,
    initiator: boolean,
    stream: MediaStream
  ): SimplePeer.Instance => {
    console.log(`[SimplePeer] Creating peer connection to ${remoteUsername} (${remoteUserId}) - initiator: ${initiator}`);

    const peer = new SimplePeer({
      ...PEER_CONFIG,
      initiator,
      stream, // Pass local stream
      config: {
        iceServers: PEER_CONFIG.iceServers,
      },
    });

    // Handle signal events - send to remote peer via WebSocket
    peer.on('signal', (signal: SimplePeer.SignalData) => {
      console.log(`[SimplePeer] Sending signal to ${remoteUsername}:`, signal.type);

      if (!wsClient) {
        console.error('[SimplePeer] No WebSocket client available');
        return;
      }

      // Broadcast signal to room - server will forward to specific user
      wsClient.send(WSEventTypes.WEBRTC_OFFER_BROADCAST, {
        targetUserId: remoteUserId, // Who this signal is for
        userId, // Who this signal is from
        signal,
      });
    });

    // Handle incoming stream from remote peer
    peer.on('stream', (remoteStream: MediaStream) => {
      console.log(`[SimplePeer] 🎥 Received stream from ${remoteUsername}:`, remoteStream.id);

      // Update remote streams
      setRemoteStreams((prev) => {
        const newStreams = new Map(prev);
        newStreams.set(remoteUserId, remoteStream);
        return newStreams;
      });

      // Update peer state
      const peerConnection = peersRef.current.get(remoteUserId);
      if (peerConnection) {
        peerConnection.stream = remoteStream;
        peerConnection.state = ConnectionState.CONNECTED;
      }

      setConnectionState(ConnectionState.CONNECTED);
    });

    // Handle connection events
    peer.on('connect', () => {
      console.log(`[SimplePeer] ✅ Connected to ${remoteUsername}`);

      const peerConnection = peersRef.current.get(remoteUserId);
      if (peerConnection) {
        peerConnection.state = ConnectionState.CONNECTED;
      }

      setConnectionState(ConnectionState.CONNECTED);
      setError(null);
    });

    // Handle errors
    peer.on('error', (err: Error) => {
      console.error(`[SimplePeer] ❌ Error with ${remoteUsername}:`, err);

      const peerConnection = peersRef.current.get(remoteUserId);
      if (peerConnection) {
        peerConnection.state = ConnectionState.FAILED;
      }

      setError(`Connection error with ${remoteUsername}: ${err.message}`);
    });

    // Handle close events
    peer.on('close', () => {
      console.log(`[SimplePeer] 🔴 Connection closed with ${remoteUsername}`);

      // Remove remote stream
      setRemoteStreams((prev) => {
        const newStreams = new Map(prev);
        newStreams.delete(remoteUserId);
        return newStreams;
      });

      // Remove peer
      peersRef.current.delete(remoteUserId);

      // Update state if no more peers
      if (peersRef.current.size === 0) {
        setConnectionState(ConnectionState.DISCONNECTED);
      }
    });

    // Handle data channel messages (optional)
    peer.on('data', (data: ArrayBuffer) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(data));
        console.log(`[SimplePeer] 📨 Data from ${remoteUsername}:`, message);
      } catch (err) {
        console.error('[SimplePeer] Failed to parse data:', err);
      }
    });

    return peer;
  }, [userId, wsClient]);

  /**
   * Start connections to all peers in the room
   */
  const startConnection = useCallback(async () => {
    if (!wsClient) {
      console.log('[SimplePeer] Cannot start - no wsClient');
      return;
    }

    if (!hasPartners) {
      console.log('[SimplePeer] No partners to connect to');
      return;
    }

    console.log('[SimplePeer] 🚀 Starting connections to', partners.length, 'peer(s)');

    try {
      setConnectionState(ConnectionState.CONNECTING);
      setError(null);

      // Get local stream
      let stream = localStreamRef.current;
      if (!stream || stream.getTracks().length === 0) {
        console.log('[SimplePeer] Getting new local stream');
        stream = await initializeLocalStream();
      } else {
        console.log('[SimplePeer] ♻️ Reusing existing local stream');
      }

      if (!stream) {
        throw new Error('Failed to get local stream');
      }

      // Create peer connection for each partner
      for (const partner of partners) {
        // Skip if peer already exists
        if (peersRef.current.has(partner.userId)) {
          console.log(`[SimplePeer] Peer already exists for ${partner.username}`);
          continue;
        }

        // Determine who is initiator (user with lower ID)
        const initiator = userId < partner.userId;

        // Create peer
        const peer = createPeer(partner.userId, partner.username, initiator, stream);

        // Store peer connection
        peersRef.current.set(partner.userId, {
          peer,
          userId: partner.userId,
          username: partner.username,
          stream: null,
          state: ConnectionState.CONNECTING,
        });
      }

      console.log(`[SimplePeer] ✅ Created ${peersRef.current.size} peer connection(s)`);
    } catch (err) {
      console.error('[SimplePeer] ❌ Failed to start connection:', err);
      setConnectionState(ConnectionState.FAILED);
      setError(err instanceof Error ? err.message : 'Failed to start connection');
    }
  }, [wsClient, hasPartners, partners, userId, initializeLocalStream, createPeer]);

  /**
   * Handle incoming signal from remote peer
   */
  const handleSignal = useCallback((fromUserId: string, signal: SimplePeer.SignalData) => {
    console.log(`[SimplePeer] 📨 Received signal from ${fromUserId}:`, signal.type);

    let peerConnection = peersRef.current.get(fromUserId);

    // If peer doesn't exist yet, create it (non-initiator)
    if (!peerConnection && localStreamRef.current) {
      const partner = users.find(u => u.userId === fromUserId);
      if (!partner) {
        console.error('[SimplePeer] Unknown user:', fromUserId);
        return;
      }

      console.log(`[SimplePeer] Creating peer for incoming connection from ${partner.username}`);

      const initiator = userId < fromUserId;
      const peer = createPeer(fromUserId, partner.username, initiator, localStreamRef.current);

      peerConnection = {
        peer,
        userId: fromUserId,
        username: partner.username,
        stream: null,
        state: ConnectionState.CONNECTING,
      };

      peersRef.current.set(fromUserId, peerConnection);
    }

    // Pass signal to SimplePeer
    if (peerConnection) {
      try {
        peerConnection.peer.signal(signal);
      } catch (err) {
        console.error('[SimplePeer] Failed to process signal:', err);
      }
    } else {
      console.warn('[SimplePeer] No peer connection found for:', fromUserId);
    }
  }, [users, userId, createPeer]);

  /**
   * Stop all connections
   */
  const stopConnection = useCallback(() => {
    console.log('[SimplePeer] Stopping all connections');

    // Destroy all peer connections
    peersRef.current.forEach((peerConnection) => {
      try {
        peerConnection.peer.destroy();
      } catch (err) {
        console.error('[SimplePeer] Error destroying peer:', err);
      }
    });

    peersRef.current.clear();

    // Stop local media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    setLocalStream(null);
    setRemoteStreams(new Map());
    setConnectionState(ConnectionState.IDLE);
    setError(null);
  }, []);

  /**
   * Reconnect to all peers
   */
  const reconnect = useCallback(() => {
    console.log('[SimplePeer] 🔄 Manual reconnect');
    stopConnection();
    startConnection();
  }, [stopConnection, startConnection]);

  /**
   * Enable video - adds video track to all existing connections
   */
  const enableVideo = useCallback(async () => {
    if (!localStreamRef.current) {
      console.warn('[SimplePeer] Cannot enable video - no local stream');
      return;
    }

    if (hasVideoTrack) {
      console.log('[SimplePeer] Video already enabled');
      return;
    }

    console.log('[SimplePeer] 📹 Enabling video...');

    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' }
      });
      const videoTrack = videoStream.getVideoTracks()[0];

      // Add to local stream
      localStreamRef.current.addTrack(videoTrack);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

      // Add track to all peer connections
      peersRef.current.forEach((peerConnection) => {
        try {
          peerConnection.peer.addTrack(videoTrack, localStreamRef.current!);
          console.log(`[SimplePeer] Added video track to peer ${peerConnection.username}`);
        } catch (err) {
          console.error(`[SimplePeer] Failed to add video track to ${peerConnection.username}:`, err);
        }
      });

      setHasVideoTrack(true);
      console.log('[SimplePeer] ✅ Video enabled');
    } catch (err) {
      console.error('[SimplePeer] Failed to enable video:', err);
      setError('Failed to start camera. Please check permissions.');
    }
  }, [hasVideoTrack]);

  /**
   * Disable video - removes video track from all connections
   */
  const disableVideo = useCallback(() => {
    if (!localStreamRef.current || !hasVideoTrack) {
      console.log('[SimplePeer] Video already disabled');
      return;
    }

    console.log('[SimplePeer] 📹 Disabling video...');

    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      // Remove from all peer connections
      peersRef.current.forEach((peerConnection) => {
        try {
          peerConnection.peer.removeTrack(videoTrack, localStreamRef.current!);
          console.log(`[SimplePeer] Removed video track from peer ${peerConnection.username}`);
        } catch (err) {
          console.error(`[SimplePeer] Failed to remove video track from ${peerConnection.username}:`, err);
        }
      });

      // Remove from local stream
      localStreamRef.current.removeTrack(videoTrack);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

      // Stop track
      videoTrack.stop();
    }

    setHasVideoTrack(false);
    console.log('[SimplePeer] ✅ Video disabled');
  }, [hasVideoTrack]);

  /**
   * Mute audio
   */
  const muteAudio = useCallback(() => {
    if (!localStreamRef.current) return;

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (!audioTrack) return;

    audioTrack.enabled = false;
    setIsAudioMuted(true);
    console.log('[SimplePeer] 🔇 Audio muted');
  }, []);

  /**
   * Unmute audio
   */
  const unmuteAudio = useCallback(() => {
    if (!localStreamRef.current) return;

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (!audioTrack) return;

    audioTrack.enabled = true;
    setIsAudioMuted(false);
    console.log('[SimplePeer] 🔊 Audio unmuted');
  }, []);

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
   * Setup message handlers for incoming signals
   */
  useEffect(() => {
    if (!wsClient) {
      messageHandlersSetupRef.current = false;
      return;
    }

    console.log('[SimplePeer] Setting up message listeners');

    const unsubscribeDisconnect = wsClient.onDisconnect((reason) => {
      console.error('[SimplePeer] WebSocket disconnected:', reason);
      setError('Connection lost. Please rejoin the room.');
    });

    const unsubscribe = wsClient.onMessage((message: ServerMessage) => {
      // Handle incoming signals from any peer
      if (message.type === WSEventTypes.WEBRTC_OFFER_BROADCAST) {
        const payload = message.payload as any;
        // Only process if this signal is for us
        if (payload.targetUserId === userId || !payload.targetUserId) {
          handleSignal(payload.userId, payload.signal);
        }
      }
    });

    messageHandlersSetupRef.current = true;

    return () => {
      messageHandlersSetupRef.current = false;
      unsubscribe();
      unsubscribeDisconnect();
    };
  }, [wsClient, userId, handleSignal]);

  /**
   * Handle user join/leave events
   */
  useEffect(() => {
    // When users change, recreate peer connections
    if (!wsClient || !localStreamRef.current) return;

    // Remove peers that left
    const currentUserIds = new Set(partners.map(p => p.userId));
    peersRef.current.forEach((peerConnection, peerId) => {
      if (!currentUserIds.has(peerId)) {
        console.log(`[SimplePeer] User ${peerConnection.username} left - destroying peer`);
        try {
          peerConnection.peer.destroy();
        } catch (err) {
          console.error('[SimplePeer] Error destroying peer:', err);
        }
        peersRef.current.delete(peerId);

        setRemoteStreams((prev) => {
          const newStreams = new Map(prev);
          newStreams.delete(peerId);
          return newStreams;
        });
      }
    });

    // Add peers that joined
    partners.forEach((partner) => {
      if (!peersRef.current.has(partner.userId) && localStreamRef.current) {
        console.log(`[SimplePeer] User ${partner.username} joined - creating peer`);

        const initiator = userId < partner.userId;
        const peer = createPeer(partner.userId, partner.username, initiator, localStreamRef.current);

        peersRef.current.set(partner.userId, {
          peer,
          userId: partner.userId,
          username: partner.username,
          stream: null,
          state: ConnectionState.CONNECTING,
        });
      }
    });
  }, [partners, wsClient, userId, createPeer]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      console.log('[SimplePeer] Component unmounting');
      stopConnection();
    };
  }, [stopConnection]);

  // Get first remote stream for backwards compatibility
  const firstRemoteStream = useMemo(() => {
    return remoteStreams.size > 0 ? Array.from(remoteStreams.values())[0] : null;
  }, [remoteStreams]);

  return {
    localStream,
    remoteStream: firstRemoteStream,
    remoteStreams,
    connectionState,
    isConnecting: connectionState === ConnectionState.CONNECTING,
    isConnected: connectionState === ConnectionState.CONNECTED,
    error,
    startConnection,
    stopConnection,
    reconnect,
    enableVideo,
    disableVideo,
    hasVideoTrack,
    muteAudio,
    unmuteAudio,
    toggleAudio,
    isAudioMuted,
    hasPartner: hasPartners,
    connectionStats: {}, // Not implemented for SimplePeer
  };
}

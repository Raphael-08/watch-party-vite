import { useEffect, useRef, useState, useCallback } from 'react';
import { Video, VideoOff, Mic, MicOff, Maximize2, Minimize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PIPVideoWindowProps {
  onClose?: () => void;
  webrtcControls: ReturnType<typeof import('./useWebRTC').useWebRTC>;
}

/**
 * PIPVideoWindow - Picture-in-Picture draggable video window
 *
 * Features:
 * - Draggable positioning with boundary constraints
 * - Local and remote video display
 * - Video/audio muting controls
 * - Connection status indicator
 * - Minimize/maximize toggle
 * - Glass-morphism styling
 */
export function PIPVideoWindow({ onClose, webrtcControls }: PIPVideoWindowProps) {
  const {
    localStream,
    remoteStream,
    isConnecting,
    isConnected,
    error,
    startConnection,
    stopConnection,
    enableVideo,
    disableVideo,
    hasVideoTrack,
    toggleAudio,
    isAudioMuted,
    hasPartner,
  } = webrtcControls;

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 20, y: 20 });
  const resizeStartSize = useRef({ width: 0, height: 0 });
  const resizeStartPos = useRef({ x: 0, y: 0 });

  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [size, setSize] = useState({ width: 320, height: 320 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showSelfCam, setShowSelfCam] = useState(true);
  const [remoteTrackVersion, setRemoteTrackVersion] = useState(0);

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Monitor remote stream for track changes
  useEffect(() => {
    if (!remoteStream) return;

    const handleTrackAdded = () => {
      console.log('[PIPVideoWindow] Track added to remote stream, forcing refresh');
      setRemoteTrackVersion(v => v + 1);
    };

    const handleTrackRemoved = () => {
      console.log('[PIPVideoWindow] Track removed from remote stream, forcing refresh');
      setRemoteTrackVersion(v => v + 1);
    };

    remoteStream.addEventListener('addtrack', handleTrackAdded);
    remoteStream.addEventListener('removetrack', handleTrackRemoved);

    return () => {
      remoteStream.removeEventListener('addtrack', handleTrackAdded);
      remoteStream.removeEventListener('removetrack', handleTrackRemoved);
    };
  }, [remoteStream]);

  // Attach remote stream to video element and handle track changes
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log('[PIPVideoWindow] Attaching/refreshing remote stream (version:', remoteTrackVersion, ')');
      const videoEl = remoteVideoRef.current;

      // Completely reset the video element
      videoEl.srcObject = null;

      // Small delay to ensure cleanup
      setTimeout(() => {
        videoEl.srcObject = remoteStream;
        videoEl.play().catch(err => {
          console.warn('[PIPVideoWindow] Remote video autoplay prevented:', err);
        });
      }, 10);
    } else if (remoteVideoRef.current && !remoteStream) {
      // Clear video when no stream
      console.log('[PIPVideoWindow] Clearing remote video (no stream)');
      remoteVideoRef.current.srcObject = null;
    }
  }, [remoteStream, remoteTrackVersion]);

  // IMPROVED: Handle partner disconnect/reconnect robustly
  useEffect(() => {
    // Partner left - DON'T stop connection, just wait
    if (!hasPartner && (isConnected || isConnecting)) {
      console.log('[PIPVideoWindow] ⚠️ Partner disconnected - waiting for reconnection...');
      // Connection will auto-recover via WebRTC reconnection logic
      // We keep local stream alive for instant reconnection
    }

    // Partner rejoined - automatically reconnect if not already connected
    if (hasPartner && !isConnected && !isConnecting) {
      console.log('[PIPVideoWindow] ✅ Partner rejoined - auto-reconnecting...');
      startConnection();
    }
  }, [hasPartner, isConnected, isConnecting, startConnection]);

  /**
   * Handle mouse down to start dragging
   */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest('[data-no-drag]')) {
      setIsDragging(true);
      dragStartPos.current = {
        x: e.clientX - currentPos.current.x,
        y: e.clientY - currentPos.current.y,
      };
      e.preventDefault();
    }
  }, []);

  /**
   * Handle mouse down on resize handle
   */
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    resizeStartSize.current = { ...size };
    resizeStartPos.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
    e.stopPropagation();
  }, [size]);

  /**
   * Handle mouse move while dragging
   */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging && containerRef.current) {
      requestAnimationFrame(() => {
        if (!containerRef.current) return;

        const newX = e.clientX - dragStartPos.current.x;
        const newY = e.clientY - dragStartPos.current.y;

        // Get container dimensions
        const rect = containerRef.current.getBoundingClientRect();

        // Calculate boundaries
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;

        // Constrain position within boundaries
        const constrainedX = Math.max(0, Math.min(newX, maxX));
        const constrainedY = Math.max(0, Math.min(newY, maxY));

        currentPos.current = { x: constrainedX, y: constrainedY };

        // Apply transform directly for smoother dragging
        if (containerRef.current) {
          containerRef.current.style.transform = `translate(${constrainedX}px, ${constrainedY}px)`;
        }
      });
    } else if (isResizing) {
      requestAnimationFrame(() => {
        const deltaX = e.clientX - resizeStartPos.current.x;
        const deltaY = e.clientY - resizeStartPos.current.y;

        // Calculate new size (maintain square aspect ratio using larger delta)
        const delta = Math.max(deltaX, deltaY);
        const newSize = Math.max(200, Math.min(600, resizeStartSize.current.width + delta));

        setSize({ width: newSize, height: newSize });
      });
    }
  }, [isDragging, isResizing]);

  /**
   * Handle mouse up to stop dragging/resizing
   */
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      // Update state to match current position for future renders
      setPosition({ ...currentPos.current });
    }
    if (isResizing) {
      setIsResizing(false);
    }
  }, [isDragging, isResizing]);

  // Set up drag/resize event listeners
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  /**
   * Handle close button click
   */
  const handleClose = useCallback(() => {
    stopConnection();
    onClose?.();
  }, [stopConnection, onClose]);

  return (
    <div
      ref={containerRef}
      className={`fixed z-50 glass-morphism rounded-xl shadow-2xl border border-white/10 overflow-hidden ${
        isDragging ? 'cursor-grabbing transition-none' : isResizing ? 'transition-none' : 'cursor-grab transition-all duration-smooth'
      }`}
      style={{
        left: 0,
        top: 0,
        width: isMinimized ? '128px' : `${size.width}px`,
        height: isMinimized ? '40px' : `${size.height}px`,
        transform: `translate(${position.x}px, ${position.y}px)`,
        willChange: isDragging || isResizing ? 'transform' : 'auto',
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Auto-hiding Header - appears on hover */}
      <div 
        className={`absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/60 to-transparent backdrop-blur-sm transition-all duration-300 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
            }`}
          />
          <span className="text-xs font-medium text-white drop-shadow-lg">
            {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
          </span>
        </div>

        <div className="flex items-center gap-1" data-no-drag>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-white/20 text-white"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-white/20 text-white"
            onClick={handleClose}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Video Content */}
      {!isMinimized && (
        <div className="relative w-full h-full bg-black">
          {/* Remote video (primary - full window) */}
          {remoteStream ? (
            <>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              
              {/* Show overlay when partner has no video */}
              {!remoteStream.getVideoTracks().some(t => t.enabled && t.readyState === 'live') && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                  <div className="text-center text-white">
                    <VideoOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Partner's camera is off</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center px-4">
                <VideoOff className="h-8 w-8 text-white/30 mx-auto mb-2" />
                <p className="text-xs text-white/60 mb-3">
                  {!hasPartner
                    ? 'Waiting for partner to join...'
                    : isConnecting
                    ? 'Connecting...'
                    : isConnected
                    ? 'Waiting for partner to connect...'
                    : 'Click Connect to start video call'}
                </p>
                {hasPartner && !isConnected && !isConnecting && (
                  <Button
                    variant="glass"
                    size="sm"
                    onClick={startConnection}
                    className="bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs h-7"
                  >
                    Connect
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Local video (small square in bottom-right) */}
          {localStream && showSelfCam && (
            <div className="absolute bottom-3 right-3 w-20 h-20 rounded-lg overflow-hidden border-2 border-white/30 shadow-xl bg-black">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!hasVideoTrack && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <VideoOff className="h-6 w-6 text-white/50" />
                </div>
              )}
            </div>
          )}

          {/* Auto-hiding Controls - bottom center */}
          <div
            className={`absolute bottom-3 left-1/2 transform -translate-x-1/2 flex items-center gap-2 transition-all duration-300 ${
              showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
            data-no-drag
          >
            <Button
              variant="glass"
              size="sm"
              className={`h-9 w-9 p-0 rounded-full backdrop-blur-md ${
                !hasVideoTrack
                  ? 'bg-gray-500/30 hover:bg-gray-500/40 border-gray-500/50'
                  : 'bg-white/10 hover:bg-white/20 border-white/20'
              } border shadow-lg`}
              onClick={() => hasVideoTrack ? disableVideo() : enableVideo()}
              disabled={!localStream}
              title={hasVideoTrack ? 'Turn off camera' : 'Turn on camera'}
            >
              {!hasVideoTrack ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
            </Button>
            <Button
              variant="glass"
              size="sm"
              className={`h-9 w-9 p-0 rounded-full backdrop-blur-md ${
                isAudioMuted
                  ? 'bg-red-500/30 hover:bg-red-500/40 border-red-500/50'
                  : 'bg-white/10 hover:bg-white/20 border-white/20'
              } border shadow-lg`}
              onClick={toggleAudio}
              disabled={!localStream}
              title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isAudioMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button
              variant="glass"
              size="sm"
              className={`h-9 w-9 p-0 rounded-full backdrop-blur-md ${
                !showSelfCam
                  ? 'bg-gray-500/30 hover:bg-gray-500/40 border-gray-500/50'
                  : 'bg-white/10 hover:bg-white/20 border-white/20'
              } border shadow-lg`}
              onClick={() => setShowSelfCam(!showSelfCam)}
              title={showSelfCam ? 'Hide self camera' : 'Show self camera'}
            >
              {showSelfCam ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </Button>
          </div>

          {/* Error message */}
          {error && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-500/90 text-white px-3 py-2 rounded-lg text-xs max-w-[90%] text-center shadow-xl">
              {error}
            </div>
          )}

          {/* Resize handle - bottom right corner */}
          {!isMinimized && (
            <div
              className={`absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize group transition-all duration-300 ${
                showControls ? 'opacity-100' : 'opacity-0'
              }`}
              onMouseDown={handleResizeMouseDown}
              data-no-drag
            >
              <div className="absolute bottom-1 right-1 w-4 h-4 border-r-2 border-b-2 border-white/40 group-hover:border-white/80 transition-colors" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

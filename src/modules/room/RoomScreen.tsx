import { useState, useEffect, useCallback } from 'react';
import { HyperbeamCanvas } from './HyperbeamCanvas';
import { RoomProvider, useRoom } from './RoomContext';
import { ChatPanel, QuickChatInput } from '../chat';
import { PIPVideoWindow } from '../video';
import { useSimplePeer } from '../video/useSimplePeer';
import { OverlayControls, FloatingEmoji, MessageOverlay } from '../overlay';
import { LoadingScreen } from '@/components/LoadingScreen';
import { isEmojiOnly } from '@/lib/utils';
import type { ChatMessageBroadcastPayload } from '@/types/messages';
import { WSEventTypes } from '@/types/messages';

interface RoomScreenProps {
  roomId: string;
  userId: string;
  username: string;
  token: string;
  wsUrl?: string;
  initialHyperbeamUrl?: string;
  onLeaveRoom?: () => void;
  onOpenSettings?: () => void;
}

/**
 * RoomScreenContent - Inner component that uses room context
 */
function RoomScreenContent({ onLeaveRoom, onOpenSettings }: { onLeaveRoom?: () => void; onOpenSettings?: () => void }) {
  const { hyperbeamSessionUrl, isConnected, wsClient, userId, sendChatMessage } = useRoom();

  // SimplePeer P2P WebRTC hook for shared state
  const webrtcControls = useSimplePeer();

  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false); // Full chat history panel
  const [isQuickChatOpen, setIsQuickChatOpen] = useState(false); // Quick input at bottom-right
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(true); // REDESIGN: Start open for audio controls
  const [isHyperbeamReady, setIsHyperbeamReady] = useState(false); // Track Hyperbeam iframe load
  const [flyingEmojis, setFlyingEmojis] = useState<Array<{ id: string; emoji: string }>>([]);
  const [visibleOverlayMessages, setVisibleOverlayMessages] = useState<Array<{ id: string; username: string; text: string }>>([]);
  const [isNavbarVisible, setIsNavbarVisible] = useState(false); // Track navbar visibility for content spacing

  // Calculate bottom padding based on navbar visibility
  const NAVBAR_HEIGHT = 80; // Height of navbar when visible (h-20 = 5rem = 80px + padding)

  // Cursor tracking disabled to reduce network traffic
  // useCursorTracking({ throttleMs: 50 });

  // Clear overlay messages when any chat is opened
  useEffect(() => {
    if (isChatPanelOpen || isQuickChatOpen) {
      setVisibleOverlayMessages([]);
    }
  }, [isChatPanelOpen, isQuickChatOpen]);

  // Listen for chat messages to show floating emojis and message overlays
  useEffect(() => {
    if (!wsClient) return;

    const unsubscribe = wsClient.onMessage((message) => {
      // Handle quick emoji reactions (overlay-only, not in chat)
      if (message.type === 'quick-emoji') {
        const emoji = message.payload?.emoji;
        if (emoji) {
          const emojiId = `emoji-${Date.now()}-${Math.random()}`;
          setFlyingEmojis((prev) => [...prev, { id: emojiId, emoji }]);
        }
      }

      if (message.type === WSEventTypes.CHAT_MESSAGE_BROADCAST || message.type === 'new-message') {
        const chatMessage: ChatMessageBroadcastPayload = {
          userId: message.payload.userId || '',
          username: message.payload.user || message.payload.username || '',
          message: message.payload.text || message.payload.message || '',
          timestamp: message.payload.timestamp || Date.now(),
        };

        const messageText = chatMessage.message;

        // Check if message is emoji-only
        const isEmoji = isEmojiOnly(messageText);

        // Always show flying emoji animation for emoji-only messages
        if (isEmoji) {
          const emojiId = `emoji-${Date.now()}-${Math.random()}`;
          setFlyingEmojis((prev) => [...prev, { id: emojiId, emoji: messageText }]);
        }

        // Show message overlay only when both chats are closed
        if (!isChatPanelOpen && !isQuickChatOpen && !isEmoji) {
          const messageId = `msg-${Date.now()}-${Math.random()}`;
          setVisibleOverlayMessages((prev) => {
            const updated = [...prev, { id: messageId, username: chatMessage.username, text: messageText }];
            // Keep only last 3 messages
            return updated.slice(-3);
          });

          // Auto-remove message after 5 seconds
          setTimeout(() => {
            setVisibleOverlayMessages((prev) => prev.filter((m) => m.id !== messageId));
          }, 5000);
        }
      }
    });

    return unsubscribe;
  }, [wsClient, isChatPanelOpen, isQuickChatOpen, userId]);

  // Toggle camera window
  const handleToggleCamera = useCallback(() => {
    setIsVideoOpen((prev) => !prev);
  }, []);

  const handleRemoveEmoji = useCallback((id: string) => {
    setFlyingEmojis((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Enter key to open quick chat (only if not typing in an input AND quick chat is closed)
      if (
        e.key === 'Enter' &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) &&
        !isQuickChatOpen
      ) {
        e.preventDefault();
        setIsQuickChatOpen(true);
      }

      // Escape key to close quick chat
      if (e.key === 'Escape' && isQuickChatOpen) {
        e.preventDefault();
        setIsQuickChatOpen(false);
      }

      // F11 for fullscreen (browser will handle, but we track state)
      if (e.key === 'F11') {
        e.preventDefault();
        handleFullscreenToggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isQuickChatOpen]);

  // Fullscreen handler
  const handleFullscreenToggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error('[Room] Fullscreen error:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(err => {
        console.error('[Room] Exit fullscreen error:', err);
      });
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  console.log('[RoomScreen] Rendering - isNavbarVisible:', isNavbarVisible);

  return (
    <>
      {/* Content container with dynamic padding for navbar */}
      <div
        className="fixed inset-0 transition-all duration-300 ease-out"
        style={{
          paddingTop: '0px',
          paddingBottom: isNavbarVisible ? `${NAVBAR_HEIGHT}px` : '0px'
        }}
      >
        {/* Loading states - show appropriate loading screen */}
        {!isConnected && <LoadingScreen message="Connecting to room..." />}
        {isConnected && !hyperbeamSessionUrl && <LoadingScreen message="Setting up browser session..." />}
        {isConnected && hyperbeamSessionUrl && !isHyperbeamReady && <LoadingScreen message="Loading browser..." />}

        {/* Hyperbeam Canvas - only show when ready */}
        {isConnected && hyperbeamSessionUrl && (
          <HyperbeamCanvas
            embedUrl={hyperbeamSessionUrl}
            onReady={() => {
              // Minimal delay to avoid showing both animations
              setTimeout(() => setIsHyperbeamReady(true), 300);
            }}
            onError={(error) => console.error('[Room] Hyperbeam error:', error)}
          />
        )}
      </div>

      {/* Overlay Controls - Bottom toolbar with hover activation */}
      <OverlayControls
        onToggleChat={() => setIsChatPanelOpen(!isChatPanelOpen)}
        isChatOpen={isChatPanelOpen}
        onToggleCamera={handleToggleCamera}
        isCameraOpen={isVideoOpen}
        onToggleAudio={webrtcControls.toggleAudio}
        isAudioMuted={webrtcControls.isAudioMuted}
        onToggleFullscreen={handleFullscreenToggle}
        isFullscreen={isFullscreen}
        onLeaveRoom={onLeaveRoom || (() => {})}
        onOpenSettings={onOpenSettings}
        onVisibilityChange={setIsNavbarVisible}
      />

      {/* Cursor Indicator - Disabled to reduce network traffic */}
      {/* <CursorIndicator /> */}

      {/* Chat Panel - Full chat history in sidebar (opened via top nav button) */}
      <ChatPanel
        isVisible={isChatPanelOpen}
        onClose={() => setIsChatPanelOpen(false)}
      />

      {/* Quick Chat Input - Bottom-right minimal input (opened via Enter key) */}
      <QuickChatInput
        isVisible={isQuickChatOpen}
        onClose={() => setIsQuickChatOpen(false)}
        onSendMessage={sendChatMessage}
        onQuickEmoji={(emoji) => {
          if (wsClient) {
            wsClient.emit('quick-emoji', { emoji });
          }
        }}
        disabled={!isConnected}
      />

      {/* Message Overlay - Shows last 3 messages when both chats are closed */}
      {!isChatPanelOpen && !isQuickChatOpen && <MessageOverlay messages={visibleOverlayMessages} />}

      {/* Flying Emoji Animations - Shows emoji-only messages when chat is closed */}
      {flyingEmojis.map((flyingEmoji) => (
        <FloatingEmoji
          key={flyingEmoji.id}
          id={flyingEmoji.id}
          emoji={flyingEmoji.emoji}
          onComplete={handleRemoveEmoji}
        />
      ))}

      {/* PIP Video Window - Draggable face cam */}
      {isVideoOpen && (
        <PIPVideoWindow
          onClose={() => setIsVideoOpen(false)}
          webrtcControls={webrtcControls}
        />
      )}
    </>
  );
}

/**
 * RoomScreen - Main room orchestrator component
 *
 * Wraps the room with context provider and renders the Hyperbeam canvas.
 * This is the main screen users see when in an active watchparty room.
 */
export function RoomScreen({
  roomId,
  userId,
  username,
  token: _token,
  wsUrl = 'http://localhost:3001',
  initialHyperbeamUrl,
  onLeaveRoom,
  onOpenSettings
}: RoomScreenProps) {
  // Socket.IO handles connection params differently - just pass the base URL
  // Room joining happens via 'join-room' event in RoomProvider

  return (
    <RoomProvider
      roomId={roomId}
      userId={userId}
      username={username}
      wsUrl={wsUrl}
      initialHyperbeamUrl={initialHyperbeamUrl}
    >
      <RoomScreenContent onLeaveRoom={onLeaveRoom} onOpenSettings={onOpenSettings} />
    </RoomProvider>
  );
}

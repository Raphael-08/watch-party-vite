import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useRoom } from '../room/RoomContext';
import type { ChatMessageBroadcastPayload } from '@/types/messages';
import { WSEventTypes } from '@/types/messages';

interface ChatPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

// Maximum number of messages to keep in history
const MAX_MESSAGES = 100;

/**
 * ChatPanel - Slide-in chat overlay panel
 *
 * Glass-morphism chat panel that slides in from the right.
 * Features:
 * - Auto-scroll to latest message
 * - Message history (limited to 100 messages)
 * - WebSocket integration via RoomContext
 * - Keyboard support (Enter to send, Esc to close)
 * - Auto-hide on inactivity
 */
export function ChatPanel({ isVisible, onClose }: ChatPanelProps) {
  const { userId, sendChatMessage, wsClient, isConnected, messageHistory } = useRoom();
  const [messages, setMessages] = useState<ChatMessageBroadcastPayload[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Subscribe to chat messages from WebSocket
  useEffect(() => {
    if (!wsClient) return;

    const unsubscribe = wsClient.onMessage((message) => {
      // Backend sends 'new-message' event for new messages
      if (message.type === WSEventTypes.CHAT_MESSAGE_BROADCAST || message.type === 'new-message') {
        // Transform backend format to expected format
        const normalizedMessage: ChatMessageBroadcastPayload = {
          userId: message.payload.userId || '',
          username: message.payload.user || message.payload.username || '',
          message: message.payload.text || message.payload.message || '',
          timestamp: message.payload.timestamp || Date.now(),
        };
        setMessages((prev) => {
          const updated = [...prev, normalizedMessage];
          // Keep only the last MAX_MESSAGES messages
          return updated.length > MAX_MESSAGES
            ? updated.slice(-MAX_MESSAGES)
            : updated;
        });
      }
      
      // Handle message history
      if (message.type === 'message-history') {
        const history = message.payload as any[];
        if (Array.isArray(history)) {
          if (history.length > 0) {
            const normalizedHistory: ChatMessageBroadcastPayload[] = history.map((msg: any) => ({
              userId: msg.userId || msg.userID || '',
              username: msg.username || msg.user || '',
              message: msg.text || msg.message || '',
              timestamp: msg.timestamp || Date.now(),
            }));
            setMessages(normalizedHistory.slice(-MAX_MESSAGES));
          } else {
            setMessages([]);
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [wsClient, isConnected]);

  // Load message history from RoomContext
  useEffect(() => {
    if (Array.isArray(messageHistory) && messageHistory.length > 0) {
      const normalizedHistory: ChatMessageBroadcastPayload[] = messageHistory.map((msg: any) => ({
        userId: msg.userId || msg.userID || '',
        username: msg.username || msg.user || '',
        message: msg.text || msg.message || '',
        timestamp: msg.timestamp || Date.now(),
      }));
      setMessages(normalizedHistory.slice(-MAX_MESSAGES));
    }
  }, [messageHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onClose]);

  const handleSendMessage = (message: string) => {
    sendChatMessage(message);
  };

  const handleQuickEmoji = (emoji: string) => {
    // Send emoji directly as overlay event, not as chat message
    if (wsClient) {
      wsClient.emit('quick-emoji', { emoji });
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isVisible && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-smooth"
          onClick={onClose}
        />
      )}

      {/* Chat Panel */}
      <div
        ref={panelRef}
        className={`
          fixed top-0 right-0 h-full w-96 z-50
          bg-black/85 backdrop-blur-2xl border-l border-white/30
          shadow-2xl
          flex flex-col
          transition-smooth
          ${isVisible ? 'translate-x-0' : 'translate-x-full'}
        `}
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(24px) saturate(180%)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">Chat</h2>
            <div
              className={`size-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
              title={isConnected ? 'Connected' : 'Disconnected'}
            />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0">
          <div className="p-2">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No messages yet. Start chatting!
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {messages.map((msg, index) => (
                  <ChatMessage
                    key={`${msg.userId}-${msg.timestamp}-${index}`}
                    message={msg}
                    isOwnMessage={msg.userId === userId}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <ChatInput
          onSendMessage={handleSendMessage}
          onQuickEmoji={handleQuickEmoji}
          disabled={!isConnected}
        />
      </div>
    </>
  );
}



import { useEffect, useState, useRef } from 'react';
import { chatsApi, type PrivateChat, type PrivateChatMessage } from '@/lib/api';
import { useSocket } from '@/lib/useSocket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ChatWindowProps {
  chat: PrivateChat;
  currentUser: {
    $id: string;
    name: string;
    avatar?: string;
  };
  onBack?: () => void;
}

export default function ChatWindow({ chat, currentUser, onBack }: ChatWindowProps) {
  const [messages, setMessages] = useState<PrivateChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    sendPrivateMessage,
    sendTypingIndicator,
    markMessagesAsRead,
    onPrivateMessage,
    onMessageSent,
    onTyping,
    onMessagesRead,
  } = useSocket(currentUser.$id, currentUser.name, currentUser.avatar);

  const otherUser =
    chat.participant1Id === currentUser.$id
      ? { id: chat.participant2Id, username: String(chat.participant2Username || 'Unknown') }
      : { id: chat.participant1Id, username: String(chat.participant1Username || 'Unknown') };

  // Load messages
  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await chatsApi.getMessages(chat.chatId);
      setMessages(data);

      // Mark as read
      markMessagesAsRead?.(chat.chatId);
      await chatsApi.markAsRead(chat.chatId, currentUser.$id);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [chat.chatId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is fully rendered
    requestAnimationFrame(() => {
      if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    });
  }, [messages]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      // Double requestAnimationFrame to ensure layout is complete
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
              scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
          }
        });
      });
    }
  }, [loading]);

  // Listen for new messages
  useEffect(() => {
    const unsubscribe = onPrivateMessage?.((message) => {
      if (message.chatId === chat.chatId) {
        setMessages((prev) => [...prev, message]);

        // Mark as read if it's from the other user
        if (message.senderId !== currentUser.$id) {
          markMessagesAsRead?.(chat.chatId);
          chatsApi.markAsRead(chat.chatId, currentUser.$id);
        }
      }
    });

    return unsubscribe;
  }, [onPrivateMessage, chat.chatId, currentUser.$id]);

  // Listen for message sent confirmation
  useEffect(() => {
    const unsubscribe = onMessageSent?.((message) => {
      if (message.chatId === chat.chatId) {
        // Update local message if it exists
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === message.id);
          if (exists) return prev;
          return [...prev, message];
        });
      }
    });

    return unsubscribe;
  }, [onMessageSent, chat.chatId]);

  // Listen for typing indicator
  useEffect(() => {
    const unsubscribe = onTyping?.((data) => {
      if (data.chatId === chat.chatId && data.userId !== currentUser.$id) {
        setOtherUserTyping(data.isTyping);
      }
    });

    return unsubscribe;
  }, [onTyping, chat.chatId, currentUser.$id]);

  // Listen for read receipts
  useEffect(() => {
    const unsubscribe = onMessagesRead?.((data) => {
      if (data.chatId === chat.chatId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.senderId === currentUser.$id ? { ...msg, read: true } : msg
          )
        );
      }
    });

    return unsubscribe;
  }, [onMessagesRead, chat.chatId, currentUser.$id]);

  // Handle input change with typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    if (!isTyping && e.target.value) {
      setIsTyping(true);
      sendTypingIndicator?.(chat.chatId, true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingIndicator?.(chat.chatId, false);
    }, 2000);
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);

      // Stop typing indicator
      if (isTyping) {
        setIsTyping(false);
        sendTypingIndicator?.(chat.chatId, false);
      }

      // Send via socket for real-time delivery
      sendPrivateMessage?.({
        chatId: chat.chatId,
        recipientId: otherUser.id,
        content: newMessage.trim(),
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full relative overflow-hidden flex flex-col">
      {/* Header */}
      <Card className="border-b rounded-none flex-shrink-0">
        <CardHeader className="py-3">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                {otherUser.username.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-base">{otherUser.username}</CardTitle>
              {otherUserTyping && (
                <p className="text-xs text-muted-foreground">Typing...</p>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Messages - Absolutely positioned */}
      <div className="absolute inset-x-0 bg-card" style={{ top: '72px', bottom: '112px' }}>
        <ScrollArea ref={scrollAreaRef} className="h-full w-full">
          <div className="space-y-4 p-4 pb-8">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No messages yet</p>
                <p className="text-sm mt-1">Start the conversation!</p>
              </div>
            ) : (
              messages.map((message, index) => {
                const isOwnMessage = message.senderId === currentUser.$id;
                const showDate =
                  index === 0 ||
                  format(new Date(messages[index - 1].timestamp), 'PP') !==
                    format(new Date(message.timestamp), 'PP');

                return (
                  <div key={message.id}>
                    {showDate && (
                      <div className="text-center text-xs text-muted-foreground my-2">
                        {format(new Date(message.timestamp), 'PP')}
                      </div>
                    )}

                    <div
                      className={`flex items-end gap-2 ${
                        isOwnMessage ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      <Avatar className="h-6 w-6 flex-shrink-0">
                        <AvatarFallback className="text-xs">
                          {message.senderUsername.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div
                        className={`flex flex-col ${
                          isOwnMessage ? 'items-end' : 'items-start'
                        } max-w-[70%]`}
                      >
                        <div
                          className={`rounded-lg px-3 py-2 ${
                            isOwnMessage
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm break-words">{String(message.content || '')}</p>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(message.timestamp), 'p')}
                          </span>
                          {isOwnMessage && message.read && (
                            <span className="text-xs text-muted-foreground">· Read</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input - Absolutely positioned at bottom */}
      <Card className="border-t rounded-none absolute bottom-0 inset-x-0">
        <form onSubmit={handleSendMessage} className="p-4">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={handleInputChange}
              placeholder="Type a message..."
              disabled={sending}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={!newMessage.trim() || sending}>
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

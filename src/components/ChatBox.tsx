import { useState, useEffect, useRef, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Send, MessageCircle, Users, Crown, Smile, MoreVertical, UserX, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { messageSchema } from '@/lib/validations';
import { sanitizeChatMessage } from '@/lib/security';
import { getUserColor, debounce } from '@/lib/utils';
import { ChatLoadingSkeleton } from '@/components/skeletons/MessageSkeleton';
import EmojiPicker from 'emoji-picker-react';

interface Message {
  id: string;
  username: string;
  text: string;
  timestamp: Date;
  isSystem?: boolean;
}

interface Participant {
  id: string;
  username: string;
  avatar?: string;
  isCreator?: boolean;
}

interface ChatBoxProps {
  messages: Message[];
  participants: Participant[];
  socket: any; // Socket.IO socket
  roomCode: string;
  username: string;
  isCreator?: boolean;
  currentUserId?: string;
  sendMessage: (message: string) => void;
}

export default function ChatBox({ messages, participants, socket, roomCode, username: _username, isCreator = false, currentUserId, sendMessage }: ChatBoxProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [localMessages, setLocalMessages] = useState<Message[]>(messages);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [_showKickBanMenu, setShowKickBanMenu] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Memoize getUserColor function
  const getColor = useMemo(() => getUserColor, []);

  // Debounced scroll function
  const debouncedScroll = useMemo(
    () => debounce(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 100),
    []
  );

  useEffect(() => {
    setLocalMessages(messages);
    if (messages.length > 0) {
      setIsLoading(false);
    }
  }, [messages]);

  useEffect(() => {
    debouncedScroll();
  }, [localMessages, debouncedScroll]);

  const handleSendMessage = () => {
    if (!inputMessage.trim() || !socket) return;

    // Sanitize and validate message
    const sanitized = sanitizeChatMessage(inputMessage);
    const validation = messageSchema.safeParse(sanitized);

    if (!validation.success) {
      // Don't show toast for message validation errors to avoid being annoying
      return;
    }

    sendMessage(validation.data);
    setInputMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEmojiClick = (emojiData: any) => {
    setInputMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleQuickEmoji = (emoji: string) => {
    if (socket) {
      sendMessage(emoji);
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  };

  const handleKickUser = (userId: string) => {
    if (!socket || !isCreator || !socket.connected) return;

    socket.emit('kick-user', { roomCode, userId });
    toast.info('User kicked from room');
    setShowKickBanMenu(null);
  };

  const handleBanUser = (userId: string) => {
    if (!socket || !isCreator || !socket.connected) return;

    socket.emit('ban-user', { roomCode, userId });
    toast.info('User banned from room');
    setShowKickBanMenu(null);
  };


  return (
    <div className="h-full flex flex-col bg-card">
      <Tabs defaultValue="chat" className="flex-1 flex flex-col">
        <div className="border-b border-border/40 px-4 pt-4">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="chat" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="participants" className="gap-2">
              <Users className="w-4 h-4" />
              People ({participants.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chat" className="flex-1 flex flex-col mt-0 p-0">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {isLoading ? (
              <ChatLoadingSkeleton />
            ) : localMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <MessageCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
                <p className="text-sm text-muted-foreground">
                  Be the first to send a message!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {localMessages.map((msg) => (
                <div key={msg.id} className={msg.isSystem ? 'text-center' : ''}>
                  {msg.isSystem ? (
                    <div className="inline-block px-3 py-1.5 rounded-full bg-muted text-xs text-muted-foreground">
                      {msg.text}
                    </div>
                  ) : (
                    <div className="flex gap-3 group">
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarFallback className={getColor(msg.username)}>
                          {msg.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-semibold text-sm">{msg.username}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed break-words">{msg.text}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              </div>
            )}
          </ScrollArea>

          <div className="border-t border-border/40 p-4 space-y-3">
            {/* Quick Emoji Reactions */}
            <div className="flex gap-2 justify-center">
              {['👍', '❤️', '😂', '😮'].map((emoji) => (
                <Button
                  key={emoji}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-xl hover:scale-110 transition-transform"
                  onClick={() => handleQuickEmoji(emoji)}
                >
                  {emoji}
                </Button>
              ))}
            </div>

            {/* Message Input */}
            <div className="flex gap-2">
              <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" type="button">
                    <Smile className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-full p-0 border-0">
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    width="100%"
                    height="400px"
                  />
                </PopoverContent>
              </Popover>
              <Input
                placeholder="Type a message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim()}
                className="gap-2"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="participants" className="flex-1 mt-0 p-0">
          <ScrollArea className="h-full p-4">
            <div className="space-y-2">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <Avatar className="w-10 h-10">
                    {participant.avatar ? (
                      <AvatarImage src={participant.avatar} alt={participant.username} />
                    ) : (
                      <AvatarFallback className={getColor(participant.username)}>
                        {participant.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{participant.username}</p>
                      {participant.isCreator && (
                        <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-xs">
                          <Crown className="w-3 h-3" />
                          Host
                        </Badge>
                      )}
                    </div>
                  </div>
                  {/* Kick/Ban Menu - Only show if current user is creator and this is not the creator */}
                  {isCreator && participant.id !== currentUserId && (
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={(e) => {
                            console.log('Menu button clicked', { participantId: participant.id, currentUserId });
                            e.stopPropagation();
                          }}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="z-[150]">
                        <DropdownMenuLabel>Moderate User</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleKickUser(participant.id)}
                          className="text-orange-600 focus:text-orange-600 cursor-pointer"
                        >
                          <UserX className="w-4 h-4 mr-2" />
                          Kick User
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleBanUser(participant.id)}
                          className="text-destructive focus:text-destructive cursor-pointer"
                        >
                          <Ban className="w-4 h-4 mr-2" />
                          Ban User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

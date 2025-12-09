

import { useEffect, useState } from 'react';
import { chatsApi, type PrivateChat } from '@/lib/api';
import { useSocket } from '@/lib/useSocket';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface ChatListProps {
  currentUser: {
    $id: string;
    name: string;
    avatar?: string;
  };
  onSelectChat?: (chat: PrivateChat) => void;
  selectedChatId?: string;
}

export default function ChatList({ currentUser, onSelectChat, selectedChatId }: ChatListProps) {
  const [chats, setChats] = useState<PrivateChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());

  const { onPrivateMessage } = useSocket(currentUser.$id, currentUser.name, currentUser.avatar);

  // Load chats
  const loadChats = async () => {
    try {
      setLoading(true);
      const data = await chatsApi.getChats(currentUser.$id);

      if (!data) {
        setChats([]);
        setLoading(false);
        return;
      }

      // Sort by last message time
      const sorted = data.sort((a, b) => {
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        const aTime = new Date(a.lastMessageTime).getTime();
        const bTime = new Date(b.lastMessageTime).getTime();
        // Check for invalid dates
        if (isNaN(aTime)) return 1;
        if (isNaN(bTime)) return -1;
        return bTime - aTime;
      });

      setChats(sorted);

      // Note: Unread counts would need per-chat endpoint from backend
      // For now, we'll rely on real-time updates from Socket.IO
      setUnreadCounts(new Map());
    } catch (error) {
      console.error('Error loading chats:', error);
      toast.error('Failed to load chats');
      setChats([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChats();
  }, [currentUser.$id]);

  // Listen for new messages
  useEffect(() => {
    if (!onPrivateMessage) return;
    
    const unsubscribe = onPrivateMessage((message) => {
      // Update chat list - move chat to top and update last message
      setChats((prevChats) => {
        const updatedChats = prevChats.map((chat) => {
          if (chat.chatId === message.chatId) {
            return {
              ...chat,
              lastMessage: message.content,
              lastMessageTime: message.timestamp,
              lastMessageSender: message.senderId,
            };
          }
          return chat;
        });

        // Sort by last message time
        return updatedChats.sort((a, b) => {
          if (!a.lastMessageTime) return 1;
          if (!b.lastMessageTime) return -1;
          const aTime = new Date(a.lastMessageTime).getTime();
          const bTime = new Date(b.lastMessageTime).getTime();
          // Check for invalid dates
          if (isNaN(aTime)) return 1;
          if (isNaN(bTime)) return -1;
          return bTime - aTime;
        });
      });

      // Update unread count if message is not from current user and chat is not selected
      if (message.senderId !== currentUser.$id && message.chatId !== selectedChatId) {
        setUnreadCounts((prev) => {
          const newCounts = new Map(prev);
          const current = newCounts.get(message.chatId) || 0;
          newCounts.set(message.chatId, current + 1);
          return newCounts;
        });
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [onPrivateMessage, currentUser.$id, selectedChatId]);

  // Clear unread count when chat is selected
  useEffect(() => {
    if (selectedChatId) {
      setUnreadCounts((prev) => {
        const newCounts = new Map(prev);
        newCounts.delete(selectedChatId);
        return newCounts;
      });
    }
  }, [selectedChatId]);

  const getOtherParticipant = (chat: PrivateChat) => {
    return chat.participant1Id === currentUser.$id
      ? { id: chat.participant2Id, username: chat.participant2Username }
      : { id: chat.participant1Id, username: chat.participant1Username };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Messages
        </CardTitle>
        <CardDescription>Your private conversations</CardDescription>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
        {!chats || chats.length === 0 ? (
          <div className="text-center py-8 px-4 text-muted-foreground">
            <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No conversations yet</p>
            <p className="text-sm mt-1">Start chatting with your friends!</p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="divide-y">
            {chats.map((chat) => {
              const otherUser = getOtherParticipant(chat);
              const unreadCount = unreadCounts.get(chat.chatId) || 0;
              const isSelected = selectedChatId === chat.chatId;
              const isFromOther = chat.lastMessageSender !== currentUser.$id;

              return (
                <div
                  key={chat.id}
                  onClick={() => onSelectChat?.(chat)}
                  className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-accent transition-colors ${
                    isSelected ? 'bg-accent' : ''
                  }`}
                >
                  <Avatar>
                    <AvatarFallback>
                      {otherUser.username.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium truncate">{otherUser.username}</p>
                      {chat.lastMessageTime && !isNaN(new Date(chat.lastMessageTime).getTime()) && (
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">
                          {formatDistanceToNow(new Date(chat.lastMessageTime), {
                            addSuffix: true,
                          })}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <p
                        className={`text-sm truncate ${
                          unreadCount > 0 && isFromOther
                            ? 'font-semibold text-foreground'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {chat.lastMessageSender === currentUser.$id && 'You: '}
                        {typeof chat.lastMessage === 'string' ? chat.lastMessage : (chat.lastMessage ? 'New message' : 'No messages yet')}
                      </p>
                      {unreadCount > 0 && (
                        <Badge variant="default" className="ml-2 shrink-0">
                          {unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

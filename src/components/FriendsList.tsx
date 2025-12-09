

import { useEffect, useState } from 'react';
import { friendsApi, type Friend } from '@/lib/api';
import { useSocket } from '@/lib/useSocket';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Users, MessageCircle, Loader2, UserMinus } from 'lucide-react';
import { toast } from 'sonner';

interface FriendsListProps {
  currentUser: {
    $id: string;
    name: string;
    avatar?: string;
  };
  onStartChat?: (friendId: string, friendUsername: string) => void;
}

export default function FriendsList({ currentUser, onStartChat }: FriendsListProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [onlineFriends, setOnlineFriends] = useState<Set<string>>(new Set());

  const { onlineUsers, onFriendOnline, onFriendOffline } = useSocket(
    currentUser.$id,
    currentUser.name,
    currentUser.avatar
  );

  // Load friends
  const loadFriends = async () => {
    try {
      setLoading(true);
      const data = await friendsApi.getFriends(currentUser.$id);
      setFriends(data || []);
    } catch (error) {
      console.error('Error loading friends:', error);
      toast.error('Failed to load friends');
      setFriends([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFriends();
  }, [currentUser.$id]);

  // Update online friends based on socket data
  useEffect(() => {
    const online = new Set<string>();
    friends.forEach((friend) => {
      if (onlineUsers.includes(friend.friendId)) {
        online.add(friend.friendId);
      }
    });
    setOnlineFriends(online);
  }, [onlineUsers, friends]);

  // Listen for friend online status
  useEffect(() => {
    const unsubscribe1 = onFriendOnline?.((data) => {
      setOnlineFriends((prev) => new Set(prev).add(data.userId));
    });

    const unsubscribe2 = onFriendOffline?.((data) => {
      setOnlineFriends((prev) => {
        const newSet = new Set(prev);
        newSet.delete(data.userId);
        return newSet;
      });
    });

    return () => {
      unsubscribe1?.();
      unsubscribe2?.();
    };
  }, [onFriendOnline, onFriendOffline]);

  // Remove friend
  const handleRemoveFriend = async (friend: Friend) => {
    try {
      setRemovingId(friend.id);
      await friendsApi.removeFriend(currentUser.$id, friend.friendId);
      toast.success(`Removed ${friend.friendUsername} from friends`);
      loadFriends();
    } catch (error) {
      console.error('Error removing friend:', error);
      toast.error('Failed to remove friend');
    } finally {
      setRemovingId(null);
    }
  };

  // Start chat with friend
  const handleStartChat = (friend: Friend) => {
    onStartChat?.(friend.friendId, friend.friendUsername);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Friends
          <Badge variant="secondary">{friends?.length || 0}</Badge>
        </CardTitle>
        <CardDescription>Your friends list</CardDescription>
      </CardHeader>
      <CardContent>
        {!friends || friends.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No friends yet</p>
            <p className="text-sm mt-1">Send friend requests to connect with others!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {friends.map((friend) => {
              const isOnline = onlineFriends.has(friend.friendId);

              return (
                <div
                  key={friend.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar>
                        {friend.friendAvatar ? (
                          <AvatarImage src={friend.friendAvatar} alt={friend.friendUsername} />
                        ) : null}
                        <AvatarFallback>
                          {friend.friendUsername.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {isOnline && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{friend.friendUsername}</p>
                      <p className="text-xs text-muted-foreground">
                        {isOnline ? (
                          <span className="text-green-600 dark:text-green-400">Online</span>
                        ) : (
                          'Offline'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStartChat(friend)}
                      title="Start chat"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={removingId === friend.id}
                          title="Remove friend"
                        >
                          {removingId === friend.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UserMinus className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Friend</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove {friend.friendUsername} from your
                            friends? You will need to send a new friend request to reconnect.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveFriend(friend)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

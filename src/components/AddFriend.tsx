

import { useState, useEffect } from 'react';
import { friendsApi, usersApi, type User } from '@/lib/api';
import { useSocket } from '@/lib/useSocket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { UserPlus, Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AddFriendProps {
  currentUser: {
    $id: string;
    name: string;
  };
}

export default function AddFriend({ currentUser }: AddFriendProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [sending, setSending] = useState(false);

  const { notifyFriendRequest } = useSocket(currentUser.$id, currentUser.name);

  // Search users with debounce
  useEffect(() => {
    const delaySearch = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setSearching(true);
        try {
          const results = await usersApi.searchUsers(searchQuery);
          // Filter out current user from results
          setSearchResults(results.filter(user => user.$id !== currentUser.$id));
        } catch (error) {
          console.error('Error searching users:', error);
          toast.error('Failed to search users');
          setSearchResults([]);
        } finally {
          setSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [searchQuery, currentUser.$id]);

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleClearSelection = () => {
    setSelectedUser(null);
    setSearchQuery('');
  };

  const handleSendRequest = async () => {
    if (!selectedUser) {
      toast.error('Please select a user to send a friend request');
      return;
    }

    try {
      setSending(true);

      // Send friend request via API
      const result = await friendsApi.sendRequest({
        requesterId: currentUser.$id,
        recipientId: selectedUser.$id,
        requesterUsername: currentUser.name,
        recipientUsername: selectedUser.name,
      });

      // Notify via socket
      notifyFriendRequest?.({
        requestId: result.requestId,
        recipientId: selectedUser.$id,
        requesterUsername: currentUser.name,
      });

      toast.success(`Friend request sent to ${selectedUser.name}!`);

      // Reset form
      setSelectedUser(null);
      setSearchQuery('');
      setOpen(false);
    } catch (error: any) {
      console.error('Error sending friend request:', error);
      if (error.message?.includes('already exists')) {
        toast.error('Friend request already exists');
      } else {
        toast.error('Failed to send friend request');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Add Friend
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Friend</DialogTitle>
          <DialogDescription>
            Search for users by name and send them a friend request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected User Display */}
          {selectedUser ? (
            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-sm font-semibold">
                      {selectedUser.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{selectedUser.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearSelection}
                  disabled={sending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Search Input */}
              <div className="space-y-2">
                <Label htmlFor="search">Search Users</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={sending}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Type at least 2 characters to search
                </p>
              </div>

              {/* Search Results */}
              {searchQuery.length >= 2 && (
                <div className="border rounded-lg">
                  <ScrollArea className="h-[200px]">
                    {searching ? (
                      <div className="flex items-center justify-center h-[200px]">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : searchResults.length > 0 ? (
                      <div className="p-2 space-y-1">
                        {searchResults.map((user) => (
                          <button
                            key={user.$id}
                            onClick={() => handleSelectUser(user)}
                            className="w-full p-3 hover:bg-muted rounded-lg transition-colors text-left flex items-center gap-3"
                          >
                            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-semibold">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{user.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                        <Search className="h-8 w-8 mb-2 opacity-50" />
                        <p className="text-sm">No users found</p>
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSendRequest} disabled={sending || !selectedUser}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Send Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

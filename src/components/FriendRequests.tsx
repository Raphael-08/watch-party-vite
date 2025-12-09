

import { useEffect, useState } from 'react';
import { friendsApi, type FriendRequest } from '@/lib/api';
import { useSocket } from '@/lib/useSocket';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Check, X, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface FriendRequestsProps {
  currentUser: {
    $id: string;
    name: string;
    avatar?: string;
  };
}

export default function FriendRequests({ currentUser }: FriendRequestsProps) {
  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

  const {
    notifyFriendRequestAccepted,
    notifyFriendRequestRejected,
    onFriendRequest,
    onFriendRequestResponse,
  } = useSocket(currentUser.$id, currentUser.name, currentUser.avatar);

  // Load friend requests
  const loadRequests = async () => {
    try {
      setLoading(true);
      const [received, sent] = await Promise.all([
        friendsApi.getReceivedRequests(currentUser.$id),
        friendsApi.getSentRequests(currentUser.$id),
      ]);
      setReceivedRequests(received || []);
      setSentRequests(sent || []);
    } catch (error) {
      console.error('Error loading friend requests:', error);
      toast.error('Failed to load friend requests');
      setReceivedRequests([]);
      setSentRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [currentUser.$id]);

  // Listen for new friend requests
  useEffect(() => {
    const unsubscribe = onFriendRequest?.((data) => {
      toast.info(data.message);
      loadRequests(); // Reload requests
    });

    return unsubscribe;
  }, [onFriendRequest]);

  // Listen for friend request responses
  useEffect(() => {
    const unsubscribe = onFriendRequestResponse?.((data) => {
      if (data.accepted) {
        toast.success(data.message);
      } else {
        toast.info(data.message);
      }
      loadRequests(); // Reload requests
    });

    return unsubscribe;
  }, [onFriendRequestResponse]);

  // Accept friend request
  const handleAccept = async (request: FriendRequest) => {
    try {
      setProcessingIds((prev) => new Set(prev).add(request.id));
      await friendsApi.acceptRequest(request.id);

      // Notify via socket
      notifyFriendRequestAccepted?.({
        requesterId: request.requesterId,
        acceptorUsername: currentUser.name,
      });

      toast.success(`You are now friends with ${request.requesterUsername}!`);
      loadRequests();
    } catch (error) {
      console.error('Error accepting friend request:', error);
      toast.error('Failed to accept friend request');
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(request.id);
        return newSet;
      });
    }
  };

  // Reject friend request
  const handleReject = async (request: FriendRequest) => {
    try {
      setProcessingIds((prev) => new Set(prev).add(request.id));
      await friendsApi.rejectRequest(request.id);

      // Notify via socket
      notifyFriendRequestRejected?.({
        requesterId: request.requesterId,
        rejectorUsername: currentUser.name,
      });

      toast.info('Friend request rejected');
      loadRequests();
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      toast.error('Failed to reject friend request');
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(request.id);
        return newSet;
      });
    }
  };

  // Cancel sent request
  const handleCancel = async (requestId: number) => {
    try {
      setProcessingIds((prev) => new Set(prev).add(requestId));
      await friendsApi.cancelRequest(requestId);
      toast.info('Friend request cancelled');
      loadRequests();
    } catch (error) {
      console.error('Error cancelling friend request:', error);
      toast.error('Failed to cancel friend request');
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
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
          <UserPlus className="h-5 w-5" />
          Friend Requests
        </CardTitle>
        <CardDescription>Manage your friend requests</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="received">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="received">
              Received
              {receivedRequests?.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {receivedRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sent">
              Sent
              {sentRequests?.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {sentRequests.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="received" className="space-y-4 mt-4">
            {!receivedRequests || receivedRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No pending friend requests</p>
              </div>
            ) : (
              receivedRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {request.requesterUsername.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{request.requesterUsername}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleAccept(request)}
                      disabled={processingIds.has(request.id)}
                    >
                      {processingIds.has(request.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Accept
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(request)}
                      disabled={processingIds.has(request.id)}
                    >
                      {processingIds.has(request.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="sent" className="space-y-4 mt-4">
            {!sentRequests || sentRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No pending sent requests</p>
              </div>
            ) : (
              sentRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {request.recipientUsername.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{request.recipientUsername}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Pending
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCancel(request.id)}
                    disabled={processingIds.has(request.id)}
                  >
                    {processingIds.has(request.id) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Cancel'
                    )}
                  </Button>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

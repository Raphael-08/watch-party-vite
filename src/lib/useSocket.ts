import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from './config';
import { appwrite } from './appwrite';

export interface SocketMessage {
  id: number;
  chatId: string;
  senderId: string;
  senderUsername: string;
  senderAvatar: string | null;
  content: string;
  read: boolean;
  timestamp: Date;
}

export interface SocketNotification {
  type: 'friend_request' | 'message' | 'scheduled_party' | 'party_starting';
  title: string;
  message: string;
  relatedId?: string;
}

export interface FriendStatus {
  userId: string;
  username?: string;
  avatar?: string;
  online: boolean;
}

export function useSocket(userId?: string, username?: string, avatar?: string) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!userId || !username) return;

    let isMounted = true;

    const initSocket = async () => {
      // Get JWT token for authentication
      const token = await appwrite.getSessionJWT();
      if (!token) {
        console.error('❌ Failed to get authentication token for social features');
        return;
      }

      if (!isMounted) return;

      console.log('🔌 Connecting to social features Socket.IO:', API_URL);

      // Create Socket.IO connection for social features
      const socket = io(API_URL, {
        auth: {
          token, // Send JWT token for authentication
        },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        setIsConnected(true);

        // Notify server that user is online
        socket.emit('user-online', {
          userId,
          username,
          avatar: avatar || null,
        });
      });

      socket.on('disconnect', () => {
        setIsConnected(false);
      });

      socket.on('connect_error', (error) => {
        console.error('❌ Social features Socket.IO connection error:', error);
        setIsConnected(false);
      });

      // Online/offline status
      socket.on('online-users', (users: string[]) => {
        setOnlineUsers(users);
      });

      socket.on('friend-online', (data: FriendStatus) => {
        setOnlineUsers(prev => [...prev, data.userId]);
      });

      socket.on('friend-offline', (data: FriendStatus) => {
        setOnlineUsers(prev => prev.filter(id => id !== data.userId));
      });
    };

    initSocket();

    // Cleanup on unmount
    return () => {
      isMounted = false;
      // Use a small timeout to ensure any pending operations complete
      setTimeout(() => {
        const socket = socketRef.current;
        if (socket?.connected) {
          socket.emit('user-offline', {
            userId,
            username,
          });
        }
        socket?.disconnect();
      }, 100);
    };
  }, [userId, username, avatar]);

  // Send private message
  const sendPrivateMessage = (data: {
    chatId: string;
    recipientId: string;
    content: string;
  }) => {
    if (!socketRef.current?.connected || !userId || !username) {
      return;
    }

    socketRef.current.emit('private-message', {
      chatId: data.chatId,
      senderId: userId,
      senderUsername: username,
      senderAvatar: avatar || null,
      content: data.content,
      recipientId: data.recipientId,
    });
  };

  // Send typing indicator
  const sendTypingIndicator = (chatId: string, isTyping: boolean) => {
    if (!socketRef.current?.connected || !userId || !username) return;

    socketRef.current.emit('typing', {
      chatId,
      userId,
      username,
      isTyping,
    });
  };

  // Mark messages as read
  const markMessagesAsRead = (chatId: string) => {
    if (!socketRef.current?.connected || !userId) return;

    socketRef.current.emit('mark-read', {
      chatId,
      userId,
    });
  };

  // Notify friend request sent
  const notifyFriendRequest = (data: {
    requestId: number;
    recipientId: string;
    requesterUsername: string;
  }) => {
    if (!socketRef.current?.connected || !userId) return;

    socketRef.current.emit('friend-request-sent', {
      requestId: data.requestId,
      requesterId: userId,
      requesterUsername: data.requesterUsername,
      recipientId: data.recipientId,
    });
  };

  // Notify friend request accepted
  const notifyFriendRequestAccepted = (data: {
    requesterId: string;
    acceptorUsername: string;
  }) => {
    if (!socketRef.current?.connected || !userId) return;

    socketRef.current.emit('friend-request-accepted', {
      requesterId: data.requesterId,
      acceptorId: userId,
      acceptorUsername: data.acceptorUsername,
    });
  };

  // Notify friend request rejected
  const notifyFriendRequestRejected = (data: {
    requesterId: string;
    rejectorUsername: string;
  }) => {
    if (!socketRef.current?.connected || !userId) return;

    socketRef.current.emit('friend-request-rejected', {
      requesterId: data.requesterId,
      rejectorUsername: data.rejectorUsername,
    });
  };

  // Send notification
  const sendNotification = (data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    relatedId?: string;
  }) => {
    if (!socketRef.current?.connected) return;

    socketRef.current.emit('send-notification', data);
  };

  // Event listeners
  const onPrivateMessage = (callback: (message: SocketMessage) => void) => {
    if (!socketRef.current) return () => {};

    const handler = (data: any) => {
      callback({
        id: data.id,
        chatId: data.chatId,
        senderId: data.senderId,
        senderUsername: data.senderUsername,
        senderAvatar: data.senderAvatar,
        content: data.content,
        read: data.read,
        timestamp: new Date(data.timestamp),
      });
    };

    socketRef.current.on('new-private-message', handler);

    return () => {
      if (socketRef.current) {
        socketRef.current.off('new-private-message', handler);
      }
    };
  };

  const onMessageSent = (callback: (message: SocketMessage) => void) => {
    if (!socketRef.current) return () => {};

    const handler = (data: any) => {
      callback({
        id: data.id,
        chatId: data.chatId,
        senderId: data.senderId,
        senderUsername: data.senderUsername,
        senderAvatar: data.senderAvatar,
        content: data.content,
        read: data.read,
        timestamp: new Date(data.timestamp),
      });
    };

    socketRef.current.on('message-sent', handler);

    return () => {
      if (socketRef.current) {
        socketRef.current.off('message-sent', handler);
      }
    };
  };

  const onTyping = (
    callback: (data: { chatId: string; userId: string; username: string; isTyping: boolean }) => void
  ) => {
    if (!socketRef.current) return () => {};

    const handler = (data: any) => {
      callback(data);
    };

    socketRef.current.on('user-typing', handler);

    return () => {
      if (socketRef.current) {
        socketRef.current.off('user-typing', handler);
      }
    };
  };

  const onMessagesRead = (callback: (data: { chatId: string; readBy: string }) => void) => {
    if (!socketRef.current) return () => {};

    const handler = (data: any) => {
      callback(data);
    };

    socketRef.current.on('messages-read', handler);

    return () => {
      if (socketRef.current) {
        socketRef.current.off('messages-read', handler);
      }
    };
  };

  const onFriendRequest = (
    callback: (data: { requestId: number; requesterId: string; requesterUsername: string; message: string }) => void
  ) => {
    if (!socketRef.current) return () => {};

    const handler = (data: any) => {
      callback(data);
    };

    socketRef.current.on('new-friend-request', handler);

    return () => {
      if (socketRef.current) {
        socketRef.current.off('new-friend-request', handler);
      }
    };
  };

  const onFriendRequestResponse = (
    callback: (data: { accepted: boolean; friendId?: string; friendUsername?: string; message: string }) => void
  ) => {
    if (!socketRef.current) return () => {};

    const handler = (data: any) => {
      callback(data);
    };

    socketRef.current.on('friend-request-response', handler);

    return () => {
      if (socketRef.current) {
        socketRef.current.off('friend-request-response', handler);
      }
    };
  };

  const onFriendOnline = (callback: (data: FriendStatus) => void) => {
    if (!socketRef.current) return () => {};

    const handler = (data: any) => {
      callback({
        userId: data.userId,
        username: data.username,
        avatar: data.avatar,
        online: data.online,
      });
    };

    socketRef.current.on('friend-online', handler);

    return () => {
      if (socketRef.current) {
        socketRef.current.off('friend-online', handler);
      }
    };
  };

  const onFriendOffline = (callback: (data: FriendStatus) => void) => {
    if (!socketRef.current) return () => {};

    const handler = (data: any) => {
      callback({
        userId: data.userId,
        username: data.username,
        avatar: data.avatar,
        online: data.online,
      });
    };

    socketRef.current.on('friend-offline', handler);

    return () => {
      if (socketRef.current) {
        socketRef.current.off('friend-offline', handler);
      }
    };
  };

  const onNotification = (callback: (notification: SocketNotification) => void) => {
    if (!socketRef.current) return () => {};

    const handler = (data: any) => {
      callback({
        type: data.type,
        title: data.title,
        message: data.message,
        relatedId: data.relatedId,
      });
    };

    socketRef.current.on('notification', handler);

    return () => {
      if (socketRef.current) {
        socketRef.current.off('notification', handler);
      }
    };
  };

  return {
    socket: socketRef.current,
    isConnected,
    onlineUsers,
    // Actions
    sendPrivateMessage,
    sendTypingIndicator,
    markMessagesAsRead,
    notifyFriendRequest,
    notifyFriendRequestAccepted,
    notifyFriendRequestRejected,
    sendNotification,
    // Event listeners
    onPrivateMessage,
    onMessageSent,
    onTyping,
    onMessagesRead,
    onFriendRequest,
    onFriendRequestResponse,
    onFriendOnline,
    onFriendOffline,
    onNotification,
  };
}

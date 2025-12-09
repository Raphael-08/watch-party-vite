import { API_URL } from './config';

// Types
export interface User {
  $id: string;
  name: string;
  email: string;
}
export interface FriendRequest {
  id: number;
  requesterId: string;
  recipientId: string;
  requesterUsername: string;
  recipientUsername: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface Friend {
  id: number;
  userId: string;
  friendId: string;
  friendUsername: string;
  friendAvatar: string | null;
  createdAt: Date;
}

export interface PrivateChat {
  id: number;
  chatId: string;
  participant1Id: string;
  participant2Id: string;
  participant1Username: string;
  participant2Username: string;
  lastMessage: string | null;
  lastMessageTime: Date | null;
  lastMessageSender: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrivateChatMessage {
  id: number;
  chatId: string;
  senderId: string;
  senderUsername: string;
  senderAvatar: string | null;
  content: string;
  read: boolean;
  timestamp: Date;
}

export interface ScheduledWatchParty {
  id: number;
  organizerId: string;
  organizerUsername: string;
  title: string;
  description: string | null;
  scheduledTime: Date;
  videoUrl: string | null;
  invitedUserIds: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  roomCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: number;
  userId: string;
  type: 'friend_request' | 'message' | 'scheduled_party' | 'party_starting';
  title: string;
  message: string;
  relatedId: string | null;
  read: boolean;
  timestamp: Date;
}

// Friends API
export const friendsApi = {
  // Send friend request
  sendRequest: async (data: {
    requesterId: string;
    recipientId: string;
    requesterUsername: string;
    recipientUsername: string;
  }): Promise<{ requestId: number }> => {
    const response = await fetch(`${API_URL}/api/friends/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to send friend request');
    return response.json();
  },

  // Get received friend requests
  getReceivedRequests: async (userId: string): Promise<FriendRequest[]> => {
    const response = await fetch(`${API_URL}/api/friends/requests/received/${userId}`);
    if (!response.ok) throw new Error('Failed to get received requests');
    return response.json();
  },

  // Get sent friend requests
  getSentRequests: async (userId: string): Promise<FriendRequest[]> => {
    const response = await fetch(`${API_URL}/api/friends/requests/sent/${userId}`);
    if (!response.ok) throw new Error('Failed to get sent requests');
    return response.json();
  },

  // Accept friend request
  acceptRequest: async (requestId: number): Promise<{ message: string }> => {
    const response = await fetch(`${API_URL}/api/friends/accept/${requestId}`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to accept friend request');
    return response.json();
  },

  // Reject friend request
  rejectRequest: async (requestId: number): Promise<{ message: string }> => {
    const response = await fetch(`${API_URL}/api/friends/reject/${requestId}`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to reject friend request');
    return response.json();
  },

  // Cancel friend request
  cancelRequest: async (requestId: number): Promise<{ message: string }> => {
    const response = await fetch(`${API_URL}/api/friends/request/${requestId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to cancel friend request');
    return response.json();
  },

  // Get friends list
  getFriends: async (userId: string): Promise<Friend[]> => {
    const response = await fetch(`${API_URL}/api/friends/${userId}`);
    if (!response.ok) throw new Error('Failed to get friends');
    return response.json();
  },

  // Remove friend
  removeFriend: async (userId: string, friendId: string): Promise<{ message: string }> => {
    const response = await fetch(`${API_URL}/api/friends/${userId}/${friendId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to remove friend');
    return response.json();
  },
};

// Chats API
export const chatsApi = {
  // Get or create chat
  getOrCreateChat: async (data: {
    user1Id: string;
    user2Id: string;
    user1Username: string;
    user2Username: string;
  }): Promise<PrivateChat> => {
    const response = await fetch(`${API_URL}/api/chats/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to get or create chat');
    return response.json();
  },

  // Get user's chats
  getChats: async (userId: string): Promise<PrivateChat[]> => {
    const response = await fetch(`${API_URL}/api/chats/user/${userId}`);
    if (!response.ok) throw new Error('Failed to get chats');
    return response.json();
  },

  // Get chat messages
  getMessages: async (
    chatId: string,
    limit = 50,
    _offset = 0
  ): Promise<PrivateChatMessage[]> => {
    const response = await fetch(
      `${API_URL}/api/chats/${chatId}/messages?limit=${limit}`
    );
    if (!response.ok) throw new Error('Failed to get messages');
    return response.json();
  },

  // Send message (use Socket.IO for real-time, this is for fallback)
  sendMessage: async (data: {
    chatId: string;
    senderId: string;
    senderUsername: string;
    senderAvatar?: string;
    content: string;
    recipientId: string;
  }): Promise<PrivateChatMessage> => {
    const response = await fetch(`${API_URL}/api/chats/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to send message');
    return response.json();
  },

  // Mark messages as read
  markAsRead: async (chatId: string, recipientId: string): Promise<{ message: string }> => {
    const response = await fetch(`${API_URL}/api/chats/mark-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, recipientId }),
    });
    if (!response.ok) throw new Error('Failed to mark as read');
    return response.json();
  },

  // Get unread count for user
  getUnreadCount: async (userId: string): Promise<{ count: number }> => {
    const response = await fetch(`${API_URL}/api/chats/unread/${userId}`);
    if (!response.ok) throw new Error('Failed to get unread count');
    return response.json();
  },
};

// Schedule API
export const scheduleApi = {
  // Create scheduled party
  createParty: async (data: {
    organizerId: string;
    organizerUsername: string;
    title: string;
    description?: string;
    scheduledTime: Date;
    videoUrl?: string;
    invitedUserIds: string[];
  }): Promise<ScheduledWatchParty> => {
    const response = await fetch(`${API_URL}/api/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create scheduled party');
    return response.json();
  },

  // Get user's scheduled parties
  getParties: async (userId: string): Promise<ScheduledWatchParty[]> => {
    const response = await fetch(`${API_URL}/api/schedule/${userId}`);
    if (!response.ok) throw new Error('Failed to get scheduled parties');
    return response.json();
  },

  // Get upcoming parties
  getUpcoming: async (userId: string): Promise<ScheduledWatchParty[]> => {
    const response = await fetch(`${API_URL}/api/schedule/upcoming/${userId}`);
    if (!response.ok) throw new Error('Failed to get upcoming parties');
    return response.json();
  },

  // Get single party
  getParty: async (partyId: number): Promise<ScheduledWatchParty> => {
    const response = await fetch(`${API_URL}/api/schedule/party/${partyId}`);
    if (!response.ok) throw new Error('Failed to get party');
    return response.json();
  },

  // Update party
  updateParty: async (
    partyId: number,
    data: Partial<ScheduledWatchParty>
  ): Promise<{ message: string }> => {
    const response = await fetch(`${API_URL}/api/schedule/${partyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update party');
    return response.json();
  },

  // Update party status
  updateStatus: async (
    partyId: number,
    status: 'scheduled' | 'active' | 'completed' | 'cancelled',
    roomCode?: string
  ): Promise<{ message: string }> => {
    const response = await fetch(`${API_URL}/api/schedule/${partyId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, roomCode }),
    });
    if (!response.ok) throw new Error('Failed to update status');
    return response.json();
  },

  // Delete party
  deleteParty: async (partyId: number): Promise<{ message: string }> => {
    const response = await fetch(`${API_URL}/api/schedule/${partyId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete party');
    return response.json();
  },
};

// Users API
export const usersApi = {
  // Search users by username
  searchUsers: async (query: string): Promise<User[]> => {
    const response = await fetch(`${API_URL}/api/users/search?query=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search users');
    return response.json();
  },

  // Get user by ID
  getUser: async (userId: string): Promise<User> => {
    const response = await fetch(`${API_URL}/api/users/${userId}`);
    if (!response.ok) throw new Error('Failed to get user');
    return response.json();
  },
};

// Notifications API
export const notificationsApi = {
  // Get notifications
  getNotifications: async (
    userId: string,
    unreadOnly = false
  ): Promise<Notification[]> => {
    const url = unreadOnly
      ? `${API_URL}/api/notifications/user/${userId}?unreadOnly=true`
      : `${API_URL}/api/notifications/user/${userId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to get notifications');
    return response.json();
  },

  // Get unread count
  getUnreadCount: async (userId: string): Promise<{ count: number }> => {
    const response = await fetch(`${API_URL}/api/notifications/user/${userId}/unread/count`);
    if (!response.ok) throw new Error('Failed to get unread count');
    return response.json();
  },

  // Mark as read
  markAsRead: async (notificationId: number): Promise<{ message: string }> => {
    const response = await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
    if (!response.ok) throw new Error('Failed to mark notification as read');
    return response.json();
  },

  // Mark all as read
  markAllAsRead: async (userId: string): Promise<{ message: string }> => {
    const response = await fetch(`${API_URL}/api/notifications/user/${userId}/read-all`, {
      method: 'PUT',
    });
    if (!response.ok) throw new Error('Failed to mark all as read');
    return response.json();
  },

  // Delete notification
  deleteNotification: async (notificationId: number): Promise<{ message: string }> => {
    const response = await fetch(`${API_URL}/api/notifications/${notificationId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete notification');
    return response.json();
  },

  // Clear all notifications
  clearAll: async (userId: string): Promise<{ message: string }> => {
    const response = await fetch(`${API_URL}/api/notifications/user/${userId}/all`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to clear all notifications');
    return response.json();
  },
};

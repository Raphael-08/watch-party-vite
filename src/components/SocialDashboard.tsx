

import { useState } from 'react';
import FriendRequests from './FriendRequests';
import FriendsList from './FriendsList';
import AddFriend from './AddFriend';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import { chatsApi, type PrivateChat } from '@/lib/api';
import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SocialDashboardProps {
  currentUser: {
    $id: string;
    name: string;
    avatar?: string;
  };
  initialTab?: 'friends' | 'requests' | 'messages';
}

export default function SocialDashboard({ currentUser, initialTab = 'friends' }: SocialDashboardProps) {
  const [selectedChat, setSelectedChat] = useState<PrivateChat | null>(null);
  const [showChatWindow, setShowChatWindow] = useState(false);

  // Handle starting a chat from friends list
  const handleStartChat = async (friendId: string, friendUsername: string) => {
    try {
      // Get or create chat
      const chat = await chatsApi.getOrCreateChat({
        user1Id: currentUser.$id,
        user2Id: friendId,
        user1Username: currentUser.name,
        user2Username: friendUsername,
      });

      setSelectedChat(chat);
      setShowChatWindow(true);
    } catch (error) {
      console.error('Error starting chat:', error);
      toast.error('Failed to start chat');
    }
  };

  // Handle selecting a chat from chat list
  const handleSelectChat = (chat: PrivateChat) => {
    setSelectedChat(chat);
    setShowChatWindow(true);
  };

  // Handle back from chat window
  const handleBackFromChat = () => {
    setShowChatWindow(false);
    setSelectedChat(null);
  };

  // Render content based on initialTab
  const renderContent = () => {
    switch (initialTab) {
      case 'friends':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold">Friends</h1>
                <p className="text-muted-foreground">Manage your friends list</p>
              </div>
              <AddFriend currentUser={currentUser} />
            </div>
            <FriendsList currentUser={currentUser} onStartChat={handleStartChat} />
          </div>
        );

      case 'requests':
        return (
          <div className="space-y-4">
            <div>
              <h1 className="text-3xl font-bold">Friend Requests</h1>
              <p className="text-muted-foreground">Manage incoming and outgoing friend requests</p>
            </div>
            <FriendRequests currentUser={currentUser} />
          </div>
        );

      case 'messages':
        return (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-shrink-0 pb-4">
              <h1 className="text-3xl font-bold">Messages</h1>
              <p className="text-muted-foreground">Chat with your friends in real-time</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0 overflow-hidden">
              {/* Chat List */}
              <div className={`lg:col-span-1 h-full overflow-hidden ${showChatWindow ? 'hidden lg:block' : ''}`}>
                <ChatList
                  currentUser={currentUser}
                  onSelectChat={handleSelectChat}
                  selectedChatId={selectedChat?.chatId}
                />
              </div>

              {/* Chat Window */}
              <div className={`lg:col-span-2 h-full overflow-hidden ${showChatWindow ? '' : 'hidden lg:flex lg:items-center lg:justify-center'}`}>
                {selectedChat ? (
                  <ChatWindow
                    chat={selectedChat}
                    currentUser={currentUser}
                    onBack={handleBackFromChat}
                  />
                ) : (
                  <div className="hidden lg:flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MessageCircle className="h-16 w-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No conversation selected</p>
                    <p className="text-sm">Choose a chat to start messaging</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      {renderContent()}
    </div>
  );
}

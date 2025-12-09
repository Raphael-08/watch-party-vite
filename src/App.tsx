import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import LoginScreen from '@/components/LoginScreen';
import RoomLobby from '@/components/RoomLobby';
import { RoomScreen } from '@/modules/room';
import SettingsPanel from '@/components/SettingsPanel';
import SocialDashboard from '@/components/SocialDashboard';
import { LoadingScreen } from '@/components/LoadingScreen';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { API_URL } from '@/lib/config';
import { roomNameSchema } from '@/lib/validations';
import { sanitizeHTML } from '@/lib/security';
import { appwrite } from '@/lib/appwrite';
import TitleBar from '@/components/TitleBar';

type View = 'login' | 'lobby' | 'room' | 'social' | 'social-friends' | 'social-requests' | 'social-messages';

interface User {
  username: string;
  appwriteUser?: {
    $id: string;
    name: string;
    email: string;
  };
}

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('login');
  const [user, setUser] = useState<User | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [_isRoomCreator, setIsRoomCreator] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showCreateRoomDialog, setShowCreateRoomDialog] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomPassword, setNewRoomPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [pendingRoomCode, setPendingRoomCode] = useState<string>('');
  const [roomPassword, setRoomPassword] = useState('');
  const [refreshRooms, setRefreshRooms] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [titleBarVisible, setTitleBarVisible] = useState(false);
  const [recentRooms, setRecentRooms] = useState<any[]>([]);

  // Auto-hide title bar based on mouse position (except in room view)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (currentView === 'room') {
        // Force titlebar hidden in room view
        setTitleBarVisible(false);
        return;
      }
      
      if (e.clientY < 13) {
        setTitleBarVisible(true);
      } else if (e.clientY > 50) {
        setTitleBarVisible(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [currentView]);

  // Load recent rooms on mount and when refreshRooms changes
  useEffect(() => {
    setRecentRooms(getRecentRooms());
  }, [refreshRooms]);

  // Ensure dark mode is always enabled
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      const savedUsername = localStorage.getItem('watchPartyUsername');
      const savedAppwriteUser = localStorage.getItem('appwriteUser');

      // First check localStorage
      if (savedUsername) {
        const userData: User = {
          username: savedUsername,
        };

        if (savedAppwriteUser) {
          try {
            const appwriteData = JSON.parse(savedAppwriteUser);
            userData.appwriteUser = {
              $id: appwriteData.$id,
              name: appwriteData.name,
              email: appwriteData.email,
            };
          } catch (e) {
            console.error('Failed to parse Appwrite user:', e);
          }
        }

        // Verify Appwrite session is still valid
        try {
          const currentUser = await appwrite.getCurrentUser();
          if (currentUser) {
            console.log('✅ Appwrite session valid, restoring user:', currentUser.name);
            // Update stored user data with fresh session info
            localStorage.setItem('appwriteUser', JSON.stringify(currentUser));
            userData.appwriteUser = {
              $id: currentUser.$id,
              name: currentUser.name,
              email: currentUser.email,
            };
            setUser(userData);
            setCurrentView('lobby');
          }
        } catch (error) {
          console.log('⚠️ Appwrite session expired - clearing local data and forcing re-login');
          // Session expired - clear localStorage and force re-authentication
          // This prevents users from accessing features that require valid auth
          localStorage.removeItem('watchPartyUsername');
          localStorage.removeItem('appwriteUser');

          toast.error('Your session has expired. Please log in again.', {
            duration: 5000,
          });

          // Don't set user - keep them on login screen
          setUser(null);
          setCurrentView('login');
        }
      } else {
        console.log('⚠️ No saved session found');
      }

      // Mark loading as complete
      setIsLoading(false);
    };

    checkSession();
  }, []);

  const handleLogin = (username: string, appwriteUser?: any) => {
    console.log('📝 handleLogin called with:', { username, appwriteUser });
    const userData: User = { username };

    // If Appwrite user is provided, store it
    if (appwriteUser) {
      userData.appwriteUser = {
        $id: appwriteUser.$id,
        name: appwriteUser.name,
        email: appwriteUser.email,
      };
      localStorage.setItem('appwriteUser', JSON.stringify(appwriteUser));
    }

    setUser(userData);
    localStorage.setItem('watchPartyUsername', username);
    setCurrentView('lobby');
  };

  const handleLogout = async () => {
    try {
      // Try to logout from Appwrite if user is authenticated
      await appwrite.logout().catch(() => {
        // Ignore errors if user wasn't logged in with Appwrite
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    setUser(null);
    setCurrentView('login');
    localStorage.removeItem('watchPartyUsername');
    localStorage.removeItem('appwriteUser');
    setShowLogoutDialog(false);
    toast.success('Logged out successfully');
  };

  // Safe localStorage helper to handle parsing errors
  const getRecentRooms = (): any[] => {
    try {
      const stored = localStorage.getItem('recentRooms');
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Failed to parse recent rooms:', e);
      return [];
    }
  };

  const saveRecentRooms = (rooms: any[]) => {
    try {
      localStorage.setItem('recentRooms', JSON.stringify(rooms));
    } catch (e) {
      console.error('Failed to save recent rooms:', e);
    }
  };

  const generateRoomCode = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateRoom = () => {
    setShowCreateRoomDialog(true);
  };

  const confirmCreateRoom = () => {
    console.log('🎬 Creating room...', { user, newRoomName });

    // Validate and sanitize room name
    const sanitizedName = sanitizeHTML(newRoomName);
    const validation = roomNameSchema.safeParse(sanitizedName);

    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return;
    }

    const newRoomCode = generateRoomCode();
    console.log('🔑 Generated room code:', newRoomCode);

    setRoomCode(newRoomCode);
    setIsRoomCreator(true);

    // Store password for room creation (will be sent with join-room event)
    if (newRoomPassword) {
      sessionStorage.setItem(`room_password_${newRoomCode}`, newRoomPassword);
    }

    console.log('✅ Setting view to room');
    setCurrentView('room');

    // Save to recent rooms with creator flag and name
    const recentRooms = getRecentRooms();
    const newRoom = {
      code: newRoomCode,
      name: sanitizedName || `Room ${newRoomCode}`,
      createdAt: new Date().toISOString(),
      participants: 1,
      isActive: true,
      createdByMe: true,
    };
    recentRooms.unshift(newRoom);
    if (recentRooms.length > 10) recentRooms.pop();
    saveRecentRooms(recentRooms);

    // Update state immediately and trigger refresh
    setRecentRooms([...recentRooms]);
    setRefreshRooms(prev => prev + 1);

    // Reset dialog
    setShowCreateRoomDialog(false);
    setNewRoomName('');
    setNewRoomPassword('');
    toast.success(`Room ${newRoomCode} created!`);
  };

  const handleJoinRoom = async (code: string) => {
    // Check if room exists and requires password
    try {
      const response = await fetch(`${API_URL}/api/rooms/${code}/exists`);
      const data = await response.json();

      if (!data.exists) {
        toast.error(`Room ${code} doesn't exist`);
        return;
      }

      // If room has password, show password dialog
      if (data.hasPassword) {
        setPendingRoomCode(code);
        setShowPasswordDialog(true);
        return;
      }

      // No password required, join directly
      joinRoomDirectly(code);
    } catch (error) {
      console.error('Error checking room:', error);
      toast.error('Failed to check room');
    }
  };

  const joinRoomDirectly = (code: string, password?: string) => {
    setRoomCode(code);

    // Check if this room was created by this user
    const recentRooms = getRecentRooms();
    const existingRoom = recentRooms.find((r: any) => r.code === code);
    const wasCreatedByMe = existingRoom?.createdByMe === true;

    setIsRoomCreator(wasCreatedByMe);

    // Store password for join-room event if provided
    if (password) {
      sessionStorage.setItem(`room_password_${code}`, password);
    }

    setIsSidebarOpen(false);
    setCurrentView('room');

    // Update recent rooms
    const existingIndex = recentRooms.findIndex((r: any) => r.code === code);

    if (existingIndex >= 0) {
      recentRooms[existingIndex].lastJoined = new Date().toISOString();
    } else {
      const newRoom = {
        code,
        lastJoined: new Date().toISOString(),
        participants: 1,
        isActive: true,
        createdByMe: false,
      };
      recentRooms.unshift(newRoom);
      if (recentRooms.length > 10) recentRooms.pop();
    }

    saveRecentRooms(recentRooms);
    
    // Update state immediately and trigger refresh
    setRecentRooms([...recentRooms]);
    setRefreshRooms(prev => prev + 1);
  };

  const confirmJoinWithPassword = async () => {
    if (!roomPassword.trim()) {
      toast.error('Please enter a password');
      return;
    }

    try {
      // Verify password
      const response = await fetch(`${API_URL}/api/rooms/${pendingRoomCode}/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: roomPassword }),
      });

      const data = await response.json();

      if (data.valid) {
        setShowPasswordDialog(false);
        setRoomPassword('');
        joinRoomDirectly(pendingRoomCode, roomPassword);
        toast.success('Joined room successfully!');
      } else {
        toast.error('Incorrect password');
      }
    } catch (error) {
      console.error('Error verifying password:', error);
      toast.error('Failed to verify password');
    }
  };

  const handleLeaveRoom = () => {
    setRoomCode('');
    setIsRoomCreator(false);
    setIsSidebarOpen(false);
    setCurrentView('lobby');
  };

  const handleDeleteRoom = async (code: string) => {
    console.log('[App] handleDeleteRoom called for:', code);
    try {
      // Call backend to delete the room and terminate Hyperbeam session
      console.log('[App] Sending DELETE request to:', `${API_URL}/api/rooms/${code}`);
      const response = await fetch(`${API_URL}/api/rooms/${code}`, {
        method: 'DELETE',
      });

      console.log('[App] DELETE response status:', response.status);
      if (!response.ok) {
        console.error('Failed to delete room from backend');
        toast.error('Failed to delete room from server');
      } else {
        console.log('[App] Room deleted successfully from backend');
      }
    } catch (error) {
      console.error('Error deleting room:', error);
      toast.error('Error deleting room');
    }

    // Remove from recent rooms in localStorage
    const recentRooms = getRecentRooms();
    console.log('[App] Current recent rooms:', recentRooms);
    const updatedRooms = recentRooms.filter((r: any) => r.code !== code);
    console.log('[App] Updated recent rooms after filter:', updatedRooms);
    saveRecentRooms(updatedRooms);
    console.log('[App] Saved to localStorage');

    // If we're currently in this room, leave it
    if (roomCode === code) {
      handleLeaveRoom();
    }

    // Update state immediately and trigger refresh
    setRecentRooms([...updatedRooms]);
    setRefreshRooms(prev => prev + 1);
    toast.success('Room deleted');
  };

  // Show loading state
  if (isLoading) {
    return <LoadingScreen message="Initializing app..." />;
  }

  // Show login screen without sidebar
  if (currentView === 'login') {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Show app with sidebar for logged-in users
  return (
    <>
      <SidebarProvider
        open={currentView === 'room' ? isSidebarOpen : undefined}
        onOpenChange={currentView === 'room' ? setIsSidebarOpen : undefined}
        defaultOpen={currentView !== 'room'}
      >
        <AppSidebar
          key={refreshRooms}
          user={user ? {
            name: user.username,
            email: user.appwriteUser?.email,
            avatar: undefined
          } : undefined}
          recentRooms={recentRooms}
          currentView={currentView}
          className={currentView === 'room' ? 'fixed left-0 top-0 h-screen bottom-0 z-40' : ''}
          style={{
            top: currentView === 'room' ? '0px' : (titleBarVisible ? '32px' : '8px'),
            height: currentView === 'room' ? '100vh' : (titleBarVisible ? 'calc(100vh - 32px)' : 'calc(100vh - 8px)')
          }}
          onNavigate={(view) => {
            if (view === 'lobby') {
              handleLeaveRoom();
            } else if (view === 'social' || view === 'social-friends' || view === 'social-requests' || view === 'social-messages') {
              setCurrentView(view);
            }
          }}
          onJoinRoom={handleJoinRoom}
          onDeleteRoom={handleDeleteRoom}
          onLogout={() => setShowLogoutDialog(true)}
          onOpenSettings={() => setShowSettings(true)}
        />
      
      {/* Sidebar overlay for room view */}
      {currentView === 'room' && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* TitleBar - Hidden in room view, auto-hide in other views */}
      {currentView !== 'room' && <TitleBar isVisible={titleBarVisible} />}

      <SidebarInset className="overflow-hidden flex flex-col transition-all duration-300 ease-in-out" style={{ marginTop: currentView === 'room' ? '0px' : (titleBarVisible ? '32px' : '8px') }}>
        {/* Header - Show in lobby and social views */}
        {(currentView === 'lobby' || currentView.startsWith('social')) && (
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">Watch Party</h1>
            </div>
          </header>
        )}

        <div className={`flex flex-1 flex-col min-h-0 ${currentView === 'lobby' ? 'p-4' : ''} ${currentView.startsWith('social') ? 'overflow-hidden' : ''}`}>
          {currentView === 'lobby' && user && (
            <RoomLobby
              username={user.username}
              onCreateRoom={handleCreateRoom}
              onJoinRoom={handleJoinRoom}
              onLogout={handleLogout}
              onDeleteRoom={handleDeleteRoom}
            />
          )}

          {currentView.startsWith('social') && user && (
            <>
              {user.appwriteUser?.$id ? (
                <SocialDashboard
                  currentUser={{
                    $id: user.appwriteUser.$id,
                    name: user.username,
                    avatar: undefined,
                  }}
                  initialTab={
                    currentView === 'social-friends' ? 'friends' :
                    currentView === 'social-requests' ? 'requests' :
                    currentView === 'social-messages' ? 'messages' :
                    'friends'
                  }
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <div className="max-w-md space-y-4">
                    <h2 className="text-2xl font-bold">Login Required</h2>
                    <p className="text-muted-foreground">
                      Social features require an account. Please log out and sign in to access friends, messaging, and more.
                    </p>
                    <button
                      onClick={() => setShowLogoutDialog(true)}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                    >
                      Sign Out & Login
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {currentView === 'room' && (() => {
            console.log('🎯 Room view check:', {
              currentView,
              hasUser: !!user,
              hasRoomCode: !!roomCode,
              hasAppwriteUser: !!user?.appwriteUser,
              user
            });

            if (!user || !roomCode) {
              return (
                <div className="flex items-center justify-center h-screen">
                  <p className="text-muted-foreground">Missing user or room code</p>
                </div>
              );
            }

            if (!user.appwriteUser) {
              return (
                <div className="flex items-center justify-center h-screen">
                  <p className="text-muted-foreground">Please log in with Appwrite to create or join rooms</p>
                </div>
              );
            }

            return (
              <RoomScreen
                roomId={roomCode}
                userId={user.appwriteUser.$id}
                username={user.username}
                token={user.appwriteUser.$id}
                wsUrl={API_URL}
                onLeaveRoom={handleLeaveRoom}
                onOpenSettings={() => setShowSettings(true)}
              />
            );
          })()}
        </div>
      </SidebarInset>

      {/* Settings Sheet */}
      <Sheet open={showSettings} onOpenChange={setShowSettings}>
        <SheetContent side="right" className="w-full sm:w-[480px] flex flex-col">
          <SheetHeader>
            <SheetTitle>Settings</SheetTitle>
          </SheetHeader>
          <SettingsPanel />
        </SheetContent>
      </Sheet>

      {/* Create Room Dialog */}
      <AlertDialog open={showCreateRoomDialog} onOpenChange={setShowCreateRoomDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Watch Room</AlertDialogTitle>
            <AlertDialogDescription>
              Give your room a name and optionally set a password.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="roomName" className="text-sm font-medium">
                Room Name (Optional)
              </Label>
              <Input
                id="roomName"
                placeholder="e.g., Movie Night 🎬"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="mt-2"
                maxLength={30}
              />
            </div>
            <div>
              <Label htmlFor="roomPassword" className="text-sm font-medium">
                Password (Optional)
              </Label>
              <Input
                id="roomPassword"
                type="password"
                placeholder="Enter password to protect room"
                value={newRoomPassword}
                onChange={(e) => setNewRoomPassword(e.target.value)}
                className="mt-2"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Set a password to make this a private room
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Your room will have a unique 6-character code that will be generated automatically.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setNewRoomName('');
              setNewRoomPassword('');
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCreateRoom}>
              Create Room
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password Dialog for Joining Protected Room */}
      <AlertDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Password Required</AlertDialogTitle>
            <AlertDialogDescription>
              This room is password protected. Please enter the password to join.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="roomPasswordInput" className="text-sm font-medium">
              Room Password
            </Label>
            <Input
              id="roomPasswordInput"
              type="password"
              placeholder="Enter password"
              value={roomPassword}
              onChange={(e) => setRoomPassword(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  confirmJoinWithPassword();
                }
              }}
              className="mt-2"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setRoomPassword('');
              setPendingRoomCode('');
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmJoinWithPassword}>
              Join Room
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out? You'll need to log in again to access your rooms.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </SidebarProvider>
    </>
  );
}

export default App;



import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus, LogIn, Copy, Trash2, Activity } from 'lucide-react';
import { toast } from 'sonner';
import SettingsPanel from './SettingsPanel';
import { API_URL } from '@/lib/config';
import { roomCodeSchema } from '@/lib/validations';
import { sanitizeRoomCode } from '@/lib/security';
import { RoomListSkeleton } from '@/components/skeletons/RoomSkeleton';

interface RoomLobbyProps {
  username: string;
  onCreateRoom: () => void;
  onJoinRoom: (roomCode: string) => void;
  onLogout: () => void;
  onDeleteRoom?: (roomCode: string) => void;
}

interface RecentRoom {
  code: string;
  name: string;
  lastJoined: string;
}

export default function RoomLobby({ username: _username, onCreateRoom, onJoinRoom, onLogout: _onLogout, onDeleteRoom }: RoomLobbyProps) {
  const [roomCode, setRoomCode] = useState('');
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedRooms = localStorage.getItem('recentRooms');
    if (savedRooms) {
      setRecentRooms(JSON.parse(savedRooms));
    }
    setIsLoading(false);
  }, []);

  const handleJoinRoom = async () => {
    if (roomCode.length !== 6) return;

    // Sanitize and validate room code
    const sanitized = sanitizeRoomCode(roomCode);
    if (!sanitized) {
      setJoinError('Invalid room code format');
      toast.error('Invalid room code format');
      return;
    }

    const validation = roomCodeSchema.safeParse(sanitized);
    if (!validation.success) {
      setJoinError(validation.error.issues[0].message);
      toast.error(validation.error.issues[0].message);
      return;
    }

    const code = sanitized;
    setJoinError(null);

    try {
      // Check if room exists first
      const response = await fetch(`${API_URL}/api/rooms/${code}/exists`);
      const data = await response.json();

      if (!data.exists) {
        setJoinError(`Room ${code} doesn't exist. Please check the code and try again.`);
        toast.error(`Room ${code} doesn't exist`);
        return;
      }

      // Room exists, proceed to join
      toast.success(`Joined room ${code}`);
      onJoinRoom(code);
    } catch (error) {
      console.error('Error checking room:', error);
      setJoinError('Failed to check room. Please try again.');
      toast.error('Failed to join room');
    }
  };

  const copyRoomCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Room code copied!');
  };

  const removeRoom = async (code: string) => {
    // Call parent's delete handler if provided (will call backend)
    if (onDeleteRoom) {
      await onDeleteRoom(code);
    }

    // Update local state
    const updated = recentRooms.filter((r) => r.code !== code);
    setRecentRooms(updated);
  };


  return (
    <div className="flex-1">
      {/* Main Content */}
      <div className="max-w-6xl mx-auto">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-3">Start Watching Together</h1>
          <p className="text-muted-foreground text-lg">
            Create a room or join one with a code
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Create Room Card */}
          <Card className="border-border/40 hover:border-primary/50 transition-all hover:shadow-lg">
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Plus className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Create a Room</CardTitle>
              <CardDescription>
                Start a new watch party and invite your friends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={onCreateRoom} className="w-full h-11" size="lg">
                <Plus className="w-5 h-5 mr-2" />
                Create Room
              </Button>
            </CardContent>
          </Card>

          {/* Join Room Card */}
          <Card className="border-border/40 hover:border-accent/50 transition-all hover:shadow-lg">
            <CardHeader>
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                <LogIn className="w-6 h-6 text-accent" />
              </div>
              <CardTitle>Join a Room</CardTitle>
              <CardDescription>
                Enter a 6-character room code to join
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={roomCode}
                    onChange={(e) => {
                      setRoomCode(e.target.value.toUpperCase());
                      setJoinError(null);
                    }}
                    placeholder="ABC123"
                    maxLength={6}
                    className="h-11 font-mono text-lg tracking-wider"
                  />
                  <Button
                    onClick={handleJoinRoom}
                    disabled={roomCode.length !== 6}
                    size="lg"
                    className="h-11"
                  >
                    Join
                  </Button>
                </div>
                {joinError && (
                  <p className="text-sm text-destructive">{joinError}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Rooms */}
        {isLoading ? (
          <div>
            <h2 className="text-2xl font-semibold mb-6">Your Recent Rooms</h2>
            <RoomListSkeleton />
          </div>
        ) : recentRooms.length > 0 ? (
          <div>
            <h2 className="text-2xl font-semibold mb-6">Your Recent Rooms</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recentRooms.map((room) => (
                <Card key={room.code} className="border-border/40 hover:border-primary/30 transition-all">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base">{room.name}</CardTitle>
                        <CardDescription className="font-mono text-xs mt-1">
                          {room.code}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        <Activity className="w-3 h-3 mr-1" />
                        {room.lastJoined}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => onJoinRoom(room.code)}
                        variant="default"
                        className="flex-1"
                        size="sm"
                      >
                        Rejoin
                      </Button>
                      <Button
                        onClick={() => copyRoomCode(room.code)}
                        variant="outline"
                        size="sm"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => removeRoom(room.code)}
                        variant="ghost"
                        size="sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No recent rooms</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Create a new room or join one with a code to get started
            </p>
          </div>
        )}
      </div>

      {/* Settings Sheet */}
      <Sheet open={showSettings} onOpenChange={setShowSettings}>
        <SheetContent side="right" className="w-full sm:w-[480px] [&>button]:focus:ring-0 [&>button]:focus:ring-offset-0">
          <SheetHeader>
            <SheetTitle>Settings</SheetTitle>
          </SheetHeader>
          <SettingsPanel />
        </SheetContent>
      </Sheet>
    </div>
  );
}

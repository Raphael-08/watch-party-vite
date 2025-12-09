import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { WebSocketClient } from '@/lib/websocket';
import { appwrite } from '@/lib/appwrite';
import { MultiTabGuard } from '@/lib/multi-tab-guard';
import { getHyperbeamSettings, toSessionConfig } from '@/lib/hyperbeam';
import { toast } from 'sonner';
import type {
  User,
  ServerMessage,
  RoomJoinedPayload,
  RoomUserJoinedPayload,
  RoomUserLeftPayload,
  SyncStatePayload,
} from '@/types/messages';
import { WSEventTypes } from '@/types/messages';

interface RoomState {
  roomId: string;
  userId: string;
  username: string;
  users: User[];
  hyperbeamSessionUrl: string | null;
  isConnected: boolean;
}

interface RoomContextValue extends RoomState {
  wsClient: WebSocketClient | null;
  messageHistory: any[];
  sendChatMessage: (message: string) => void;
  sendCursorMove: (x: number, y: number) => void;
  leaveRoom: () => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

interface RoomProviderProps {
  roomId: string;
  userId: string;
  username: string;
  wsUrl: string;
  initialHyperbeamUrl?: string;
  children: ReactNode;
}

/**
 * RoomProvider - Manages room state and WebSocket connection
 *
 * Provides room state, user list, and WebSocket communication methods
 * to child components via context.
 */
export function RoomProvider({ roomId, userId, username, wsUrl, initialHyperbeamUrl, children }: RoomProviderProps) {
  const [wsClient, setWsClient] = useState<WebSocketClient | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [messageHistory, setMessageHistory] = useState<any[]>([]);
  const [hyperbeamSessionUrl, setHyperbeamSessionUrl] = useState<string | null>(initialHyperbeamUrl || null);
  const [isConnected, setIsConnected] = useState(false);
  const sessionCreationInitiated = useRef(false);
  const roomJoinedReceived = useRef(false);
  const multiTabGuardRef = useRef<MultiTabGuard | null>(null);

  useEffect(() => {
    let client: WebSocketClient | null = null;

    async function initializeWebSocket() {
      try {
        // CRITICAL: Multi-tab protection
        const tabGuard = new MultiTabGuard(roomId, () => {
          toast.error('This room is already open in another tab. Please close the other tab first.', {
            duration: 10000,
          });
          // Disconnect this tab's connection
          if (client) {
            client.disconnect();
          }
        });

        multiTabGuardRef.current = tabGuard;

        // Wait briefly to check for conflicts
        await new Promise(resolve => setTimeout(resolve, 150));

        if (!tabGuard.active) {
          console.error('[Room] Multi-tab conflict detected - aborting connection');
          return;
        }

        // Get JWT token from Appwrite
        const token = await appwrite.getSessionJWT();
        if (!token) {
          console.error('[Room] Failed to get authentication token');
          tabGuard.release();
          return;
        }

        // Create WebSocket client with auth token
        client = new WebSocketClient(wsUrl, token);
        
        // Set up message listener BEFORE connecting and sending events
        client.onMessage(async (message: ServerMessage) => {
          console.log('[Room] 📨 Received message:', message.type);
          
          switch (message.type) {
            case WSEventTypes.ROOM_JOINED: {
              const payload = message.payload as RoomJoinedPayload;
              console.log('[Room] ✅ Room joined successfully:', payload);
              setUsers(payload.users);
              roomJoinedReceived.current = true;

              // Now that room is confirmed to exist, create Hyperbeam session
              if (!initialHyperbeamUrl && !sessionCreationInitiated.current) {
                sessionCreationInitiated.current = true;
                console.log('[Room] Room confirmed - creating Hyperbeam session...');

                try {
                  // Load user's Hyperbeam preferences and API mode
                  const userSettings = getHyperbeamSettings();
                  const apiMode = localStorage.getItem('hyperbeamApiMode') || 'test';
                  const useProduction = apiMode === 'production';
                  console.log('[Room] Using Hyperbeam API mode:', apiMode);

                  // Convert settings to backend format (will strip restricted features in test mode)
                  const config = toSessionConfig(userSettings, roomId, useProduction);
                  console.log('[Room] Using Hyperbeam preferences:', userSettings);

                  const requestBody = {
                    roomCode: roomId,
                    config: config,
                    useProduction: useProduction
                  };

                  const response = await fetch(`${wsUrl}/api/hyperbeam/session`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                  });

                  if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[Room] Hyperbeam API error:', response.status, response.statusText, errorText);
                    return;
                  }

                  const data = await response.json();
                  if (data.embedUrl) {
                    console.log('[Room] ✅ Hyperbeam session created:', data.embedUrl);
                    setHyperbeamSessionUrl(data.embedUrl);
                  } else {
                    console.error('[Room] No embedUrl in response:', data);
                  }
                } catch (error) {
                  console.error('[Room] Failed to create Hyperbeam session:', error);
                }
              }
              break;
            }

            case WSEventTypes.ROOM_USER_JOINED: {
              const payload = message.payload as RoomUserJoinedPayload;
              setUsers((prev) => [...prev, {
                userId: payload.userId,
                username: payload.username,
                role: payload.role,
              }]);
              break;
            }

            case WSEventTypes.ROOM_USER_LEFT: {
              const payload = message.payload as RoomUserLeftPayload;
              setUsers((prev) => prev.filter((u) => u.userId !== payload.userId));
              break;
            }

            case WSEventTypes.SYNC_STATE: {
              const payload = message.payload as SyncStatePayload;
              setUsers(payload.users);
              if (payload.hyperbeamSessionUrl) {
                setHyperbeamSessionUrl(payload.hyperbeamSessionUrl);
              }
              break;
            }

            case WSEventTypes.CHAT_MESSAGE_BROADCAST: {
              // Chat messages will be handled by chat module
              break;
            }

            case WSEventTypes.CURSOR_MOVE_BROADCAST: {
              // Cursor moves will be handled by overlay module
              break;
            }

            case WSEventTypes.ERROR: {
              console.error('[Room] Error:', message.payload);
              break;
            }

            // Handle backend-specific events
            case 'room-users': {
              // Backend sends room-users with list of participants
              console.log('[Room] 📨 Received room-users event:', message.payload);
              const participants = message.payload as any[];
              if (Array.isArray(participants)) {
                const mappedUsers = participants.map((p: any) => ({
                  userId: p.userId || p.userID,
                  username: p.username,
                  role: p.role,
                }));
                console.log('[Room] ✅ Setting users array:', mappedUsers);
                setUsers(mappedUsers);
              } else {
                console.log('[Room] ⚠️ room-users payload is not an array:', participants);
              }
              break;
            }

            case 'participant-count': {
              break;
            }

            case 'message-history': {
              const messages = message.payload as any[];
              if (Array.isArray(messages)) {
                setMessageHistory(messages);
              }
              break;
            }
          }
        });

        setWsClient(client);

        // Connect to WebSocket
        console.log('[Room] Calling connect()...');
        await client.connect();
        console.log('[Room] ✅ Connect promise resolved');
        console.log('[Room] Socket connected:', client.isConnected);
        setIsConnected(true);

        // Wait a moment for connection to fully establish
        console.log('[Room] Waiting 500ms for connection to stabilize...');
        await new Promise(resolve => setTimeout(resolve, 500));

        // Send join-room event to backend (username and userId come from JWT now)
        // Backend will emit 'room-joined' when the room is successfully created/joined
        console.log('[Room] Sending join-room event with roomCode:', roomId);
        console.log('[Room] Socket still connected:', client.isConnected);
        client.send('join-room', {
          roomCode: roomId,
        });
        console.log('[Room] ✅ join-room event sent, waiting for room-joined confirmation...');
      } catch (error) {
        console.error('[Room] Failed to connect:', error);
      }
    }

    initializeWebSocket();

    return () => {
      if (client) {
        client.disconnect();
      }
      // Release multi-tab guard
      if (multiTabGuardRef.current) {
        multiTabGuardRef.current.release();
        multiTabGuardRef.current = null;
      }
    };
  }, [roomId, userId, username, wsUrl, initialHyperbeamUrl]);

  const sendChatMessage = (message: string) => {
    if (!wsClient) return;
    // Backend expects 'send-message' event with roomCode field
    wsClient.send('send-message', {
      roomCode: roomId,
      username,
      message,
    });
  };

  const sendCursorMove = (x: number, y: number) => {
    if (!wsClient) return;
    wsClient.send(WSEventTypes.CURSOR_MOVE, {
      roomId,
      userId,
      x,
      y,
    });
  };

  const leaveRoom = () => {
    if (wsClient && wsClient.isConnected) {
      wsClient.send(WSEventTypes.ROOM_LEAVE, {
        roomId,
        userId,
      });
    }
  };

  const value: RoomContextValue = {
    roomId,
    userId,
    username,
    users,
    messageHistory,
    hyperbeamSessionUrl,
    isConnected,
    wsClient,
    sendChatMessage,
    sendCursorMove,
    leaveRoom,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

/**
 * useRoom - Hook to access room context
 */
export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within RoomProvider');
  }
  return context;
}

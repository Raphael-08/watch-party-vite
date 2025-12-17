import { io, Socket } from 'socket.io-client'
import type { ServerMessage } from '@/types/messages'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export class WebSocketClient {
  private socket: Socket
  private messageHandlers: Map<string, (payload: any) => void> = new Map()
  private messageCallbacks: Array<(message: ServerMessage) => void> = []
  private disconnectCallbacks: Array<(reason: string) => void> = []

  constructor(wsUrl: string, token?: string) {
    // wsUrl can be the full URL or just the base URL
    const url = wsUrl || API_URL

    // For Socket.IO connections with authentication
    this.socket = io(url, {
      auth: {
        token: token || '', // Send JWT token for authentication
      },
      transports: ['websocket'], // WebSocket only (faster, no polling fallback)
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000, // 10 second connection timeout
      autoConnect: false, // Don't auto-connect, we'll connect manually
      upgrade: false, // Skip upgrade process since we're WebSocket-only
      rememberUpgrade: true,
    })

    // Setup event listeners
    this.socket.on('connect', () => {
    })

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocketClient] Connection error:', error);
    })

    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocketClient] Disconnected:', reason);
      // Notify all disconnect callbacks
      this.disconnectCallbacks.forEach(cb => {
        try {
          cb(reason);
        } catch (error) {
          console.error('[WebSocketClient] Error in disconnect callback:', error);
        }
      });
    })

    // Setup generic message handler
    this.setupMessageHandlers()
  }

  private setupMessageHandlers() {
    // Note: Individual event handlers are set up via the on() method
    // The onMessage() method sets up a global onAny listener for all events
    // We don't set up a duplicate onAny listener here to avoid double processing
  }

  connect() {
    return new Promise<void>((resolve, reject) => {
      // If already connected, resolve immediately
      if (this.socket.connected) {
        resolve()
        return
      }

      // Set up one-time listeners for this connection attempt
      const onConnect = () => {
        cleanup()
        resolve()
      }

      const onError = (error: Error) => {
        console.error('[WebSocketClient] Connect error event:', error);
        cleanup()
        reject(error)
      }

      const cleanup = () => {
        this.socket.off('connect', onConnect)
        this.socket.off('connect_error', onError)
      }

      this.socket.once('connect', onConnect)
      this.socket.once('connect_error', onError)

      // Initiate connection
      this.socket.connect()
    })
  }

  private onAnyListener: ((eventName: string, payload: any) => void) | null = null

  onMessage(callback: (message: ServerMessage) => void) {
    // Register callback for all message types
    this.messageCallbacks.push(callback)

    // Set up listener to call all registered callbacks (ONLY ONCE)
    if (!this.onAnyListener) {
      this.onAnyListener = (eventName: string, payload: any) => {
        // Create message object once
        const message: ServerMessage = {
          type: eventName,
          payload: payload
        }

        // Call all registered callbacks with the same message object
        // This prevents duplicate processing since each callback is only called once per event
        this.messageCallbacks.forEach(cb => {
          try {
            cb(message)
          } catch (error) {
            console.error('[WebSocketClient] Error in message callback:', error)
          }
        })
      }

      this.socket.onAny(this.onAnyListener)
    }

    // Return unsubscribe function
    return () => {
      const index = this.messageCallbacks.indexOf(callback)
      if (index > -1) {
        this.messageCallbacks.splice(index, 1)
      }

      // If no more callbacks, remove the listener
      if (this.messageCallbacks.length === 0 && this.onAnyListener) {
        this.socket.offAny(this.onAnyListener)
        this.onAnyListener = null
      }
    }
  }

  on(event: string, callback: (payload: any) => void) {
    this.messageHandlers.set(event, callback)
    this.socket.on(event, callback)
    // Return unsubscribe function
    return () => {
      this.messageHandlers.delete(event)
      this.socket.off(event, callback)
    }
  }

  send(type: string, payload?: any) {
    // Skip logging for high-frequency cursor events
    if (type !== 'cursor-moved') {
      console.log('[WebSocketClient] 📤 Sending event:', type, 'connected:', this.socket.connected, 'payload:', payload);
    }
    if (!this.socket.connected) {
      console.error('[WebSocketClient] ❌ Cannot send - socket not connected!');
      return;
    }
    this.socket.emit(type, payload)
    if (type !== 'cursor-moved') {
      console.log('[WebSocketClient] ✅ Event emitted');
    }
  }

  emit(event: string, payload?: any) {
    this.socket.emit(event, payload)
  }

  close() {
    this.socket.disconnect()
  }

  disconnect() {
    this.socket.disconnect()
  }

  get isConnected(): boolean {
    return this.socket.connected
  }

  onDisconnect(callback: (reason: string) => void) {
    this.disconnectCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.disconnectCallbacks.indexOf(callback);
      if (index > -1) {
        this.disconnectCallbacks.splice(index, 1);
      }
    };
  }

  getSocket(): Socket {
    return this.socket
  }
}

export function createWebSocketConnection(roomId: string, userId: string, username: string, token: string): Socket {
  const socket = io(API_URL, {
    auth: { token },
    query: { roomId, userId, username },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
  })

  return socket
}

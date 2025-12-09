/**
 * Multi-tab guard using BroadcastChannel API
 * Prevents multiple tabs from connecting to the same room simultaneously
 */

const CHANNEL_NAME = 'watch-party-room-guard';
const HEARTBEAT_INTERVAL = 2000; // 2 seconds

export class MultiTabGuard {
  private channel: BroadcastChannel | null = null;
  private roomId: string;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat: number = 0;
  private isActive: boolean = false;
  private onConflict: (() => void) | null = null;

  constructor(roomId: string, onConflict?: () => void) {
    this.roomId = roomId;
    this.onConflict = onConflict || null;

    // Check if BroadcastChannel is supported
    if (typeof BroadcastChannel === 'undefined') {
      console.warn('[MultiTabGuard] BroadcastChannel not supported - multi-tab protection disabled');
      this.isActive = false;
      return;
    }

    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.setupListeners();
    this.checkForExistingTab();
    this.startHeartbeat();
  }

  private setupListeners() {
    if (!this.channel) return;

    this.channel.onmessage = (event) => {
      const { type, roomId, timestamp } = event.data;

      // Only respond to messages for the same room
      if (roomId !== this.roomId) return;

      switch (type) {
        case 'ping':
          // Another tab is checking if we exist
          if (this.isActive) {
            this.channel?.postMessage({
              type: 'pong',
              roomId: this.roomId,
              timestamp: Date.now(),
            });
          }
          break;

        case 'pong':
          // Another tab exists and is active!
          if (timestamp > this.lastHeartbeat) {
            console.error('[MultiTabGuard] Detected active tab for room:', this.roomId);
            this.handleConflict();
          }
          break;

        case 'heartbeat':
          // Another tab is alive
          if (this.isActive && timestamp > this.lastHeartbeat) {
            console.error('[MultiTabGuard] Detected concurrent heartbeat for room:', this.roomId);
            this.handleConflict();
          }
          break;

        case 'claim':
          // Another tab is claiming this room
          if (this.isActive) {
            console.error('[MultiTabGuard] Another tab claimed the room:', this.roomId);
            this.handleConflict();
          }
          break;

        case 'release':
          // Another tab released the room
          console.log('[MultiTabGuard] Room released by another tab:', this.roomId);
          break;
      }
    };
  }

  private checkForExistingTab() {
    if (!this.channel) {
      this.isActive = true;
      return;
    }

    // Send ping and wait for response
    this.channel.postMessage({
      type: 'ping',
      roomId: this.roomId,
      timestamp: Date.now(),
    });

    // Wait 100ms for response
    setTimeout(() => {
      if (!this.isActive) {
        // No response, claim the room
        this.claim();
      }
    }, 100);
  }

  private claim() {
    if (!this.channel) {
      this.isActive = true;
      return;
    }

    this.channel.postMessage({
      type: 'claim',
      roomId: this.roomId,
      timestamp: Date.now(),
    });

    this.isActive = true;
    console.log('[MultiTabGuard] Claimed room:', this.roomId);
  }

  private startHeartbeat() {
    if (!this.channel) return;

    this.heartbeatInterval = setInterval(() => {
      if (!this.isActive) return;

      this.lastHeartbeat = Date.now();
      this.channel?.postMessage({
        type: 'heartbeat',
        roomId: this.roomId,
        timestamp: this.lastHeartbeat,
      });
    }, HEARTBEAT_INTERVAL);
  }

  private handleConflict() {
    console.error('[MultiTabGuard] CONFLICT: Multiple tabs detected for room:', this.roomId);

    // Deactivate this tab
    this.isActive = false;

    // Call conflict handler
    if (this.onConflict) {
      this.onConflict();
    }
  }

  public release() {
    if (!this.channel) return;

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Send release message
    if (this.isActive) {
      this.channel.postMessage({
        type: 'release',
        roomId: this.roomId,
        timestamp: Date.now(),
      });
    }

    this.isActive = false;
    this.channel.close();
    this.channel = null;

    console.log('[MultiTabGuard] Released room:', this.roomId);
  }

  public get active(): boolean {
    return this.isActive;
  }
}

import { Wifi, WifiOff, Users, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { useRoom } from '../room/RoomContext';

/**
 * PresenceIndicator - Shows connection status, user count, and room code
 *
 * Displays:
 * - Room code with copy button
 * - Connection status (connected/disconnected)
 * - Number of users in room
 * - Visual indicator with appropriate icon and color
 */
export function PresenceIndicator() {
  const { isConnected, users, roomId } = useRoom();
  const [copied, setCopied] = useState(false);

  const handleCopyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      console.log('[PresenceIndicator] Room code copied:', roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('[PresenceIndicator] Failed to copy room code:', error);
      // Fallback method
      const textArea = document.createElement('textarea');
      textArea.value = roomId;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Room Code */}
      <div className="glass-morphism px-4 py-2 rounded-full flex items-center gap-2">
        <span className="text-xs text-gray-400">Room:</span>
        <span className="text-sm font-mono text-white">{roomId}</span>
        <button
          onClick={handleCopyRoomCode}
          className="text-gray-400 hover:text-white transition-colors"
          title="Copy room code"
        >
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>

      {/* Connection & Users */}
      <div
        className={`
          glass-morphism px-4 py-2 rounded-full
          flex items-center gap-3 text-sm font-medium
          transition-all duration-300
          ${isConnected
            ? 'text-green-400 border border-green-500/30'
            : 'text-red-400 border border-red-500/30'
          }
        `}
      >
        {/* Connection status icon */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="w-4 h-4" />
          ) : (
            <WifiOff className="w-4 h-4 animate-pulse" />
          )}
          <span className="text-xs">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-gray-600/50" />

        {/* User count */}
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          <span className="text-xs">
            {users.length}/2
          </span>
        </div>
      </div>
    </div>
  );
}

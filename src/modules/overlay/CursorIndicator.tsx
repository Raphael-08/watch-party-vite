import { useEffect, useState, useRef } from 'react';
import { useRoom } from '../room/RoomContext';
import type { CursorMoveBroadcastPayload } from '@/types/messages';
import { WSEventTypes } from '@/types/messages';

interface CursorState {
  x: number;
  y: number;
  userId: string;
  username: string;
  role: 'host' | 'viewer';
  visible: boolean;
}

/**
 * CursorIndicator - Displays partner's cursor position with role-based styling
 *
 * Host cursor: Bright purple ring with glow effect
 * Viewer cursor: Faint ghost cursor with subtle opacity
 */
export function CursorIndicator() {
  const { wsClient, users, userId } = useRoom();
  const [partnerCursor, setPartnerCursor] = useState<CursorState | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!wsClient) return;

    // Subscribe to cursor move broadcasts
    const unsubscribe = wsClient.onMessage((message) => {
      if (message.type === WSEventTypes.CURSOR_MOVE_BROADCAST) {
        const payload = message.payload as CursorMoveBroadcastPayload;

        // Ignore own cursor
        if (payload.userId === userId) return;

        // Find partner user info
        const partnerUser = users.find((u) => u.userId === payload.userId);
        if (!partnerUser) return;

        setPartnerCursor({
          x: payload.x,
          y: payload.y,
          userId: payload.userId,
          username: partnerUser.username,
          role: partnerUser.role || 'viewer',
          visible: true,
        });

        // Clear existing timeout
        if (hideTimeoutRef.current !== null) {
          clearTimeout(hideTimeoutRef.current);
        }

        // Hide cursor after 3 seconds of inactivity
        hideTimeoutRef.current = window.setTimeout(() => {
          setPartnerCursor((prev) => (prev ? { ...prev, visible: false } : null));
          hideTimeoutRef.current = null;
        }, 3000);
      }
    });

    return () => {
      unsubscribe();
      // Clean up timeout on unmount
      if (hideTimeoutRef.current !== null) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [wsClient, userId, users]);

  if (!partnerCursor || !partnerCursor.visible) return null;

  const isHost = partnerCursor.role === 'host';

  return (
    <div
      className="pointer-events-none fixed z-50 transition-opacity duration-300"
      style={{
        left: `${partnerCursor.x * 100}%`,
        top: `${partnerCursor.y * 100}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Cursor ring/dot */}
      <div
        className={`
          relative rounded-full transition-all duration-150
          ${isHost
            ? 'w-8 h-8 border-4 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.6)] animate-pulse'
            : 'w-4 h-4 bg-gray-400/50 shadow-md'
          }
        `}
      >
        {/* Username label */}
        <div
          className={`
            absolute left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1
            rounded-md text-xs font-medium pointer-events-none
            ${isHost
              ? 'top-10 bg-purple-500/90 text-white shadow-lg'
              : 'top-6 bg-gray-700/80 text-gray-200'
            }
          `}
        >
          {partnerCursor.username}
          <span className="ml-1 text-xs opacity-70">
            ({isHost ? 'Host' : 'Viewer'})
          </span>
        </div>
      </div>
    </div>
  );
}

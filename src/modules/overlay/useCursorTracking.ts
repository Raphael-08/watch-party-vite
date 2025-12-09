import { useEffect, useRef, useCallback } from 'react';
import { useRoom } from '../room/RoomContext';

interface UseCursorTrackingOptions {
  /**
   * Throttle interval in milliseconds (default: 50ms)
   * Higher values = less network traffic, but choppier cursor movement
   */
  throttleMs?: number;

  /**
   * Element to track cursor within (default: document.body)
   */
  targetElement?: HTMLElement | null;
}

/**
 * useCursorTracking - Hook to track and broadcast cursor position
 *
 * Features:
 * - Normalized coordinates (0.0-1.0) for resolution-independent tracking
 * - Throttled updates to reduce network traffic
 * - Automatic cleanup on unmount
 * - Configurable tracking area
 */
export function useCursorTracking(options: UseCursorTrackingOptions = {}) {
  const { sendCursorMove } = useRoom();
  const { throttleMs = 50, targetElement } = options;

  const lastSentTime = useRef(0);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      const now = Date.now();

      // Throttle updates - already provides timing control, RAF unnecessary
      if (now - lastSentTime.current < throttleMs) {
        return;
      }

      const target = targetElement || document.body;
      const rect = target.getBoundingClientRect();

      // Calculate normalized coordinates (0.0 - 1.0)
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));

      // Send cursor position immediately after throttle check
      sendCursorMove(x, y);
      lastSentTime.current = now;
    },
    [sendCursorMove, throttleMs, targetElement]
  );

  useEffect(() => {
    const target = targetElement || document.body;

    // Add mousemove listener
    target.addEventListener('mousemove', handleMouseMove);

    // Cleanup
    return () => {
      target.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleMouseMove, targetElement]);
}

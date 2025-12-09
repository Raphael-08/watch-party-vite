import { useEffect } from 'react';

interface FloatingEmojiProps {
  emoji: string;
  id: string;
  onComplete: (id: string) => void;
}

/**
 * FloatingEmoji - Animated emoji that flies up from bottom-left
 * 
 * Appears when emoji-only messages are sent (when chat is closed)
 * Animates from bottom-left to top, then fades out
 */
export function FloatingEmoji({ emoji, id, onComplete }: FloatingEmojiProps) {
  useEffect(() => {
    // Remove after animation completes (3 seconds)
    const timer = setTimeout(() => {
      onComplete(id);
    }, 3000);

    return () => clearTimeout(timer);
  }, [id, onComplete]);

  return (
    <div
      className="fixed bottom-4 left-4 text-6xl pointer-events-none animate-fly-up"
      style={{
        animation: 'flyUp 3s ease-out forwards',
        zIndex: 9999,
      }}
    >
      {emoji}
    </div>
  );
}

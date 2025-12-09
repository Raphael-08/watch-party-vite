import { memo } from 'react';
import type { ChatMessage as ChatMessageBroadcastPayload } from '@/types/messages';

interface ChatMessageProps {
  message: ChatMessageBroadcastPayload;
  isOwnMessage: boolean;
}

/**
 * ChatMessage - Individual chat message component
 *
 * Displays a single chat message with username, timestamp, and content.
 * Styled differently for own messages vs. partner messages.
 */
export const ChatMessage = memo(function ChatMessage({
  message,
  isOwnMessage,
}: ChatMessageProps) {
  const formattedTime = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`flex flex-col gap-1 px-4 py-2 ${
        isOwnMessage ? 'items-end' : 'items-start'
      }`}
    >
      <div className="flex items-baseline gap-2 text-xs">
        <span
          className={`font-medium ${
            isOwnMessage ? 'text-accent' : 'text-muted-foreground'
          }`}
        >
          {isOwnMessage ? 'You' : message.username}
        </span>
        <span className="text-muted-foreground/60">{formattedTime}</span>
      </div>
      <div
        className={`rounded-lg px-3 py-2 max-w-[80%] break-words ${
          isOwnMessage
            ? 'bg-accent/20 text-foreground'
            : 'bg-secondary/50 text-foreground'
        }`}
      >
        {message.message}
      </div>
    </div>
  );
});

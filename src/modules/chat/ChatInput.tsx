import { useState, type KeyboardEvent, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onQuickEmoji?: (emoji: string) => void;
  disabled?: boolean;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮'];

/**
 * ChatInput - Chat message input component
 *
 * Provides a text input with Send button. Supports Enter key to send,
 * Shift+Enter for newline. Auto-clears after sending.
 * Includes quick emoji reactions that can be sent with one click.
 */
export function ChatInput({ onSendMessage, onQuickEmoji, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    const trimmed = message.trim();
    if (trimmed && !disabled) {
      onSendMessage(trimmed);
      setMessage('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend();
  };
  const handleQuickEmoji = (emoji: string) => {
    if (onQuickEmoji) {
      onQuickEmoji(emoji);
    } else {
      onSendMessage(emoji);
    }
  };

  return (
    <div className="border-t border-white/10">
      {/* Quick Emoji Reactions */}
      <div className="flex gap-2 justify-center py-2 px-4 border-b border-white/10">
        {QUICK_EMOJIS.map((emoji) => (
          <Button
            key={emoji}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-xl hover:scale-110 transition-transform"
            onClick={() => handleQuickEmoji(emoji)}
            disabled={disabled}
          >
            {emoji}
          </Button>
        ))}
      </div>

      {/* Message Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-4">
        <Input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled}
          className="flex-1 bg-secondary/50 border-white/10 focus:border-accent/50"
          maxLength={500}
        />
        <Button
          type="submit"
          size="icon"
          variant="glass"
          disabled={!message.trim() || disabled}
          className="shrink-0"
        >
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}

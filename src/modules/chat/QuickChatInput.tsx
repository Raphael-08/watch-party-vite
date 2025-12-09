import { useState, useEffect, useRef, type KeyboardEvent, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group';
import { Send } from 'lucide-react';

interface QuickChatInputProps {
  onSendMessage: (message: string) => void;
  onQuickEmoji?: (emoji: string) => void;
  disabled?: boolean;
  isVisible: boolean;
  onClose: () => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮'];

/**
 * QuickChatInput - Minimal bottom-right chat input using shadcn InputGroup
 * 
 * Appears when Enter is pressed, allows quick message sending
 * without blocking the screen. Full chat history in sidebar.
 */
export function QuickChatInput({ 
  onSendMessage, 
  onQuickEmoji, 
  disabled = false,
  isVisible,
  onClose
}: QuickChatInputProps) {
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus when visible
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  const handleSend = () => {
    const trimmed = message.trim();
    if (trimmed && !disabled) {
      onSendMessage(trimmed);
      setMessage('');
      onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
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

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop - click to close */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />

      {/* Chat Input - Bottom Right */}
      <div className="fixed bottom-4 right-4 z-50 w-96">
        <div className="glass-morphism rounded-xl shadow-2xl border border-white/20 overflow-hidden space-y-2 p-3">
          {/* Quick Emoji Reactions */}
          <div className="flex gap-2 justify-center">
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

          {/* Message Input with Send Button */}
          <form onSubmit={handleSubmit}>
            <InputGroup>
              <InputGroupInput
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                disabled={disabled}
                maxLength={500}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="submit"
                  size="icon-sm"
                  variant="ghost"
                  disabled={!message.trim() || disabled}
                  aria-label="Send message"
                >
                  <Send className="size-4" />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </form>
        </div>
      </div>
    </>
  );
}

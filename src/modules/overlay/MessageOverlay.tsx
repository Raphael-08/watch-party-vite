import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getUserColor } from '@/lib/utils';

interface MessagePreview {
  id: string;
  username: string;
  text: string;
}

interface MessageOverlayProps {
  messages: MessagePreview[];
}

/**
 * MessageOverlay - Shows last 3 messages floating on screen when chat is closed
 * 
 * Displays recent messages in bottom-right corner with user avatars
 * Auto-fades after 5 seconds
 */
export function MessageOverlay({ messages }: MessageOverlayProps) {
  if (messages.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-4 z-40 w-80 space-y-2 pointer-events-none">
      {messages.slice(-3).map((msg) => (
        <div
          key={msg.id}
          className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg px-4 py-2 text-white animate-in fade-in slide-in-from-bottom-2"
        >
          <div className="flex items-start gap-2">
            <Avatar className="w-6 h-6 flex-shrink-0">
              <AvatarFallback className={`${getUserColor(msg.username)} text-xs`}>
                {msg.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white/90">{msg.username}</p>
              <p className="text-sm text-white/80 break-words">{msg.text}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

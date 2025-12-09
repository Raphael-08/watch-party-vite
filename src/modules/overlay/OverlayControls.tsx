import { useState } from 'react';
import { MessageSquare, LogOut, Minimize2, Maximize2, Settings, Video, VideoOff } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useRoom } from '../room/RoomContext';
import { PresenceIndicator } from './PresenceIndicator';

interface OverlayControlsProps {
  onToggleChat: () => void;
  isChatOpen: boolean;
  onToggleCamera?: () => void;
  isCameraOpen?: boolean;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  onLeaveRoom: () => void;
  onOpenSettings?: () => void;
  onVisibilityChange?: (visible: boolean) => void;
}

/**
 * OverlayControls - Hover-activated toolbar with room controls
 *
 * Features:
 * - Auto-hide on mouse leave
 * - Chat toggle button
 * - Fullscreen toggle
 * - Leave room button
 * - Connection status indicator
 */
export function OverlayControls({
  onToggleChat,
  isChatOpen,
  onToggleCamera,
  isCameraOpen = false,
  onToggleFullscreen,
  isFullscreen = false,
  onLeaveRoom,
  onOpenSettings,
  onVisibilityChange,
}: OverlayControlsProps) {
  const { leaveRoom } = useRoom();
  const [isVisible, setIsVisible] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // Notify parent when visibility changes
  const handleVisibilityChange = (visible: boolean) => {
    setIsVisible(visible);
    onVisibilityChange?.(visible);
  };

  const handleLeaveRoom = () => {
    leaveRoom();
    onLeaveRoom();
    setShowLeaveDialog(false);
  };

  return (
    <>
      {/* Bottom hover zone - triggers visibility (mirror of titlebar at top) */}
      <div
        className="fixed bottom-0 left-0 right-0 h-20 z-40"
        onMouseEnter={() => handleVisibilityChange(true)}
        onMouseLeave={() => handleVisibilityChange(false)}
      >
        {/* Bottom controls bar - slides up from bottom */}
        <div
          className={`
            absolute bottom-0 left-0 right-0 p-4
            flex items-center justify-between
            transition-all duration-300 ease-out
            ${isVisible
              ? 'translate-y-0 opacity-100'
              : 'translate-y-full opacity-0'
            }
          `}
        >
          {/* Left side - Sidebar trigger and Presence indicator */}
          <div className="flex items-center gap-3">
            <SidebarTrigger className="glass-morphism rounded-full h-10 w-10 text-white hover:bg-white/10 transition-all" />
            <PresenceIndicator />
          </div>

          {/* Right side - Action buttons */}
          <div className="flex items-center gap-2">
            {/* Chat toggle */}
            <button
              onClick={onToggleChat}
              className={`
                glass-morphism rounded-full h-10 w-10
                flex items-center justify-center
                text-white transition-all
                hover:bg-white/10
                ${isChatOpen ? 'bg-purple-500/30 text-purple-300' : ''}
              `}
              title="Toggle chat"
            >
              <MessageSquare className="w-5 h-5" />
              {isChatOpen && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full" />
              )}
            </button>

            {/* Settings */}
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="glass-morphism rounded-full h-10 w-10 flex items-center justify-center text-white hover:bg-white/10 transition-all"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}

            {/* Camera toggle */}
            {onToggleCamera && (
              <button
                onClick={onToggleCamera}
                className={`
                  glass-morphism rounded-full h-10 w-10
                  flex items-center justify-center
                  text-white transition-all
                  hover:bg-white/10
                  ${isCameraOpen ? 'bg-green-500/30 text-green-300' : ''}
                `}
                title={isCameraOpen ? 'Close camera' : 'Open camera'}
              >
                {isCameraOpen ? (
                  <Video className="w-5 h-5" />
                ) : (
                  <VideoOff className="w-5 h-5" />
                )}
              </button>
            )}

            {/* Fullscreen toggle */}
            {onToggleFullscreen && (
              <button
                onClick={onToggleFullscreen}
                className="glass-morphism rounded-full h-10 w-10 flex items-center justify-center text-white hover:bg-white/10 transition-all"
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-5 h-5" />
                ) : (
                  <Maximize2 className="w-5 h-5" />
                )}
              </button>
            )}

            {/* Leave room */}
            <button
              onClick={() => setShowLeaveDialog(true)}
              className="glass-morphism rounded-full h-10 w-10 flex items-center justify-center text-white hover:bg-red-500/30 hover:text-red-400 transition-all"
              title="Leave room"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Leave Room Confirmation Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Room?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave this watch party? You can always rejoin later with the room code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay in Room</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveRoom} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Leave Room
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

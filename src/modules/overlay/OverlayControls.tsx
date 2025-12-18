import { useState, useEffect } from 'react';
import { MessageSquare, LogOut, Minimize2, Maximize2, Settings, Video, VideoOff, Mic, MicOff, Command } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
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
  onToggleAudio?: () => void;
  isAudioMuted?: boolean;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  onLeaveRoom: () => void;
  onOpenSettings?: () => void;
  onVisibilityChange?: (visible: boolean) => void;
}

/**
 * OverlayControls - Keyboard-activated drawer with room controls
 *
 * Features:
 * - Backtick (`) to toggle drawer
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
  onToggleAudio,
  isAudioMuted = false,
  onToggleFullscreen,
  isFullscreen = false,
  onLeaveRoom,
  onOpenSettings,
  onVisibilityChange,
}: OverlayControlsProps) {
  const { leaveRoom } = useRoom();
  const [isOpen, setIsOpen] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // Keyboard shortcut: Backtick (`) to toggle drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '`') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Notify parent when drawer visibility changes
  useEffect(() => {
    onVisibilityChange?.(isOpen);
  }, [isOpen, onVisibilityChange]);

  const handleLeaveRoom = () => {
    leaveRoom();
    onLeaveRoom();
    setShowLeaveDialog(false);
  };

  return (
    <>
      {/* Drawer - Opens with backtick (`) */}
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent className="max-h-[50vh]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Command className="w-5 h-5" />
              Room Controls
            </DrawerTitle>
            <DrawerDescription>
              Press <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">`</kbd> to toggle
            </DrawerDescription>
          </DrawerHeader>

          <div className="p-4 space-y-4">
            {/* Room info section */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="h-10 w-10" />
                <PresenceIndicator />
              </div>
            </div>

            {/* Control buttons grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {/* Chat toggle */}
              <button
                onClick={() => {
                  onToggleChat();
                  setIsOpen(false);
                }}
                className={`
                  flex flex-col items-center justify-center gap-2 p-4 rounded-lg
                  transition-all hover:bg-accent
                  ${isChatOpen ? 'bg-purple-500/20 text-purple-400' : 'bg-muted/50'}
                `}
              >
                <MessageSquare className="w-6 h-6" />
                <span className="text-xs font-medium">{isChatOpen ? 'Close Chat' : 'Open Chat'}</span>
              </button>

              {/* Settings */}
              {onOpenSettings && (
                <button
                  onClick={() => {
                    onOpenSettings();
                    setIsOpen(false);
                  }}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-muted/50 hover:bg-accent transition-all"
                >
                  <Settings className="w-6 h-6" />
                  <span className="text-xs font-medium">Settings</span>
                </button>
              )}

              {/* Audio toggle */}
              {onToggleAudio && (
                <button
                  onClick={() => {
                    onToggleAudio();
                  }}
                  className={`
                    flex flex-col items-center justify-center gap-2 p-4 rounded-lg
                    transition-all hover:bg-accent
                    ${isAudioMuted ? 'bg-red-500/20 text-red-400' : 'bg-muted/50'}
                  `}
                >
                  {isAudioMuted ? (
                    <>
                      <MicOff className="w-6 h-6" />
                      <span className="text-xs font-medium">Unmute</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-6 h-6" />
                      <span className="text-xs font-medium">Mute</span>
                    </>
                  )}
                </button>
              )}

              {/* Camera toggle */}
              {onToggleCamera && (
                <button
                  onClick={() => {
                    onToggleCamera();
                  }}
                  className={`
                    flex flex-col items-center justify-center gap-2 p-4 rounded-lg
                    transition-all hover:bg-accent
                    ${isCameraOpen ? 'bg-green-500/20 text-green-400' : 'bg-muted/50'}
                  `}
                >
                  {isCameraOpen ? (
                    <>
                      <Video className="w-6 h-6" />
                      <span className="text-xs font-medium">Camera On</span>
                    </>
                  ) : (
                    <>
                      <VideoOff className="w-6 h-6" />
                      <span className="text-xs font-medium">Camera Off</span>
                    </>
                  )}
                </button>
              )}

              {/* Fullscreen toggle */}
              {onToggleFullscreen && (
                <button
                  onClick={() => {
                    onToggleFullscreen();
                    setIsOpen(false);
                  }}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-muted/50 hover:bg-accent transition-all"
                >
                  {isFullscreen ? (
                    <>
                      <Minimize2 className="w-6 h-6" />
                      <span className="text-xs font-medium">Exit Fullscreen</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-6 h-6" />
                      <span className="text-xs font-medium">Fullscreen</span>
                    </>
                  )}
                </button>
              )}

              {/* Leave room */}
              <button
                onClick={() => {
                  setShowLeaveDialog(true);
                  setIsOpen(false);
                }}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-muted/50 hover:bg-red-500/20 hover:text-red-400 transition-all"
              >
                <LogOut className="w-6 h-6" />
                <span className="text-xs font-medium">Leave Room</span>
              </button>
            </div>
          </div>

          <DrawerFooter>
            <DrawerClose asChild>
              <button className="w-full p-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Close
              </button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

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



import { Minus, Square, X } from 'lucide-react';

export default function TitleBar({ isVisible }: { isVisible: boolean }) {
  const handleMinimize = () => {
    console.log('=== MINIMIZE BUTTON CLICKED ===');
    console.log('electronAPI exists:', !!(window as any).electronAPI);
    console.log('electronAPI object:', (window as any).electronAPI);
    if ((window as any).electronAPI) {
      console.log('Calling minimizeWindow...');
      (window as any).electronAPI.minimizeWindow();
      console.log('minimizeWindow called');
    } else {
      console.warn('Not running in Electron - minimize not available');
    }
  };

  const handleMaximize = () => {
    console.log('=== MAXIMIZE BUTTON CLICKED ===');
    console.log('electronAPI exists:', !!(window as any).electronAPI);
    if ((window as any).electronAPI) {
      console.log('Calling maximizeWindow...');
      (window as any).electronAPI.maximizeWindow();
      console.log('maximizeWindow called');
    } else {
      console.warn('Not running in Electron - maximize not available');
    }
  };

  const handleClose = () => {
    console.log('=== CLOSE BUTTON CLICKED ===');
    console.log('electronAPI exists:', !!(window as any).electronAPI);
    if ((window as any).electronAPI) {
      console.log('Calling closeWindow...');
      (window as any).electronAPI.closeWindow();
      console.log('closeWindow called');
    } else {
      console.warn('Not running in Electron - close not available');
    }
  };

  console.log('[TitleBar] Rendering with isVisible:', isVisible);

  // Don't render at all if not visible
  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="absolute top-0 left-0 right-0 h-8 bg-sidebar flex items-center justify-end px-2 transition-all duration-300 ease-in-out translate-y-0 opacity-100 rounded-b-lg"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button
          onClick={handleMinimize}
          className="h-8 w-11 flex items-center justify-center text-foreground/60 hover:bg-accent/50 transition-colors"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="h-8 w-11 flex items-center justify-center text-foreground/60 hover:bg-accent/50 transition-colors"
          title="Maximize"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={handleClose}
          className="h-8 w-11 flex items-center justify-center text-foreground/60 hover:bg-red-500 hover:text-white transition-colors"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

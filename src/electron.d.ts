declare global {
  interface Window {
    electron?: {
      send: (channel: string, ...args: any[]) => void;
    };
    electronAPI?: {
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
      toggleFullscreen: () => void;
      isFullscreen: () => Promise<boolean>;
      onFullscreenChange: (callback: (isFullscreen: boolean) => void) => void;
    };
  }
}

export {};

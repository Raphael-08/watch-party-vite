declare global {
  interface Window {
    electron?: {
      send: (channel: string, ...args: any[]) => void;
    };
    electronAPI?: {
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
      restartApp: () => void;
      toggleFullscreen: () => void;
    };
  }
}

export {};

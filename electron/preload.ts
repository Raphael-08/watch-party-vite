import { contextBridge, ipcRenderer } from 'electron';

// Note: Environment variables should be handled in main.ts
// Preload scripts cannot use Node.js modules like 'fs' (required by dotenv)

contextBridge.exposeInMainWorld('electron', {
  send: (channel: string, ...args: any[]) => {
    // Whitelist of allowed channels
    const validChannels = ['minimize-window', 'maximize-window', 'close-window', 'open-logs', 'check-updates', 'restart-app'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  }
});

// Keep backward compatibility
contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  restartApp: () => ipcRenderer.send('restart-app'),
});

import { contextBridge, ipcRenderer } from 'electron';

// Note: Environment variables should be handled in main.ts
// Preload scripts cannot use Node.js modules like 'fs' (required by dotenv)

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
});

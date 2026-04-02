import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  appVersion: () => ipcRenderer.invoke('app:version'),
  platform: () => ipcRenderer.invoke('app:platform'),
  onMessage: (callback: (message: string) => void) => {
    ipcRenderer.on('message', (_event, message) => callback(message));
  },
  sendMessage: (message: string) => {
    ipcRenderer.send('message', message);
  }
});
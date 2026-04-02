"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    appVersion: () => electron_1.ipcRenderer.invoke('app:version'),
    platform: () => electron_1.ipcRenderer.invoke('app:platform'),
    onMessage: (callback) => {
        electron_1.ipcRenderer.on('message', (_event, message) => callback(message));
    },
    sendMessage: (message) => {
        electron_1.ipcRenderer.send('message', message);
    }
});

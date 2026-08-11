const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nvmApi', {
  check: () => ipcRenderer.invoke('nvm:check'),
  status: () => ipcRenderer.invoke('nvm:status'),
  listInstalled: () => ipcRenderer.invoke('nvm:list-installed'),
  listAvailable: () => ipcRenderer.invoke('nvm:list-available'),
  install: (version) => ipcRenderer.invoke('nvm:install', version),
  uninstall: (version) => ipcRenderer.invoke('nvm:uninstall', version),
  use: (version) => ipcRenderer.invoke('nvm:use', version),
  installManager: () => ipcRenderer.invoke('nvm:install-manager'),
  updateManager: () => ipcRenderer.invoke('nvm:update-manager'),
  latestManager: () => ipcRenderer.invoke('nvm:latest-manager'),
  onProgress: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('nvm:progress', handler);
    return () => ipcRenderer.removeListener('nvm:progress', handler);
  },
});

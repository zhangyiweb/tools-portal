const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('app:getState'),
  getLocalIp: () => ipcRenderer.invoke('app:getLocalIp'),
  addProject: () => ipcRenderer.invoke('project:add'),
  removeProject: (id) => ipcRenderer.invoke('project:remove', id),
  toggleProject: (id, enabled) => ipcRenderer.invoke('project:toggle', id, enabled),
  renameProject: (id, name) => ipcRenderer.invoke('project:rename', id, name),
  nginxStart: () => ipcRenderer.invoke('nginx:start'),
  nginxStop: () => ipcRenderer.invoke('nginx:stop'),
  nginxStatus: () => ipcRenderer.invoke('nginx:status'),
  openDataDir: () => ipcRenderer.invoke('nginx:openDataDir'),
  firewallStatus: () => ipcRenderer.invoke('firewall:status'),
  firewallSet: (enabled) => ipcRenderer.invoke('firewall:set', enabled)
});


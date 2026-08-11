const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');

const { setupUserDataDir } = require('./userData');

// 必须在任何读取 userData 的模块加载之前设置（例如 state.js 会调用 app.getPath('userData')）
setupUserDataDir();

const { ensureNginxReady, startNginx, stopNginx, reloadNginx, getNginxStatus } = require('./nginx');
const { getFirewallStatus, setFirewallEnabled } = require('./firewall');
const { getLocalIp } = require('./network');
const { loadState, saveState, createProject, toggleProjectEnabled, removeProject, renameProject, updateGeneratedConfig } = require('./state');

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

async function findFreePort(startPort, usedPorts = []) {
  const used = new Set(usedPorts);
  for (let port = startPort; port < startPort + 500; port++) {
    if (used.has(port)) continue;
    if (await isPortAvailable(port)) return port;
  }
  throw new Error('在预期范围内找不到可用端口，请关闭占用端口的程序或调整起始端口。');
}

async function repairDuplicatePorts(state) {
  const used = new Set();
  let changed = false;
  const startPort = state.settings?.portStart ?? 8000;

  for (const project of state.projects || []) {
    if (used.has(project.port)) {
      project.port = await findFreePort(startPort, [...used]);
      changed = true;
    }
    used.add(project.port);
  }
  return changed;
}

async function rebuildAndMaybeReload() {
  const state = loadState();
  if (await repairDuplicatePorts(state)) {
    saveState(state);
  }
  updateGeneratedConfig(state);
  saveState(state);
  const status = await getNginxStatus();
  if (status.running) {
    await reloadNginx();
  }
  return state;
}

ipcMain.handle('app:getState', async () => {
  const state = loadState();
  if (await repairDuplicatePorts(state)) {
    saveState(state);
    updateGeneratedConfig(state);
    const status = await getNginxStatus();
    if (status.running) {
      await reloadNginx();
    }
  }
  return state;
});

ipcMain.handle('app:getLocalIp', async () => {
  return { ok: true, ip: getLocalIp() };
});

ipcMain.handle('project:add', async () => {
  const res = await dialog.showOpenDialog({
    title: '选择项目构建目录',
    properties: ['openDirectory']
  });
  if (res.canceled || !res.filePaths?.[0]) return { ok: false, error: '已取消选择。' };

  const distPath = res.filePaths[0];
  const indexPath = path.join(distPath, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return { ok: false, error: '所选目录内未发现 index.html，请确认这是构建产物的 dist 目录。' };
  }

  const state = loadState();
  const startPort = state.settings?.portStart ?? 8000;
  const usedPorts = (state.projects || []).map((p) => p.port);
  const port = await findFreePort(startPort, usedPorts);
  const project = createProject({ distPath, port });
  state.projects.push(project);
  saveState(state);
  await rebuildAndMaybeReload();
  return { ok: true, state: loadState() };
});

ipcMain.handle('project:remove', async (_evt, projectId) => {
  const state = loadState();
  removeProject(state, projectId);
  saveState(state);
  await rebuildAndMaybeReload();
  return { ok: true, state: loadState() };
});

ipcMain.handle('project:toggle', async (_evt, projectId, enabled) => {
  const state = loadState();
  toggleProjectEnabled(state, projectId, enabled);
  saveState(state);
  await rebuildAndMaybeReload();
  return { ok: true, state: loadState() };
});

ipcMain.handle('project:rename', async (_evt, projectId, name) => {
  const trimmed = String(name || '').trim();
  if (!trimmed) return { ok: false, error: '项目名称不能为空。' };
  const state = loadState();
  const exists = state.projects.some((x) => x.id === projectId);
  if (!exists) return { ok: false, error: '项目不存在。' };
  renameProject(state, projectId, trimmed);
  saveState(state);
  return { ok: true, state: loadState() };
});

ipcMain.handle('nginx:start', async () => {
  try {
    await ensureNginxReady();
    const state = loadState();
    updateGeneratedConfig(state);
    saveState(state);
    const status = await startNginx();
    return { ok: true, status };
  } catch (e) {
    return { ok: false, error: `启动 Nginx 失败：${e?.message || e}` };
  }
});

ipcMain.handle('nginx:stop', async () => {
  try {
    const status = await stopNginx();
    return { ok: true, status };
  } catch (e) {
    return { ok: false, error: `停止 Nginx 失败：${e?.message || e}` };
  }
});

ipcMain.handle('nginx:status', async () => {
  return { ok: true, status: await getNginxStatus() };
});

ipcMain.handle('nginx:openDataDir', async () => {
  const dir = app.getPath('userData');
  await shell.openPath(dir);
  return { ok: true, dir };
});

ipcMain.handle('firewall:status', async () => {
  try {
    const status = await getFirewallStatus();
    return { ok: true, status };
  } catch (e) {
    return { ok: false, error: `获取防火墙状态失败：${e?.message || e}` };
  }
});

ipcMain.handle('firewall:set', async (_evt, enabled) => {
  try {
    const status = await setFirewallEnabled(!!enabled);
    return { ok: true, status };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
});

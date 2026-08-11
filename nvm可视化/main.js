const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const nvm = require('./nvm-service');
const installer = require('./nvm-installer');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 760,
    minHeight: 560,
    title: 'NVM 可视化管理',
    backgroundColor: '#0f1410',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.setMenuBarVisibility(false);
}

function sendProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('nvm:progress', payload);
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('nvm:check', () => nvm.checkNvm());
ipcMain.handle('nvm:status', () => nvm.getStatus());
ipcMain.handle('nvm:list-installed', () => nvm.listInstalled());
ipcMain.handle('nvm:list-available', () => nvm.listAvailable());
ipcMain.handle('nvm:install', (_e, version) => nvm.install(version));
ipcMain.handle('nvm:uninstall', (_e, version) => nvm.uninstall(version));
ipcMain.handle('nvm:use', (_e, version) => nvm.use(version));

ipcMain.handle('nvm:install-manager', async () => {
  try {
    return await installer.installOrUpdateNvm('install', (ratio, _a, _b, text) => {
      sendProgress({ ratio, text: text || '正在安装 nvm…' });
    });
  } catch (err) {
    return { ok: false, message: err.message || '安装 nvm 失败' };
  }
});

ipcMain.handle('nvm:update-manager', async () => {
  try {
    // 优先尝试内置 upgrade
    const cli = await nvm.upgradeNvmCli();
    if (cli.ok) {
      return { ok: true, message: cli.message || 'nvm 已更新' };
    }
    return await installer.installOrUpdateNvm('update', (ratio, _a, _b, text) => {
      sendProgress({ ratio, text: text || '正在更新 nvm…' });
    });
  } catch (err) {
    return { ok: false, message: err.message || '更新 nvm 失败' };
  }
});

ipcMain.handle('nvm:latest-manager', async () => {
  try {
    return await installer.getLatestRelease();
  } catch (err) {
    return { error: err.message };
  }
});

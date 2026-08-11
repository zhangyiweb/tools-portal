const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const DATA_DIR_NAME = 'nginx-visual-manager-data';

function getProjectBaseDir() {
  if (app.isPackaged) {
    return path.dirname(process.execPath);
  }
  // 开发模式：src/main -> 项目根目录
  return path.join(__dirname, '..', '..');
}

function getLocalUserDataDir() {
  return path.join(getProjectBaseDir(), DATA_DIR_NAME);
}

function getDefaultUserDataDir() {
  return path.join(app.getPath('appData'), 'nginx-visual-manager');
}

function copyDirRecursive(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dst, name);
    const stat = fs.statSync(from);
    if (stat.isDirectory()) {
      copyDirRecursive(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function removeDirRecursive(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const target = path.join(dir, name);
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      removeDirRecursive(target);
    } else {
      fs.unlinkSync(target);
    }
  }
  fs.rmdirSync(dir);
}

function migrateFromAppDataIfNeeded(localDir, oldDir) {
  if (path.resolve(localDir) === path.resolve(oldDir)) return;

  const localState = path.join(localDir, 'state.json');
  const oldState = path.join(oldDir, 'state.json');
  const localHasState = fs.existsSync(localState);
  const oldHasState = fs.existsSync(oldState);

  if (!localHasState && oldHasState) {
    fs.mkdirSync(localDir, { recursive: true });
    fs.copyFileSync(oldState, localState);

    const oldNginx = path.join(oldDir, 'nginx');
    const localNginx = path.join(localDir, 'nginx');
    if (fs.existsSync(oldNginx) && !fs.existsSync(localNginx)) {
      copyDirRecursive(oldNginx, localNginx);
    }
  }

  // 用户要求不再使用 AppData 目录：迁移后尽量清空旧目录
  if (fs.existsSync(oldDir)) {
    try {
      removeDirRecursive(oldDir);
    } catch {
      // 若文件被占用则跳过，不影响新目录使用
    }
  }
}

function setupUserDataDir() {
  const localDir = getLocalUserDataDir();
  const oldDir = getDefaultUserDataDir();

  fs.mkdirSync(localDir, { recursive: true });
  migrateFromAppDataIfNeeded(localDir, oldDir);
  app.setPath('userData', localDir);

  return localDir;
}

module.exports = {
  DATA_DIR_NAME,
  getProjectBaseDir,
  getLocalUserDataDir,
  setupUserDataDir
};

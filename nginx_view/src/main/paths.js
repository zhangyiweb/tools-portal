const path = require('path');
const { app } = require('electron');

function getNginxRuntimeBaseDir() {
  // 说明：Windows 版 nginx 对包含中文的路径兼容性很差（会报 No mapping for the Unicode character）。
  // 因此 Nginx 运行目录固定放到 LocalAppData（通常是纯英文路径），避免因为项目路径含中文导致启动失败。
  const local = process.env.LOCALAPPDATA;
  if (local) return path.join(local, 'nginx-visual-manager-runtime');
  return path.join(app.getPath('temp'), 'nginx-visual-manager-runtime');
}

function getNginxRootDir() {
  return path.join(getNginxRuntimeBaseDir(), 'nginx');
}

function getNginxExePath() {
  return path.join(getNginxRootDir(), 'nginx.exe');
}

function getNginxConfDir() {
  return path.join(getNginxRootDir(), 'conf');
}

function getNginxLogsDir() {
  return path.join(getNginxRootDir(), 'logs');
}

function getNginxSitesDir() {
  return path.join(getNginxRootDir(), 'sites');
}

function getNginxConfPath() {
  return path.join(getNginxConfDir(), 'nginx.conf');
}

module.exports = {
  getNginxRootDir,
  getNginxRuntimeBaseDir,
  getNginxExePath,
  getNginxConfDir,
  getNginxLogsDir,
  getNginxSitesDir,
  getNginxConfPath
};


const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const RELEASE_API = 'https://api.github.com/repos/coreybutler/nvm-windows/releases/latest';
const ASSET_NAME = 'nvm-setup.exe';

const DOWNLOAD_MIRRORS = [
  (tag, name) => `https://github.com/coreybutler/nvm-windows/releases/download/${tag}/${name}`,
  (tag, name) => `https://ghfast.top/https://github.com/coreybutler/nvm-windows/releases/download/${tag}/${name}`,
  (tag, name) => `https://mirror.ghproxy.com/https://github.com/coreybutler/nvm-windows/releases/download/${tag}/${name}`,
];

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('http://') ? http : https;
    const req = lib.get(
      url,
      {
        headers: {
          'User-Agent': 'nvm-gui',
          Accept: 'application/vnd.github+json',
          ...(options.headers || {}),
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          request(res.headers.location, options).then(resolve).catch(reject);
          return;
        }
        if (options.stream) {
          if (res.statusCode !== 200) {
            reject(new Error(`下载失败 HTTP ${res.statusCode}`));
            res.resume();
            return;
          }
          resolve(res);
          return;
        }
        let data = '';
        res.on('data', (c) => {
          data += c;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`请求失败 HTTP ${res.statusCode}: ${data.slice(0, 120)}`));
            return;
          }
          resolve({ statusCode: res.statusCode, data, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error('请求超时'));
    });
  });
}

async function getLatestRelease() {
  const { data } = await request(RELEASE_API);
  const json = JSON.parse(data);
  const tag = json.tag_name;
  const asset = (json.assets || []).find(
    (a) => a.name === ASSET_NAME || /^nvm-setup\.exe$/i.test(a.name)
  );
  if (!tag) throw new Error('无法解析最新 nvm-windows 版本');
  return {
    tag,
    version: String(tag).replace(/^v/i, ''),
    downloadUrl: asset && asset.browser_download_url,
    name: (asset && asset.name) || ASSET_NAME,
  };
}

function downloadToFile(url, dest, onProgress) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await request(url, { stream: true });
      const total = Number(res.headers['content-length']) || 0;
      let received = 0;
      const file = fs.createWriteStream(dest);
      res.on('data', (chunk) => {
        received += chunk.length;
        if (onProgress && total) onProgress(received / total, received, total);
      });
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(dest));
      });
      file.on('error', (err) => {
        try {
          fs.unlinkSync(dest);
        } catch {
          /* ignore */
        }
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

async function downloadInstaller(onProgress) {
  const release = await getLatestRelease();
  const dest = path.join(os.tmpdir(), `nvm-setup-${release.version}.exe`);
  const urls = [];
  if (release.downloadUrl) urls.push(release.downloadUrl);
  for (const build of DOWNLOAD_MIRRORS) {
    const u = build(release.tag, release.name);
    if (!urls.includes(u)) urls.push(u);
  }

  let lastError = null;
  for (const url of urls) {
    try {
      if (onProgress) onProgress(0, 0, 0, `正在下载 ${release.version}…`);
      await downloadToFile(url, dest, (ratio) => {
        if (onProgress) onProgress(ratio, 0, 0, `正在下载 ${release.version}… ${Math.round(ratio * 100)}%`);
      });
      const size = fs.statSync(dest).size;
      if (size < 100000) throw new Error('安装包过小，可能下载失败');
      return { ...release, installerPath: dest };
    } catch (err) {
      lastError = err;
      try {
        fs.unlinkSync(dest);
      } catch {
        /* ignore */
      }
    }
  }
  throw lastError || new Error('下载 nvm-setup.exe 失败');
}

function launchInstaller(installerPath) {
  return new Promise((resolve, reject) => {
    // 使用 shell 打开，便于弹出 UAC
    const child = spawn(installerPath, [], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
      shell: false,
    });
    child.on('error', reject);
    child.unref();
    resolve({ ok: true });
  });
}

async function installOrUpdateNvm(kind, onProgress) {
  const label = kind === 'update' ? '更新' : '安装';
  if (onProgress) onProgress(0, 0, 0, `正在获取最新 nvm-windows…`);
  const packed = await downloadInstaller(onProgress);
  if (onProgress) onProgress(1, 0, 0, `正在打开${label}程序…`);
  await launchInstaller(packed.installerPath);
  return {
    ok: true,
    version: packed.version,
    message: `已启动 nvm-windows ${packed.version} ${label}程序，请在弹出窗口中完成操作。完成后点击「刷新」。`,
  };
}

module.exports = {
  getLatestRelease,
  installOrUpdateNvm,
};

const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');
const AdmZip = require('adm-zip');

const { getNginxRootDir, getNginxExePath, getNginxConfPath, getNginxLogsDir } = require('./paths');

function cleanupExtractedVersionDirs(root) {
  try {
    for (const name of fs.readdirSync(root)) {
      if (!/^nginx-\d+\.\d+(?:\.\d+)?$/i.test(name)) continue;
      const dir = path.join(root, name);
      if (fs.statSync(dir).isDirectory()) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  } catch {}
}

function downloadFile(url, dstPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dstPath), { recursive: true });
    const file = fs.createWriteStream(dstPath);
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close(() => fs.unlinkSync(dstPath));
          return resolve(downloadFile(res.headers.location, dstPath));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`下载失败：HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', (err) => {
        try {
          file.close(() => {});
        } catch {}
        try {
          if (fs.existsSync(dstPath)) fs.unlinkSync(dstPath);
        } catch {}
        reject(err);
      });
  });
}

async function ensureNginxReady() {
  const exe = getNginxExePath();
  const root = getNginxRootDir();
  if (fs.existsSync(exe)) {
    cleanupExtractedVersionDirs(root);
    return;
  }

  fs.mkdirSync(root, { recursive: true });

  // 说明：这里使用官方提供的 Windows zip 包，首次启动自动下载并解压到用户目录。
  // 如你需要指定版本/镜像源，后续我们再加 UI 配置。
  const url = 'https://nginx.org/download/nginx-1.28.0.zip';
  const zipPath = path.join(root, 'nginx.zip');

  // 如果之前下载过但文件损坏/不完整，先删除避免反复解压失败
  try {
    if (fs.existsSync(zipPath)) {
      const st = fs.statSync(zipPath);
      if (!st.size || st.size < 100 * 1024) {
        fs.unlinkSync(zipPath);
      }
    }
  } catch {}

  try {
    await downloadFile(url, zipPath);
  } catch (e) {
    throw new Error(
      `无法自动下载 Nginx（网络超时/被阻断）。你可以手动下载 Windows 版 Nginx zip 并解压，把 nginx.exe 放到：\n` +
        `${getNginxExePath()}\n` +
        `同时把 conf/ 与 html/ 等目录也放到同级（保持完整目录结构）。\n` +
        `下载地址：${url}\n` +
        `原始错误：${e?.message || e}`
    );
  }

  let zip;
  try {
    zip = new AdmZip(zipPath);
    zip.extractAllTo(root, true);
  } catch (e) {
    try {
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    } catch {}
    throw new Error(
      `Nginx 压缩包解压失败（可能是网络下载到的文件损坏）。已自动删除缓存文件，你可以再点一次“启动 Nginx”重试。\n` +
        `如果仍失败，请按离线方式手动放置 Nginx。\n` +
        `原始错误：${e?.message || e}`
    );
  }

  // zip 内通常是 nginx-<version>/ 目录。我们需要把整套运行所需文件（conf/mime.types 等）一起放进 root。
  const entries = zip.getEntries();
  const exeEntry = entries.find((e) => e.entryName.toLowerCase().endsWith('nginx.exe'));
  if (!exeEntry) throw new Error('解压后未找到 nginx.exe，请检查下载包是否正确。');

  const extractedExe = path.join(root, exeEntry.entryName);
  const extractedBaseDir = path.dirname(extractedExe); // .../nginx-<version>

  // 复制 extractedBaseDir 下所有内容到 root（避免只拷贝 exe 导致 mime.types 缺失）
  const names = fs.readdirSync(extractedBaseDir);
  for (const name of names) {
    const src = path.join(extractedBaseDir, name);
    const dst = path.join(root, name);
    fs.cpSync(src, dst, { recursive: true, force: true });
  }

  // 解压 zip 会留下 nginx-<version>/ 目录，复制完成后删除，避免重复占用磁盘
  try {
    fs.rmSync(extractedBaseDir, { recursive: true, force: true });
  } catch {}

  cleanupExtractedVersionDirs(root);

  // 确保目录存在
  fs.mkdirSync(path.dirname(getNginxConfPath()), { recursive: true });
  fs.mkdirSync(getNginxLogsDir(), { recursive: true });

  try {
    fs.unlinkSync(zipPath);
  } catch {}
}

function isProcessAlive(pid) {
  if (!pid || Number.isNaN(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM 表示进程存在但无权限发信号
    return e.code === 'EPERM';
  }
}

function runNginx(args, { waitForExit = true } = {}) {
  const exe = getNginxExePath();
  const root = getNginxRootDir();
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, {
      cwd: root,
      windowsHide: true,
      detached: !waitForExit,
      stdio: waitForExit ? ['ignore', 'ignore', 'pipe'] : 'ignore'
    });

    if (!waitForExit) {
      child.unref();
      resolve();
      return;
    }

    let stderr = '';
    child.stderr?.on('data', (d) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) return resolve();
      reject(new Error(stderr || `nginx 退出码：${code}`));
    });
  });
}

async function getNginxStatus() {
  const pidPath = path.join(getNginxLogsDir(), 'nginx.pid');
  if (!fs.existsSync(pidPath)) return { running: false };

  const pidStr = fs.readFileSync(pidPath, 'utf-8').trim();
  const pid = Number(pidStr);
  if (!isProcessAlive(pid)) {
    // 清理过期 pid 文件，避免误判为未运行或阻塞下次启动
    try {
      fs.unlinkSync(pidPath);
    } catch {}
    return { running: false };
  }
  return { running: true, pid };
}

async function waitForNginxStatus(expectRunning, { timeoutMs = 8000, intervalMs = 200 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await getNginxStatus();
    if (status.running === expectRunning) return status;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return getNginxStatus();
}

async function startNginx() {
  const status = await getNginxStatus();
  if (status.running) return status;

  const conf = getNginxConfPath();
  // Windows 上 nginx 主进程不会立刻退出，不能等待 spawn 结束
  await runNginx(['-p', getNginxRootDir(), '-c', conf], { waitForExit: false });

  const next = await waitForNginxStatus(true);
  if (!next.running) {
    throw new Error('Nginx 启动超时，请查看 logs/error.log');
  }
  return next;
}

async function reloadNginx() {
  const status = await getNginxStatus();
  if (!status.running) return;
  const conf = getNginxConfPath();
  await runNginx(['-p', getNginxRootDir(), '-c', conf, '-s', 'reload']);
}

async function stopNginx() {
  const status = await getNginxStatus();
  if (!status.running) return status;

  const conf = getNginxConfPath();
  try {
    await runNginx(['-p', getNginxRootDir(), '-c', conf, '-s', 'quit']);
  } catch {
    try {
      process.kill(status.pid);
    } catch {}
  }

  return waitForNginxStatus(false);
}

module.exports = {
  ensureNginxReady,
  startNginx,
  stopNginx,
  reloadNginx,
  getNginxStatus
};


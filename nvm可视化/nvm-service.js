const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const https = require('https');
const path = require('path');
const fs = require('fs');

const execFileAsync = promisify(execFile);

function resolveNvmPath() {
  const candidates = [
    process.env.NVM_HOME && path.join(process.env.NVM_HOME, 'nvm.exe'),
    process.env.NVM_HOME && path.join(process.env.NVM_HOME, 'nvm.cmd'),
    'C:\\Program Files\\nvm\\nvm.exe',
    path.join(process.env.APPDATA || '', 'nvm', 'nvm.exe'),
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return 'nvm';
}

const NVM_FIXED = resolveNvmPath();

function getNvmBinary() {
  // 安装后可能出现新路径，每次动态解析
  const fresh = resolveNvmPath();
  if (fresh !== 'nvm') return fresh;
  return NVM_FIXED;
}

function runNvm(args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 20000;
  const { timeoutMs: _t, ...spawnOptions } = options;
  const nvmBin = getNvmBinary();

  return new Promise((resolve, reject) => {
    const isExe = nvmBin.toLowerCase().endsWith('.exe');
    const cmd = isExe ? nvmBin : process.env.ComSpec || 'cmd.exe';
    const cmdArgs = isExe ? args : ['/c', 'nvm', ...args];

    const child = spawn(cmd, cmdArgs, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NVM_HOME: process.env.NVM_HOME || (isExe ? path.dirname(nvmBin) : process.env.NVM_HOME),
      },
      ...spawnOptions,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      reject(new Error(`nvm ${args.join(' ')} 超时`));
    }, timeoutMs);

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr, output: (stdout + stderr).trim() });
    });
  });
}

function stripAnsi(text) {
  return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

function parseVersion(raw) {
  const m = String(raw).match(/(\d+\.\d+\.\d+)/);
  return m ? m[1] : null;
}

async function checkNvm() {
  try {
    const nvmBin = getNvmBinary();
    // 只有占位符 "nvm" 且找不到命令时再报未安装
    if (nvmBin === 'nvm') {
      try {
        const { output, code } = await runNvm(['version']);
        const version = stripAnsi(output).trim().split(/\r?\n/)[0];
        if (!version || (code !== 0 && !/^\d+\.\d+/.test(version))) {
          return { ok: false, message: '未检测到 nvm，请先安装 nvm-windows' };
        }
        return { ok: true, version, path: nvmBin };
      } catch {
        return { ok: false, message: '未检测到 nvm，请先安装 nvm-windows' };
      }
    }
    const { output, code } = await runNvm(['version']);
    const version = stripAnsi(output).trim().split(/\r?\n/)[0];
    if (code !== 0 && !version) {
      return { ok: false, message: '未检测到 nvm，请先安装 nvm-windows' };
    }
    return { ok: true, version, path: nvmBin };
  } catch (err) {
    return { ok: false, message: err.message || '无法运行 nvm' };
  }
}

async function upgradeNvmCli() {
  try {
    const { code, output } = await runNvm(['upgrade'], { timeoutMs: 120000 });
    const text = stripAnsi(output);
    const ok = code === 0 || /upgraded|already|success|complete/i.test(text);
    return { ok, message: text || (ok ? 'nvm 已更新' : '升级命令未成功，将尝试下载安装包') };
  } catch (err) {
    return { ok: false, message: err.message || 'upgrade 命令失败' };
  }
}

async function getStatus() {
  const [currentRes, archRes] = await Promise.all([
    runNvm(['current']),
    runNvm(['arch']),
  ]);
  const currentRaw = stripAnsi(currentRes.stdout || currentRes.output);
  let current = parseVersion(currentRaw);
  if (!current && /No current version|N\/A|none/i.test(currentRaw)) {
    current = null;
  }
  const archMatch = stripAnsi(archRes.output).match(/(\d+)/);
  return {
    current,
    arch: archMatch ? `${archMatch[1]}-bit` : null,
  };
}

async function listInstalled() {
  const { output } = await runNvm(['list']);
  const text = stripAnsi(output);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const versions = [];

  for (const line of lines) {
    if (/No installations|available/i.test(line)) continue;
    const version = parseVersion(line);
    if (!version) continue;
    const active = /^\*|Currently using/i.test(line) || line.includes('*');
    versions.push({ version, active, label: line.replace(/^\*\s*/, '') });
  }

  // 去重，保留 active 标记
  const map = new Map();
  for (const v of versions) {
    const prev = map.get(v.version);
    map.set(v.version, {
      version: v.version,
      active: (prev && prev.active) || v.active,
    });
  }
  return [...map.values()].sort(compareSemverDesc);
}

function compareSemverDesc(a, b) {
  const pa = a.version.split('.').map(Number);
  const pb = b.version.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pb[i] - pa[i];
  }
  return 0;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'nvm-gui' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchJson(res.headers.location).then(resolve).catch(reject);
          return;
        }
        let data = '';
        res.on('data', (c) => {
          data += c;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

const DIST_INDEX_URLS = [
  'https://nodejs.org/dist/index.json',
  'https://cdn.npmmirror.com/binaries/node/index.json',
  'https://npmmirror.com/mirrors/node/index.json',
];

function normalizeAvailable(data) {
  return data
    .map((item) => ({
      version: String(item.version).replace(/^v/, ''),
      lts: item.lts === false || item.lts == null ? null : String(item.lts),
      date: item.date || null,
      npm: item.npm || null,
    }))
    .filter((v) => /^\d+\.\d+\.\d+$/.test(v.version));
}

async function listAvailable() {
  const errors = [];
  for (const url of DIST_INDEX_URLS) {
    try {
      const data = await fetchJson(url);
      if (Array.isArray(data) && data.length) {
        return normalizeAvailable(data);
      }
    } catch (err) {
      errors.push(`${url}: ${err.message}`);
    }
  }

  // 回退到 nvm list available
  const { output } = await runNvm(['list', 'available']);
  const text = stripAnsi(output);
  const found = new Set();
  const re = /(\d+\.\d+\.\d+)/g;
  let m;
  while ((m = re.exec(text))) {
    found.add(m[1]);
  }
  if (found.size) {
    return [...found].map((version) => ({
      version,
      lts: null,
      date: null,
      npm: null,
    }));
  }

  throw new Error(`无法获取可安装版本列表。${errors.join('；')}`);
}

async function install(version) {
  const ver = version === 'latest' || version === 'lts' ? version : parseVersion(version);
  if (!ver) return { ok: false, message: '无效的版本号' };
  const { code, output } = await runNvm(['install', ver]);
  const text = stripAnsi(output);
  const ok = code === 0 || /Installation complete|already installed/i.test(text);
  return { ok, message: text || (ok ? '安装完成' : '安装失败') };
}

async function uninstall(version) {
  const ver = parseVersion(version);
  if (!ver) return { ok: false, message: '无效的版本号' };
  const { code, output } = await runNvm(['uninstall', ver]);
  const text = stripAnsi(output);
  const ok = code === 0 || /uninstalled|not installed/i.test(text);
  return { ok, message: text || (ok ? '卸载完成' : '卸载失败') };
}

async function use(version) {
  const ver = parseVersion(version);
  if (!ver) return { ok: false, message: '无效的版本号' };
  const { code, output } = await runNvm(['use', ver]);
  const text = stripAnsi(output);
  const ok = code === 0 || /now using|is already/i.test(text);
  return {
    ok,
    message: text || (ok ? `已切换到 ${ver}` : '切换失败（可能需要管理员权限）'),
  };
}

module.exports = {
  checkNvm,
  getStatus,
  listInstalled,
  listAvailable,
  install,
  uninstall,
  use,
  upgradeNvmCli,
  getNvmBinary,
};

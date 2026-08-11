import { sshPool } from '../ssh/pool.js';

const ROOT = '/opt/vizops';
const SITES_ROOT = '/opt/vizops/sites';
const ALLOWED_PREFIX = '/opt/vizops/';
/** Docker 命名卷数据目录，例如 /var/lib/docker/volumes/xxx/_data */
const VOLUME_DATA_RE = /^\/var\/lib\/docker\/volumes\/[a-zA-Z0-9][a-zA-Z0-9_.-]*\/_data(\/.*)?$/;

function shellQuote(s: string): string {
  if (/^[a-zA-Z0-9_./:=@+-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export function isEditablePath(path: string): boolean {
  const p = (path || '').trim().replace(/\\/g, '/').replace(/\/+$/, '') || '';
  if (!p || p.includes('..') || p.includes('\0')) return false;
  if (p === ROOT || p === SITES_ROOT || p.startsWith(ALLOWED_PREFIX)) return true;
  return VOLUME_DATA_RE.test(p);
}

/** 允许：本工具站点目录，或 Docker 卷 _data 目录 */
export function assertEditablePath(raw: string): string {
  const path = (raw || '').trim().replace(/\\/g, '/').replace(/\/+$/, '') || SITES_ROOT;
  if (!isEditablePath(path)) {
    throw new Error(
      '只能编辑 /opt/vizops/ 下的站点文件，或 Docker 卷目录（/var/lib/docker/volumes/*/ _data）',
    );
  }
  return path;
}

export interface DirEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  mtime: string;
}

/**
 * 列目录。注意：不能用 `sudo python <<EOF`（sudo 会吃掉 stdin 导致脚本空跑）。
 * 改为把脚本写到临时文件再执行。
 */
export async function listSiteDir(serverId: string, dirPath: string): Promise<{
  path: string;
  entries: DirEntry[];
}> {
  let listPath = assertEditablePath(dirPath || SITES_ROOT);
  if (listPath === ROOT) listPath = SITES_ROOT;

  const py = `
# -*- coding: utf-8 -*-
from __future__ import print_function
import json, os, time, subprocess
try:
    from subprocess import DEVNULL
except ImportError:
    DEVNULL = open(os.devnull, "wb")

root = ${JSON.stringify(listPath)}

def run(cmd):
    out = subprocess.check_output(cmd, stderr=DEVNULL)
    if not isinstance(out, str):
        out = out.decode("utf-8", "ignore")
    return out

def ensure_sites():
    p = ${JSON.stringify(SITES_ROOT)}
    try:
        if not os.path.isdir(p):
            os.makedirs(p)
    except Exception:
        subprocess.call(["mkdir", "-p", p], stdout=DEVNULL, stderr=DEVNULL)
        subprocess.call(["sudo", "mkdir", "-p", p], stdout=DEVNULL, stderr=DEVNULL)

ensure_sites()

def exists_dir(p):
    if os.path.isdir(p):
        return True
    try:
        return subprocess.call(["sudo", "test", "-d", p], stdout=DEVNULL, stderr=DEVNULL) == 0
    except Exception:
        return False

if not exists_dir(root):
    print(json.dumps({"path": root, "entries": [], "error": "dir not found: " + root}))
    raise SystemExit(0)

def list_names(p):
    try:
        return os.listdir(p)
    except Exception:
        out = run(["sudo", "ls", "-1A", p])
        return [x for x in out.splitlines() if x]

def file_stat(full):
    try:
        st = os.stat(full)
        return ("dir" if os.path.isdir(full) else "file", int(st.st_size), float(st.st_mtime))
    except Exception:
        out = run(["sudo", "stat", "-c", "%F|%s|%Y", full]).strip()
        kind, size, mtime = out.split("|", 2)
        kind_l = kind.lower()
        is_dir = ("directory" in kind_l) or kind_l.startswith("dir")
        return ("dir" if is_dir else "file", int(size), float(mtime))

try:
    names = list_names(root)
except Exception as e:
    print(json.dumps({"path": root, "entries": [], "error": "list failed: " + str(e)}))
    raise SystemExit(0)

rows = []
for name in names:
    if name in (".", ".."):
        continue
    full = os.path.join(root, name)
    try:
        typ, size, mtime = file_stat(full)
        rows.append({
            "name": name,
            "path": full.replace("\\\\", "/"),
            "type": typ,
            "size": 0 if typ == "dir" else size,
            "mtime": time.strftime("%Y-%m-%d %H:%M", time.localtime(mtime)),
        })
    except Exception:
        continue

rows.sort(key=lambda x: (0 if x["type"] == "dir" else 1, x["name"].lower()))
print(json.dumps({"path": root.replace("\\\\", "/"), "entries": rows}))
`.trim();

  const script = `
set -e
mkdir -p /tmp/vizops-edit 2>/dev/null || sudo mkdir -p /tmp/vizops-edit
SCRIPT=/tmp/vizops-edit/list_dir.py
cat > "$SCRIPT" <<'PY'
${py}
PY
# Prefer python3 (CentOS7 python is often 2.x)
PYBIN=$(command -v python3 || true)
if [ -z "$PYBIN" ]; then PYBIN=$(command -v python || true); fi
if [ -z "$PYBIN" ]; then
  echo '{"error":"python/python3 not installed","path":"","entries":[]}'
  exit 0
fi
if "$PYBIN" "$SCRIPT" 2>/tmp/vizops-edit/list.err; then
  :
elif sudo "$PYBIN" "$SCRIPT" 2>/tmp/vizops-edit/list.err; then
  :
else
  ERR=$(tr -d '\\r' </tmp/vizops-edit/list.err 2>/dev/null | tr '\\n' ' ' | head -c 180)
  python3 -c "import json; print(json.dumps({'error':'list failed: '+'''$ERR''','path':'','entries':[]}))" 2>/dev/null \\
    || echo '{"error":"list failed","path":"","entries":[]}'
fi
rm -f "$SCRIPT" 2>/dev/null || true
`;

  const result = await sshPool.exec(serverId, script, 30000);
  const line = (result.stdout || '').trim().split('\n').filter(Boolean).pop() || '{}';
  let data: { error?: string; path?: string; entries?: DirEntry[] };
  try {
    data = JSON.parse(line);
  } catch {
    throw new Error(`列出目录失败：${(result.stderr || result.stdout || '').slice(0, 200)}`);
  }
  if (data.error && (!data.entries || data.entries.length === 0)) {
    const msg = data.error
      .replace(/^dir not found:/, '目录不存在:')
      .replace(/^list failed:/, '无法读取目录:');
    throw new Error(msg);
  }
  return { path: data.path || listPath, entries: data.entries || [] };
}

export interface DeploySiteInfo {
  name: string;
  path: string;
  htmlPath: string;
  confPath: string;
  hasHtml: boolean;
  hasIndex: boolean;
}

/** 列出 /opt/vizops/sites 下可选站点（供部署页选择） */
export async function listDeploySites(serverId: string): Promise<DeploySiteInfo[]> {
  const { entries } = await listSiteDir(serverId, SITES_ROOT);
  const sites: DeploySiteInfo[] = [];
  for (const ent of entries.filter((e) => e.type === 'dir')) {
    const htmlPath = `${ent.path}/html`;
    const confPath = `${ent.path}/conf`;
    let hasHtml = false;
    let hasIndex = false;
    try {
      const htmlList = await listSiteDir(serverId, htmlPath);
      hasHtml = true;
      hasIndex = htmlList.entries.some((e) => e.type === 'file' && e.name === 'index.html');
    } catch {
      hasHtml = false;
      hasIndex = false;
    }
    sites.push({
      name: ent.name,
      path: ent.path,
      htmlPath,
      confPath,
      hasHtml,
      hasIndex,
    });
  }
  sites.sort((a, b) => a.name.localeCompare(b.name));
  return sites;
}

export async function readSiteFile(
  serverId: string,
  filePath: string,
): Promise<{ path: string; content: string; size: number }> {
  const path = assertEditablePath(filePath);
  if (path === ROOT || path === SITES_ROOT) {
    throw new Error('请指定具体文件路径');
  }
  if (!isEditablePath(path)) {
    throw new Error('路径不在可编辑范围内');
  }
  const script = `
set -e
P=${shellQuote(path)}
if [ -f "$P" ]; then
  SIZE=$(wc -c < "$P" | tr -d ' ')
elif sudo test -f "$P"; then
  SIZE=$(sudo wc -c < "$P" | tr -d ' ')
  USE_SUDO=1
else
  echo '__ERR__文件不存在'
  exit 1
fi
CAT=cat
GREP=grep
if [ "\${USE_SUDO:-0}" = "1" ]; then CAT="sudo cat"; GREP="sudo grep"; fi
if [ "$SIZE" -eq 0 ] || $GREP -Iq . "$P" 2>/dev/null; then
  printf '__SIZE__%s\\n' "$SIZE"
  $CAT "$P"
else
  echo '__ERR__该文件看起来是二进制，请重新部署覆盖'
  exit 1
fi
`;
  const result = await sshPool.exec(serverId, script, 30 * 60 * 1000);
  const out = result.stdout || '';
  if (out.startsWith('__ERR__') || (result.code !== 0 && !out.startsWith('__SIZE__'))) {
    throw new Error(
      out.replace(/^__ERR__/, '').trim() || result.stderr.trim() || '读取文件失败',
    );
  }
  const nl = out.indexOf('\n');
  const head = nl >= 0 ? out.slice(0, nl) : out;
  const body = nl >= 0 ? out.slice(nl + 1) : '';
  const size = Number(head.replace('__SIZE__', '')) || Buffer.byteLength(body, 'utf8');
  return { path, content: body, size };
}

export async function writeSiteFile(
  serverId: string,
  filePath: string,
  content: string,
): Promise<{ ok: boolean; path: string; size: number }> {
  const path = assertEditablePath(filePath);
  if (!isEditablePath(path)) {
    throw new Error('路径不在可编辑范围内');
  }
  if (typeof content !== 'string') throw new Error('内容无效');
  const buf = Buffer.from(content, 'utf8');
  const parent = path.slice(0, path.lastIndexOf('/'));
  if (isEditablePath(parent) || parent.startsWith('/var/lib/docker/volumes/')) {
    await sshPool.exec(
      serverId,
      `mkdir -p ${shellQuote(parent)} 2>/dev/null || sudo mkdir -p ${shellQuote(parent)}`,
    );
  }
  const tmp = `/tmp/vizops-edit-${Date.now()}.txt`;
  await sshPool.uploadFile(serverId, tmp, buf);
  const move = await sshPool.exec(
    serverId,
    `sudo mv -f ${shellQuote(tmp)} ${shellQuote(path)} && sudo chmod a+r ${shellQuote(path)} || mv -f ${shellQuote(tmp)} ${shellQuote(path)}`,
  );
  if (move.code !== 0) {
    throw new Error(move.stderr || move.stdout || '写入文件失败');
  }
  return { ok: true, path, size: buf.length };
}

/** 上传二进制到可编辑目录（先写 /tmp，再 sudo mv，兼容卷目录权限） */
export async function uploadEditableFile(
  serverId: string,
  destPath: string,
  readable: NodeJS.ReadableStream,
  _expectedSize?: number,
): Promise<{ ok: boolean; path: string; size: number }> {
  const path = assertEditablePath(destPath);
  if (path === ROOT || path === SITES_ROOT) {
    throw new Error('请指定具体文件路径（需包含文件名）');
  }
  const base = path.split('/').pop() || '';
  if (!base || base === '.' || base === '..' || base.includes('/') || base.includes('\\')) {
    throw new Error('文件名无效');
  }

  const tmp = `/tmp/vizops-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { size } = await sshPool.uploadStream(serverId, tmp, readable);
  if (!size) {
    await sshPool.exec(serverId, `rm -f ${shellQuote(tmp)}`).catch(() => undefined);
    throw new Error('未收到文件内容');
  }

  const parent = path.slice(0, path.lastIndexOf('/'));
  if (parent && (isEditablePath(parent) || parent.startsWith('/var/lib/docker/volumes/'))) {
    await sshPool.exec(
      serverId,
      `mkdir -p ${shellQuote(parent)} 2>/dev/null || sudo mkdir -p ${shellQuote(parent)}`,
    );
  }

  const move = await sshPool.exec(
    serverId,
    `sudo mv -f ${shellQuote(tmp)} ${shellQuote(path)} && sudo chmod a+r ${shellQuote(path)} || mv -f ${shellQuote(tmp)} ${shellQuote(path)}`,
  );
  if (move.code !== 0) {
    await sshPool.exec(serverId, `rm -f ${shellQuote(tmp)}`).catch(() => undefined);
    throw new Error(move.stderr || move.stdout || '上传文件失败');
  }
  return { ok: true, path, size };
}

/** 在可编辑范围内新建目录 */
export async function mkdirEditable(
  serverId: string,
  dirPath: string,
): Promise<{ ok: boolean; path: string }> {
  const path = assertEditablePath(dirPath);
  if (path === ROOT) {
    throw new Error('不能在此路径创建目录');
  }
  const result = await sshPool.exec(
    serverId,
    `mkdir -p ${shellQuote(path)} 2>/dev/null || sudo mkdir -p ${shellQuote(path)}`,
  );
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || '创建目录失败');
  }
  return { ok: true, path };
}

/**
 * 在 /opt/vizops/sites 下新建站点骨架：html/ + conf/default.conf
 * 供文件管理「新建站点」与部署「已有站点」使用。
 */
export async function createSiteSkeleton(
  serverId: string,
  siteName: string,
): Promise<{ ok: boolean; path: string; htmlPath: string; confPath: string }> {
  const raw = (siteName || '').trim().replace(/\\/g, '/');
  const name = raw.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!name) {
    throw new Error('站点名称无效：请使用英文、数字、下划线或中划线');
  }
  const base = `${SITES_ROOT}/${name}`;
  const htmlPath = `${base}/html`;
  const confPath = `${base}/conf`;
  const confFile = `${confPath}/default.conf`;

  const script = `
set -e
BASE=${shellQuote(base)}
HTML=${shellQuote(htmlPath)}
CONF=${shellQuote(confPath)}
CF=${shellQuote(confFile)}
mkdir -p "$HTML" "$CONF" 2>/dev/null || sudo mkdir -p "$HTML" "$CONF"
if [ ! -f "$CF" ]; then
  sudo tee "$CF" > /dev/null <<'NGX'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public";
    }
}
NGX
fi
if [ ! -f "$HTML/index.html" ]; then
  sudo tee "$HTML/index.html" > /dev/null <<'HTML'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>站点已创建</title>
</head>
<body>
  <h1>站点目录已就绪</h1>
  <p>请将前端构建产物上传到本目录（覆盖此页面）。</p>
</body>
</html>
HTML
fi
echo OK
`;
  const result = await sshPool.exec(serverId, script, 30000);
  if (result.code !== 0 || !/OK/.test(result.stdout)) {
    throw new Error(result.stderr || result.stdout || '创建站点目录失败');
  }
  return { ok: true, path: base, htmlPath, confPath };
}

export interface PathCheckResult {
  path: string;
  exists: boolean;
  type?: 'file' | 'dir';
}

/** 批量检查可编辑路径是否已存在（用于上传前冲突确认） */
export async function checkEditablePaths(
  serverId: string,
  rawPaths: string[],
): Promise<PathCheckResult[]> {
  const paths = [...new Set((rawPaths || []).map((p) => assertEditablePath(p)))];
  if (paths.length === 0) return [];
  if (paths.length > 500) {
    throw new Error('一次最多检查 500 个路径');
  }

  const py = `
# -*- coding: utf-8 -*-
from __future__ import print_function
import json, os, subprocess
try:
    from subprocess import DEVNULL
except ImportError:
    DEVNULL = open(os.devnull, "wb")

paths = ${JSON.stringify(paths)}

def exists(p):
    if os.path.exists(p):
        return True, ("dir" if os.path.isdir(p) else "file")
    try:
        if subprocess.call(["sudo", "test", "-e", p], stdout=DEVNULL, stderr=DEVNULL) != 0:
            return False, None
        is_dir = subprocess.call(["sudo", "test", "-d", p], stdout=DEVNULL, stderr=DEVNULL) == 0
        return True, ("dir" if is_dir else "file")
    except Exception:
        return False, None

rows = []
for p in paths:
    ok, typ = exists(p)
    row = {"path": p, "exists": bool(ok)}
    if ok and typ:
        row["type"] = typ
    rows.append(row)
print(json.dumps({"items": rows}))
`.trim();

  const script = `
set -e
mkdir -p /tmp/vizops-edit 2>/dev/null || sudo mkdir -p /tmp/vizops-edit
SCRIPT=/tmp/vizops-edit/check_paths.py
cat > "$SCRIPT" <<'PY'
${py}
PY
PYBIN=$(command -v python3 || true)
if [ -z "$PYBIN" ]; then PYBIN=$(command -v python || true); fi
if [ -z "$PYBIN" ]; then
  echo '{"error":"python/python3 not installed","items":[]}'
  exit 0
fi
if "$PYBIN" "$SCRIPT" 2>/tmp/vizops-edit/check.err; then
  :
elif sudo "$PYBIN" "$SCRIPT" 2>/tmp/vizops-edit/check.err; then
  :
else
  echo '{"error":"check failed","items":[]}'
fi
rm -f "$SCRIPT" 2>/dev/null || true
`;

  const result = await sshPool.exec(serverId, script, 60000);
  const line = (result.stdout || '').trim().split('\n').filter(Boolean).pop() || '{}';
  let data: { error?: string; items?: PathCheckResult[] };
  try {
    data = JSON.parse(line);
  } catch {
    throw new Error(`检查路径失败：${(result.stderr || result.stdout || '').slice(0, 200)}`);
  }
  if (data.error && (!data.items || data.items.length === 0)) {
    throw new Error(data.error);
  }
  return data.items || [];
}

/** 在可编辑范围内删除文件或目录（目录递归） */
export async function removeEditable(
  serverId: string,
  targetPath: string,
): Promise<{ ok: boolean; path: string }> {
  const path = assertEditablePath(targetPath);
  if (
    path === ROOT ||
    path === SITES_ROOT ||
    /^\/var\/lib\/docker\/volumes\/[a-zA-Z0-9][a-zA-Z0-9_.-]*\/_data$/.test(path)
  ) {
    throw new Error('不能删除根目录，请进入子目录后删除具体文件或目录');
  }
  const result = await sshPool.exec(
    serverId,
    `rm -rf -- ${shellQuote(path)} 2>/dev/null || sudo rm -rf -- ${shellQuote(path)}`,
  );
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || '删除失败');
  }
  return { ok: true, path };
}

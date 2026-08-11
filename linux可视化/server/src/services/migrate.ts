import { sshPool } from '../ssh/pool.js';
import {
  createVolume,
  inspectContainer,
  listContainers,
  listVolumes,
  loadImageFromArchive,
  runContainer,
  type ContainerMount,
} from './docker.js';

const LONG_TIMEOUT = 60 * 60 * 1000;
const ALLOWED_BIND_PREFIX = '/opt/vizops/';
const VOLUME_DATA_RE = /^\/var\/lib\/docker\/volumes\/([a-zA-Z0-9][a-zA-Z0-9_.-]*)\/_data$/;

function shellQuote(s: string): string {
  if (/^[a-zA-Z0-9_./:=@+-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function log(onData: (chunk: string) => void, msg: string) {
  onData(`${msg}\n`);
}

function tmpName(prefix: string): string {
  return `/tmp/vizops-mig-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tar.gz`;
}

function tmpTar(prefix: string): string {
  return `/tmp/vizops-mig-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tar`;
}

async function cleanup(serverId: string, path: string) {
  await sshPool
    .exec(serverId, `rm -f ${shellQuote(path)} 2>/dev/null || sudo rm -f ${shellQuote(path)}`)
    .catch(() => undefined);
}

/** 解析 inspect 端口为 docker run -p 参数，如 8080:80 */
function portsToRunFlags(ports: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of ports) {
    // 0.0.0.0:8080->80/tcp 或 :::8080->80/tcp
    const m = /(?:[\d.:[\]]+:)?(\d+)(?:-\d+)?->(\d+)(?:-\d+)?\/tcp/i.exec(p);
    if (!m) continue;
    const flag = `${m[1]}:${m[2]}`;
    if (seen.has(flag)) continue;
    seen.add(flag);
    out.push(flag);
  }
  return out;
}

function volumeNameFromMount(m: ContainerMount): string | null {
  if (m.name && /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(m.name)) return m.name;
  const match = VOLUME_DATA_RE.exec((m.source || '').replace(/\/+$/, ''));
  return match?.[1] || null;
}

function isAllowedBind(source: string): boolean {
  const p = (source || '').replace(/\/+$/, '');
  return p === '/opt/vizops' || p.startsWith(ALLOWED_BIND_PREFIX);
}

async function transferArchive(
  fromId: string,
  fromPath: string,
  toId: string,
  toPath: string,
  onData: (chunk: string) => void,
): Promise<number> {
  // 先查源文件大小，便于判断是否异常缓慢
  const sizeCheck = await sshPool.exec(
    fromId,
    `if [ -f ${shellQuote(fromPath)} ]; then wc -c < ${shellQuote(fromPath)}; elif sudo test -f ${shellQuote(fromPath)}; then sudo wc -c < ${shellQuote(fromPath)}; else echo 0; fi`,
  );
  const expected = Number(String(sizeCheck.stdout || '').trim()) || 0;
  if (expected > 0) {
    log(
      onData,
      `[传输] ${fromPath} → 目标（约 ${(expected / 1024 / 1024).toFixed(1)} MB，经本机中转）`,
    );
  } else {
    log(onData, `[传输] ${fromPath} → 目标（经本机中转）`);
  }

  const { size } = await sshPool.transferFile(fromId, fromPath, toId, toPath, (msg) =>
    log(onData, msg),
  );
  log(onData, `[传输完成] ${(size / 1024 / 1024).toFixed(2)} MB`);
  return size;
}

async function copyBindPath(
  fromId: string,
  toId: string,
  absPath: string,
  onData: (chunk: string) => void,
) {
  const path = absPath.replace(/\/+$/, '');
  if (!isAllowedBind(path)) {
    log(onData, `[跳过] 非允许路径的绑定：${path}`);
    return;
  }

  const exists = await sshPool.exec(
    fromId,
    `if [ -e ${shellQuote(path)} ] || sudo test -e ${shellQuote(path)}; then echo OK; else echo NO; fi`,
  );
  if (!/OK/.test(exists.stdout)) {
    log(onData, `[警告] 源路径不存在，跳过：${path}`);
    return;
  }

  const archive = tmpName('bind');
  log(onData, `[打包] 绑定路径 ${path}`);
  const pack = await sshPool.exec(
    fromId,
    `
set -e
P=${shellQuote(path)}
OUT=${shellQuote(archive)}
# 从 / 打包相对路径，目标解压后路径一致
REL=\${P#/}
if [ -e "$P" ]; then
  tar czf "$OUT" -C / "$REL"
elif sudo test -e "$P"; then
  sudo tar czf "$OUT" -C / "$REL"
  sudo chmod a+r "$OUT" 2>/dev/null || true
else
  echo "missing" >&2
  exit 1
fi
`,
    LONG_TIMEOUT,
  );
  if (pack.code !== 0) {
    throw new Error(`打包失败 ${path}：${pack.stderr || pack.stdout}`);
  }

  const destArchive = tmpName('bind-dst');
  try {
    await transferArchive(fromId, archive, toId, destArchive, onData);
    log(onData, `[解压] 到目标 ${path}`);
    const unpack = await sshPool.exec(
      toId,
      `
set -e
OUT=${shellQuote(destArchive)}
PARENT=${shellQuote(path.includes('/') ? path.slice(0, path.lastIndexOf('/')) || '/' : '/')}
mkdir -p "$PARENT" 2>/dev/null || sudo mkdir -p "$PARENT"
if tar xzf "$OUT" -C / 2>/dev/null; then
  :
elif sudo tar xzf "$OUT" -C /; then
  :
else
  echo "unpack failed" >&2
  exit 1
fi
rm -f "$OUT" 2>/dev/null || sudo rm -f "$OUT"
`,
      LONG_TIMEOUT,
    );
    if (unpack.code !== 0) {
      throw new Error(`解压失败 ${path}：${unpack.stderr || unpack.stdout}`);
    }
  } finally {
    await cleanup(fromId, archive);
    await cleanup(toId, destArchive);
  }
}

async function copyNamedVolume(
  fromId: string,
  toId: string,
  volumeName: string,
  sourceDataPath: string,
  overwrite: boolean,
  onData: (chunk: string) => void,
) {
  const existing = await listVolumes(toId);
  const has = existing.some((v) => v.name === volumeName);
  if (has && !overwrite) {
    log(onData, `[跳过数据] 目标已有卷 ${volumeName}（未勾选覆盖）`);
    return;
  }
  if (!has) {
    log(onData, `[创建卷] ${volumeName}`);
    await createVolume(toId, volumeName);
  } else {
    log(onData, `[覆盖卷数据] ${volumeName}`);
  }

  const vols = await listVolumes(toId);
  const target = vols.find((v) => v.name === volumeName);
  const mountpoint = (target?.mountpoint || '').replace(/\/+$/, '');
  if (!mountpoint) {
    throw new Error(`无法获取目标卷挂载点：${volumeName}`);
  }

  const srcData = sourceDataPath.replace(/\/+$/, '') || `/var/lib/docker/volumes/${volumeName}/_data`;
  const archive = tmpName('vol');
  log(onData, `[打包] 卷数据 ${srcData}`);
  const pack = await sshPool.exec(
    fromId,
    `
set -e
SRC=${shellQuote(srcData)}
OUT=${shellQuote(archive)}
if [ -d "$SRC" ]; then
  tar czf "$OUT" -C "$SRC" .
elif sudo test -d "$SRC"; then
  sudo tar czf "$OUT" -C "$SRC" .
  sudo chmod a+r "$OUT" 2>/dev/null || true
else
  echo "volume data missing: $SRC" >&2
  exit 1
fi
`,
    LONG_TIMEOUT,
  );
  if (pack.code !== 0) {
    throw new Error(`打包卷失败 ${volumeName}：${pack.stderr || pack.stdout}`);
  }

  const destArchive = tmpName('vol-dst');
  try {
    await transferArchive(fromId, archive, toId, destArchive, onData);
    log(onData, `[解压] 到 ${mountpoint}`);
    const unpack = await sshPool.exec(
      toId,
      `
set -e
OUT=${shellQuote(destArchive)}
MP=${shellQuote(mountpoint)}
mkdir -p "$MP" 2>/dev/null || sudo mkdir -p "$MP"
# 覆盖时先清空（保留目录本身）
if [ "${overwrite ? '1' : '0'}" = "1" ]; then
  sudo find "$MP" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
fi
if sudo tar xzf "$OUT" -C "$MP"; then
  :
elif tar xzf "$OUT" -C "$MP"; then
  :
else
  echo "unpack volume failed" >&2
  exit 1
fi
rm -f "$OUT" 2>/dev/null || sudo rm -f "$OUT"
`,
      LONG_TIMEOUT,
    );
    if (unpack.code !== 0) {
      throw new Error(`解压卷失败 ${volumeName}：${unpack.stderr || unpack.stdout}`);
    }
  } finally {
    await cleanup(fromId, archive);
    await cleanup(toId, destArchive);
  }
}

function buildVolumeFlags(mounts: ContainerMount[]): string[] {
  const flags: string[] = [];
  for (const m of mounts) {
    if (!m.destination) continue;
    const mode = m.rw === false || /\bro\b/i.test(m.mode || '') ? ':ro' : '';
    const typ = (m.type || '').toLowerCase();
    if (typ === 'volume' || volumeNameFromMount(m)) {
      const vn = volumeNameFromMount(m);
      if (!vn) {
        continue;
      }
      flags.push(`${vn}:${m.destination}${mode}`);
      continue;
    }
    if (typ === 'bind' || m.source.startsWith('/')) {
      if (!isAllowedBind(m.source)) continue;
      flags.push(`${m.source.replace(/\/+$/, '')}:${m.destination}${mode}`);
    }
  }
  return flags;
}

export interface CopyContainerOptions {
  targetName?: string;
  overwriteVolumeData?: boolean;
}

/**
 * 复制容器到另一台服务器：镜像 + 允许的绑定目录 + 命名卷数据 + 按 inspect 重建。
 * 源机不做停止/删除。
 */
export async function copyContainer(
  fromId: string,
  toId: string,
  containerRef: string,
  options: CopyContainerOptions,
  onData: (chunk: string) => void,
): Promise<{ code: number }> {
  if (!fromId || !toId) throw new Error('请指定源服务器和目标服务器');
  if (fromId === toId) throw new Error('源服务器与目标服务器不能相同');
  if (!sshPool.isConnected(fromId)) throw new Error('源服务器未连接');
  if (!sshPool.isConnected(toId)) throw new Error('目标服务器未连接');

  const ref = containerRef.trim();
  if (!ref) throw new Error('请指定要复制的容器');

  log(onData, `[1/5] 读取源容器配置：${ref}`);
  const detail = await inspectContainer(fromId, ref);
  const targetName = (options.targetName || detail.name || ref).trim();
  if (!targetName || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(targetName)) {
    throw new Error('目标容器名称无效（仅英文、数字、._-）');
  }

  const existing = await listContainers(toId);
  if (existing.some((c) => c.name === targetName)) {
    throw new Error(`目标服务器已存在同名容器「${targetName}」，请更换名称后重试`);
  }

  const image = detail.image.trim();
  if (!image) throw new Error('源容器没有可用镜像名');

  // —— 镜像 ——
  log(onData, `[2/5] 导出镜像 ${image}`);
  const imageTar = tmpTar('img');
  const save = await sshPool.execStream(
    fromId,
    `
set -e
IMG=${shellQuote(image)}
OUT=${shellQuote(imageTar)}
docker_bin() {
  if docker info >/dev/null 2>&1; then echo docker; else echo "sudo docker"; fi
}
D=$(docker_bin)
echo "[信息] 正在 docker save ..."
$D save -o "$OUT" "$IMG"
if [ -f "$OUT" ]; then
  :
elif sudo test -f "$OUT"; then
  sudo chmod a+r "$OUT" 2>/dev/null || true
else
  echo "save failed" >&2
  exit 1
fi
SIZE=$(du -h "$OUT" 2>/dev/null | awk '{print $1}')
echo "[信息] 镜像包大小: $SIZE"
`,
    onData,
    LONG_TIMEOUT,
  );
  if (save.code !== 0) {
    await cleanup(fromId, imageTar);
    throw new Error(`导出镜像失败：${save.stderr || save.stdout || '未知错误'}`);
  }

  const destImageTar = `/tmp/vizops-mig-img-${Date.now()}.tar`;
  try {
    await transferArchive(fromId, imageTar, toId, destImageTar, onData);
    log(onData, `[2/5] 在目标机导入镜像`);
    const load = await loadImageFromArchive(toId, destImageTar, onData);
    if (load.code !== 0) {
      throw new Error('目标机导入镜像失败');
    }
  } finally {
    await cleanup(fromId, imageTar);
    await cleanup(toId, destImageTar);
  }

  // —— 挂载数据 ——
  log(onData, `[3/5] 复制挂载数据（共 ${detail.mounts.length} 项）`);
  const overwrite = !!options.overwriteVolumeData;
  for (const m of detail.mounts) {
    const typ = (m.type || '').toLowerCase();
    if (typ === 'volume' || volumeNameFromMount(m)) {
      const vn = volumeNameFromMount(m);
      if (!vn) {
        log(onData, `[跳过] 无法识别卷名：${m.source} → ${m.destination}`);
        continue;
      }
      await copyNamedVolume(fromId, toId, vn, m.source, overwrite, onData);
      continue;
    }
    if (typ === 'bind' || m.source.startsWith('/')) {
      if (!isAllowedBind(m.source)) {
        log(onData, `[跳过] 绑定路径不在允许范围：${m.source}`);
        continue;
      }
      await copyBindPath(fromId, toId, m.source, onData);
      continue;
    }
    log(onData, `[跳过] 不支持的挂载类型 ${m.type}：${m.source}`);
  }

  // —— 重建容器 ——
  log(onData, `[4/5] 在目标机创建容器 ${targetName}`);
  const ports = portsToRunFlags(detail.ports);
  const volumes = buildVolumeFlags(detail.mounts);
  // 过滤掉 docker 注入的无意义环境变量噪声，保留业务相关
  const env = (detail.env || []).filter((e) => {
    const key = e.split('=')[0];
    return key && !['PATH', 'HOSTNAME', 'HOME', 'TERM'].includes(key);
  });
  const restart =
    detail.restartPolicy && detail.restartPolicy !== 'no' ? detail.restartPolicy : 'unless-stopped';

  await runContainer(toId, {
    image,
    name: targetName,
    ports,
    env,
    volumes,
    restart,
    detach: true,
  });

  log(onData, `[5/5] 完成：容器 ${targetName} 已在目标服务器启动`);
  log(onData, `源服务器保持不变。镜像=${image}；端口=${ports.join(', ') || '无'}；挂载=${volumes.length}`);
  return { code: 0 };
}

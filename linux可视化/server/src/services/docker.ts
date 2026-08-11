import { sshPool } from '../ssh/pool.js';
import { translateError } from '../ssh/errors.js';

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  statusText: string;
  state: string;
  ports: string;
  created: string;
}

export interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
}

function shellQuote(s: string): string {
  if (/^[a-zA-Z0-9_./:=@+-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function translateDockerOutput(text: string): string {
  const t = (text || '').trim();
  if (!t) return '容器操作失败';
  if (/Cannot connect to the Docker daemon|Is the docker daemon running/i.test(t)) {
    return 'Docker 服务未运行。请到「安装 Docker」页点击安装/启动，或在服务器执行：systemctl start docker';
  }
  if (/permission denied.*docker/i.test(t)) {
    return 'Docker 权限不足：请将当前用户加入 docker 组后，断开并重新连接 SSH。';
  }
  if (/No such container/i.test(t)) {
    return '找不到该容器，请刷新列表后重试。';
  }
  if (/is already running/i.test(t)) {
    return '容器已在运行中。';
  }
  if (/port is already allocated|Bind for.*failed/i.test(t)) {
    return '端口已被占用，请先停止占用该端口的容器或进程。';
  }
  if (/iptables failed|failed programming external connectivity/i.test(t)) {
    return '启动失败：Docker 网络/防火墙规则异常（iptables）。可尝试重启 Docker：systemctl restart docker，或检查端口是否冲突。';
  }
  if (/Error response from daemon:\s*(.+)/i.test(t)) {
    const m = t.match(/Error response from daemon:\s*([\s\S]+)/i);
    const detail = (m?.[1] || t).trim().replace(/\s+/g, ' ');
    // 过长细节截断，避免前端提示撑爆
    const short = detail.length > 180 ? `${detail.slice(0, 180)}…` : detail;
    return `Docker 错误：${short}`;
  }
  return translateError(t);
}

function translateState(state: string): string {
  const map: Record<string, string> = {
    running: '运行中',
    exited: '已停止',
    created: '已创建',
    paused: '已暂停',
    restarting: '重启中',
    removing: '删除中',
    dead: '已失效',
  };
  return map[state.toLowerCase()] || state;
}

/** 优先用 docker，失败时自动尝试 sudo docker */
async function dockerExec(serverId: string, args: string) {
  const direct = await sshPool.exec(serverId, `docker ${args}`);
  if (direct.code === 0) return direct;

  const combined = `${direct.stderr || ''}\n${direct.stdout || ''}`;
  if (/permission denied|Cannot connect to the Docker daemon/i.test(combined)) {
    const elevated = await sshPool.exec(serverId, `sudo docker ${args}`);
    if (elevated.code === 0) return elevated;
    return elevated;
  }
  return direct;
}

/** 尝试启动 docker 服务（CentOS / Ubuntu 通用） */
async function tryStartDockerService(serverId: string): Promise<boolean> {
  const script = `
if command -v systemctl >/dev/null 2>&1; then
  (systemctl start docker || sudo systemctl start docker) >/dev/null 2>&1 || true
  (systemctl enable docker || sudo systemctl enable docker) >/dev/null 2>&1 || true
elif command -v service >/dev/null 2>&1; then
  (service docker start || sudo service docker start) >/dev/null 2>&1 || true
fi
sleep 1
docker info >/dev/null 2>&1 || sudo docker info >/dev/null 2>&1
echo $?
`;
  const result = await sshPool.exec(serverId, script, 60000);
  return result.stdout.trim().split('\n').pop() === '0';
}

async function ensureDocker(serverId: string) {
  const check = await sshPool.exec(
    serverId,
    'command -v docker >/dev/null 2>&1; echo BIN:$?; (docker info >/dev/null 2>&1 || sudo docker info >/dev/null 2>&1); echo INFO:$?',
  );
  const lines = check.stdout.trim().split('\n');
  const binOk = lines.find((l) => l.startsWith('BIN:'))?.endsWith(':0');
  const infoOk = lines.find((l) => l.startsWith('INFO:'))?.endsWith(':0');

  if (!binOk) {
    throw new Error('未检测到 Docker。请打开「安装 Docker」页进行安装。');
  }

  if (!infoOk) {
    const started = await tryStartDockerService(serverId);
    if (!started) {
      throw new Error(
        'Docker 已安装但服务未启动。请在服务器执行：systemctl start docker ，或到「安装 Docker」页重新点一次。',
      );
    }
  }
}

export async function listContainers(serverId: string): Promise<DockerContainer[]> {
  await ensureDocker(serverId);
  const result = await dockerExec(serverId, `ps -a --format '{{json .}}'`);
  if (result.code !== 0) {
    throw new Error(translateDockerOutput(result.stderr || result.stdout));
  }

  return result.stdout
    .split('\n')
    .filter((line) => line.trim().startsWith('{'))
    .map((line) => {
      try {
        const row = JSON.parse(line) as {
          ID: string;
          Names: string;
          Image: string;
          Status: string;
          State: string;
          Ports: string;
          CreatedAt: string;
        };
        const name = (row.Names || '').replace(/^\//, '').split(',')[0] || row.ID;
        return {
          id: row.ID,
          name,
          image: row.Image,
          status: row.Status,
          statusText: translateState(row.State),
          state: row.State,
          ports: row.Ports || '',
          created: row.CreatedAt || '',
        };
      } catch {
        return null;
      }
    })
    .filter((x): x is DockerContainer => x !== null);
}

export async function listImages(serverId: string): Promise<DockerImage[]> {
  await ensureDocker(serverId);
  const result = await dockerExec(serverId, `images --format '{{json .}}'`);
  if (result.code !== 0) {
    throw new Error(translateDockerOutput(result.stderr || result.stdout));
  }

  return result.stdout
    .split('\n')
    .filter((line) => line.trim().startsWith('{'))
    .map((line, idx) => {
      try {
        const row = JSON.parse(line) as {
          ID: string;
          Repository: string;
          Tag: string;
          Size: string;
          CreatedSince: string;
        };
        return {
          id: row.ID || `img-${idx}`,
          repository: row.Repository,
          tag: row.Tag,
          size: row.Size,
          created: row.CreatedSince,
        };
      } catch {
        return null;
      }
    })
    .filter((x): x is DockerImage => x !== null);
}

function safeRef(ref: string): string {
  const cleaned = ref.replace(/^\//, '').trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(cleaned)) {
    throw new Error('容器标识无效');
  }
  return cleaned;
}

export async function containerAction(
  serverId: string,
  containerRef: string,
  action: 'start' | 'stop' | 'restart' | 'remove',
) {
  await ensureDocker(serverId);
  const ref = safeRef(containerRef);
  const cmds: Record<string, string> = {
    start: `start ${shellQuote(ref)}`,
    stop: `stop ${shellQuote(ref)}`,
    restart: `restart ${shellQuote(ref)}`,
    remove: `rm -f ${shellQuote(ref)}`,
  };
  const result = await dockerExec(serverId, cmds[action]);
  if (result.code !== 0) {
    throw new Error(translateDockerOutput(result.stderr || result.stdout || '容器操作失败'));
  }
  return { ok: true, output: result.stdout.trim() };
}

export async function containerLogs(serverId: string, containerRef: string, lines = 100) {
  await ensureDocker(serverId);
  const ref = safeRef(containerRef);
  const n = Math.min(Math.max(lines, 10), 500);
  const result = await dockerExec(serverId, `logs --tail ${n} ${shellQuote(ref)} 2>&1`);
  return { logs: result.stdout || result.stderr || '(无日志)' };
}

export async function runContainer(
  serverId: string,
  opts: {
    image: string;
    name?: string;
    ports?: string[];
    env?: string[];
    volumes?: string[];
    detach?: boolean;
    restart?: string;
    command?: string;
  },
) {
  await ensureDocker(serverId);
  const parts = ['run'];
  if (opts.detach !== false) parts.push('-d');
  if (opts.name) parts.push('--name', shellQuote(opts.name));
  if (opts.restart) parts.push('--restart', shellQuote(opts.restart));
  for (const p of opts.ports || []) parts.push('-p', shellQuote(p));
  for (const e of opts.env || []) parts.push('-e', shellQuote(e));
  for (const v of opts.volumes || []) parts.push('-v', shellQuote(v));
  parts.push(shellQuote(opts.image));
  if (opts.command) parts.push(opts.command);

  const result = await dockerExec(serverId, parts.join(' '));
  if (result.code !== 0) {
    throw new Error(translateDockerOutput(result.stderr || result.stdout || '启动容器失败'));
  }
  return { ok: true, containerId: result.stdout.trim() };
}

export async function removeImage(serverId: string, imageRef: string) {
  await ensureDocker(serverId);
  const ref = imageRef.trim();
  if (!ref || !/^[a-zA-Z0-9_./:@+-]+$/.test(ref)) {
    throw new Error('镜像标识无效');
  }
  const result = await dockerExec(serverId, `rmi ${shellQuote(ref)}`);
  if (result.code !== 0) {
    throw new Error(translateDockerOutput(result.stderr || result.stdout || '删除镜像失败'));
  }
  return { ok: true, output: result.stdout.trim() };
}

export interface ContainerMount {
  type: string;
  source: string;
  destination: string;
  mode: string;
  rw: boolean;
  /** 命名卷名称（type=volume 时） */
  name?: string;
}

export interface ContainerDetail {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  created: string;
  ports: string[];
  mounts: ContainerMount[];
  env: string[];
  cmd: string[];
  restartPolicy: string;
  networkMode: string;
  /** 可在线编辑的站点目录（挂载源在 /opt/vizops/ 下） */
  editableRoots: string[];
}

export async function inspectContainer(
  serverId: string,
  containerRef: string,
): Promise<ContainerDetail> {
  await ensureDocker(serverId);
  const ref = safeRef(containerRef);
  const result = await dockerExec(serverId, `inspect ${shellQuote(ref)}`);
  if (result.code !== 0) {
    throw new Error(translateDockerOutput(result.stderr || result.stdout || '获取容器详情失败'));
  }
  let raw: unknown;
  try {
    raw = JSON.parse(result.stdout);
  } catch {
    throw new Error('解析容器详情失败');
  }
  const arr = Array.isArray(raw) ? raw : [raw];
  const info = arr[0] as {
    Id?: string;
    Name?: string;
    Created?: string;
    State?: { Status?: string; Running?: boolean };
    Config?: { Image?: string; Env?: string[]; Cmd?: string[] };
    HostConfig?: {
      RestartPolicy?: { Name?: string };
      NetworkMode?: string;
      Binds?: string[];
    };
    Mounts?: {
      Type?: string;
      Source?: string;
      Destination?: string;
      Mode?: string;
      RW?: boolean;
      Name?: string;
    }[];
    NetworkSettings?: {
      Ports?: Record<string, { HostIp?: string; HostPort?: string }[] | null>;
    };
  };
  if (!info) throw new Error('容器不存在');

  const mounts: ContainerMount[] = (info.Mounts || []).map((m) => ({
    type: m.Type || (m.Name ? 'volume' : 'bind'),
    source: m.Source || m.Name || '',
    destination: m.Destination || '',
    mode: m.Mode || (m.RW === false ? 'ro' : 'rw'),
    rw: m.RW !== false,
    name: m.Name || undefined,
  }));

  const ports: string[] = [];
  const portMap = info.NetworkSettings?.Ports || {};
  for (const [key, bindings] of Object.entries(portMap)) {
    if (!bindings?.length) {
      ports.push(key);
      continue;
    }
    for (const b of bindings) {
      ports.push(`${b.HostIp || '0.0.0.0'}:${b.HostPort}->${key}`);
    }
  }

  const editableRoots = Array.from(
    new Set(
      mounts
        .map((m) => m.source)
        .filter(
          (s) =>
            s.startsWith('/opt/vizops/') ||
            /^\/var\/lib\/docker\/volumes\/[a-zA-Z0-9][a-zA-Z0-9_.-]*\/_data/.test(s),
        )
        .map((s) => s.replace(/\/+$/, '')),
    ),
  ).sort((a, b) => {
    const score = (p: string) =>
      p.endsWith('/html') || p.includes('/html/') || p.endsWith('/_data')
        ? 0
        : p.endsWith('.conf')
          ? 2
          : 1;
    return score(a) - score(b) || a.localeCompare(b);
  });

  const name = (info.Name || '').replace(/^\//, '') || ref;
  const state = info.State?.Status || (info.State?.Running ? 'running' : 'unknown');

  return {
    id: info.Id || '',
    name,
    image: info.Config?.Image || '',
    status: state,
    state,
    created: info.Created || '',
    ports,
    mounts,
    env: info.Config?.Env || [],
    cmd: info.Config?.Cmd || [],
    restartPolicy: info.HostConfig?.RestartPolicy?.Name || 'no',
    networkMode: info.HostConfig?.NetworkMode || '',
    editableRoots,
  };
}

export interface DockerVolume {
  name: string;
  driver: string;
  mountpoint: string;
  created: string;
  labels: string;
  scope: string;
  size?: string;
}

export async function listVolumes(serverId: string): Promise<DockerVolume[]> {
  await ensureDocker(serverId);
  const result = await dockerExec(serverId, `volume ls --format '{{json .}}'`);
  if (result.code !== 0) {
    throw new Error(translateDockerOutput(result.stderr || result.stdout || '获取存储卷失败'));
  }
  return result.stdout
    .split('\n')
    .filter((line) => line.trim().startsWith('{'))
    .map((line) => {
      try {
        const row = JSON.parse(line) as {
          Name: string;
          Driver: string;
          Mountpoint?: string;
          CreatedAt?: string;
          Labels?: string;
          Scope?: string;
        };
        return {
          name: row.Name,
          driver: row.Driver,
          mountpoint: row.Mountpoint || '',
          created: row.CreatedAt || '',
          labels: row.Labels || '',
          scope: row.Scope || '',
        };
      } catch {
        return null;
      }
    })
    .filter((x): x is DockerVolume => x !== null);
}

export async function removeVolume(serverId: string, name: string) {
  await ensureDocker(serverId);
  const n = name.trim();
  if (!n || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(n)) {
    throw new Error('存储卷名称无效');
  }
  const result = await dockerExec(serverId, `volume rm ${shellQuote(n)}`);
  if (result.code !== 0) {
    throw new Error(translateDockerOutput(result.stderr || result.stdout || '删除存储卷失败'));
  }
  return { ok: true };
}

export async function createVolume(serverId: string, name: string) {
  await ensureDocker(serverId);
  const n = name.trim();
  if (!n || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(n)) {
    throw new Error('存储卷名称无效（仅英文、数字、._-）');
  }
  const result = await dockerExec(serverId, `volume create ${shellQuote(n)}`);
  if (result.code !== 0) {
    throw new Error(translateDockerOutput(result.stderr || result.stdout || '创建存储卷失败'));
  }
  return { ok: true, name: result.stdout.trim() || n };
}

export interface RemoteImageTag {
  name: string;
  full: string;
  size?: number;
  lastUpdated?: string;
}

/** 解析仓库名（去掉 tag），官方镜像补 library/ */
export function resolveHubRepo(imageOrRepo: string): { repo: string; display: string } {
  let raw = imageOrRepo.trim().replace(/^docker\.io\//, '');
  if (raw.includes('@')) raw = raw.split('@')[0];
  if (raw.includes(':')) raw = raw.split(':')[0];
  if (!raw) throw new Error('请填写镜像仓库名，例如 nginx');
  if (raw.includes('.') && raw.includes('/') && !raw.startsWith('library/')) {
    // 第三方 registry（如阿里云）暂不走 Docker Hub
    throw new Error('当前仅支持从 Docker Hub 获取版本列表；第三方仓库请直接填写 仓库:标签 拉取');
  }
  const display = raw.includes('/') ? raw : raw;
  const repo = raw.includes('/') ? raw : `library/${raw}`;
  return { repo, display };
}

const FALLBACK_TAGS: Record<string, string[]> = {
  'library/nginx': ['1.27-alpine', '1.27', '1.25-alpine', '1.25', 'stable-alpine', 'stable', 'alpine', 'latest'],
  'library/mysql': ['8.4', '8.0.36', '8.0', '5.7', 'latest'],
  'library/postgres': ['16-alpine', '16', '15-alpine', '15', '14', 'latest'],
  'library/redis': ['7-alpine', '7', '6-alpine', '6', 'latest'],
  'library/node': ['22-alpine', '22', '20-alpine', '20', '18-alpine', 'latest'],
};

/** 版本号比较：新 → 旧（用于标签排序） */
function compareTagNewestFirst(a: RemoteImageTag, b: RemoteImageTag): number {
  if (a.lastUpdated && b.lastUpdated) {
    const da = new Date(a.lastUpdated).getTime();
    const db = new Date(b.lastUpdated).getTime();
    if (!Number.isNaN(da) && !Number.isNaN(db) && da !== db) return db - da;
  }
  return compareVersionNameDesc(a.name, b.name);
}

function compareVersionNameDesc(a: string, b: string): number {
  const pa = parseVersionParts(a);
  const pb = parseVersionParts(b);
  const len = Math.max(pa.nums.length, pb.nums.length);
  for (let i = 0; i < len; i++) {
    const na = pa.nums[i] ?? -1;
    const nb = pb.nums[i] ?? -1;
    if (na !== nb) return nb - na;
  }
  // latest / stable 靠前一点
  const rank = (s: string) => {
    if (s === 'latest') return 3;
    if (s === 'stable' || s.startsWith('stable-')) return 2;
    if (s === 'alpine' || s.endsWith('-alpine')) return 1;
    return 0;
  };
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return rb - ra;
  return a < b ? 1 : a > b ? -1 : 0;
}

function parseVersionParts(tag: string): { nums: number[] } {
  const nums: number[] = [];
  const re = /(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) nums.push(Number(m[1]));
  return { nums };
}

/** 从 Docker Hub 拉取可用标签列表（本机网络请求，不依赖服务器外网） */
export async function listRemoteImageTags(imageOrRepo: string): Promise<{
  repo: string;
  display: string;
  tags: RemoteImageTag[];
  source: 'hub' | 'fallback';
}> {
  const { repo, display } = resolveHubRepo(imageOrRepo);
  const tags: RemoteImageTag[] = [];
  let source: 'hub' | 'fallback' = 'hub';

  try {
    let url: string | null =
      `https://hub.docker.com/v2/repositories/${encodeURI(repo)}/tags?page_size=100&ordering=-last_updated`;
    let pages = 0;
    while (url && pages < 5) {
      pages += 1;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`Docker Hub 返回 ${res.status}`);
      const data = (await res.json()) as {
        next?: string | null;
        results?: { name: string; full_size?: number; last_updated?: string }[];
      };
      for (const row of data.results || []) {
        if (!row.name) continue;
        tags.push({
          name: row.name,
          full: `${display}:${row.name}`,
          size: row.full_size,
          lastUpdated: row.last_updated,
        });
      }
      url = data.next || null;
    }
    if (!tags.length) throw new Error('未获取到标签');
  } catch {
    source = 'fallback';
    const fb = FALLBACK_TAGS[repo] || ['latest', 'alpine'];
    for (const name of fb) {
      tags.push({ name, full: `${display}:${name}` });
    }
  }

  tags.sort(compareTagNewestFirst);
  return { repo, display, tags, source };
}

/** 拉取镜像（支持常用镜像与自定义名，失败时尝试国内加速） */
export async function pullImage(
  serverId: string,
  image: string,
  onData: (chunk: string) => void,
) {
  await ensureDocker(serverId);
  const img = image.trim();
  if (!img || !/^[a-zA-Z0-9_./:@-]+$/.test(img)) {
    throw new Error('镜像名称不合法');
  }

  const script = `
set -e
IMG=${shellQuote(img)}
docker_bin() {
  if docker info >/dev/null 2>&1; then echo docker; else echo "sudo docker"; fi
}
D=$(docker_bin)

echo "[1/2] 拉取镜像: $IMG"
if $D pull "$IMG"; then
  echo "[完成] 拉取成功: $IMG"
  $D images --format 'table {{.Repository}}\\t{{.Tag}}\\t{{.Size}}' | head -20
  exit 0
fi

echo "[提示] Docker Hub 拉取失败，尝试国内加速镜像..."
# library 官方镜像走加速
BASE="$IMG"
case "$IMG" in
  */*) ;;
  *:*) BASE="library/$IMG" ;;
  *) BASE="library/$IMG:latest" ;;
esac

MIRROR="docker.m.daocloud.io/$BASE"
echo "[2/2] 尝试: $MIRROR"
if $D pull "$MIRROR"; then
  $D tag "$MIRROR" "$IMG"
  echo "[完成] 已通过加速拉取并标记为: $IMG"
  $D images --format 'table {{.Repository}}\\t{{.Tag}}\\t{{.Size}}' | head -20
  exit 0
fi

echo "[错误] 镜像拉取失败。请检查服务器能否访问外网，或改用「上传镜像包」。"
exit 1
`;
  return sshPool.execStream(serverId, script, (chunk) => onData(chunk));
}

/** 从已上传的 tar / tar.gz 导入镜像（docker load） */
export async function loadImageFromArchive(
  serverId: string,
  archivePath: string,
  onData: (chunk: string) => void,
) {
  await ensureDocker(serverId);
  if (!archivePath.startsWith('/tmp/vizops-')) {
    throw new Error('镜像包路径不合法');
  }

  const script = `
set -e
FILE=${shellQuote(archivePath)}
docker_bin() {
  if docker info >/dev/null 2>&1; then echo docker; else echo "sudo docker"; fi
}
D=$(docker_bin)

if [ ! -f "$FILE" ]; then
  echo "[错误] 未找到镜像包: $FILE"
  exit 1
fi

echo "[1/2] 导入镜像包: $FILE"
SIZE=$(du -h "$FILE" | awk '{print $1}')
echo "[信息] 文件大小: $SIZE"

case "$FILE" in
  *.tar.gz|*.tgz)
    echo "[解压] 检测到 gzip，边解压边导入..."
    gunzip -c "$FILE" | $D load
    ;;
  *)
    $D load -i "$FILE"
    ;;
esac

echo "[2/2] 清理临时文件..."
rm -f "$FILE" 2>/dev/null || true

echo "[完成] 镜像已导入，当前镜像列表："
$D images --format 'table {{.Repository}}\\t{{.Tag}}\\t{{.Size}}' | head -30
`;
  return sshPool.execStream(serverId, script, (chunk) => onData(chunk), 60 * 60 * 1000);
}

/**
 * 安装或启动 Docker：
 * - 已安装但未启动 → 启动服务
 * - CentOS/RHEL → yum
 * - Ubuntu/Debian → apt
 */
export async function installDocker(
  serverId: string,
  onData: (chunk: string) => void,
) {
  const script = `
set -e

have_docker_bin() { command -v docker >/dev/null 2>&1; }
daemon_ok() { docker info >/dev/null 2>&1 || sudo docker info >/dev/null 2>&1; }
start_daemon() {
  echo "[启动] 正在启动 Docker 服务..."
  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl enable docker >/dev/null 2>&1 || true
    sudo systemctl start docker
  else
    sudo service docker start
  fi
  sleep 2
  if daemon_ok; then
    echo "[完成] Docker 服务已启动: $(docker --version 2>/dev/null || sudo docker --version)"
    return 0
  fi
  echo "[错误] Docker 服务启动失败，请检查: systemctl status docker"
  return 1
}

if have_docker_bin; then
  echo "[检测] 已安装 Docker: $(docker --version 2>/dev/null || true)"
  if daemon_ok; then
    echo "[完成] Docker 服务运行正常，无需重复安装。"
    exit 0
  fi
  start_daemon
  exit $?
fi

# 识别系统
. /etc/os-release 2>/dev/null || true
OS_ID="\${ID:-unknown}"
echo "[检测] 系统: \${PRETTY_NAME:-$OS_ID}"

if [ -f /etc/debian_version ] || [ "$OS_ID" = "ubuntu" ] || [ "$OS_ID" = "debian" ]; then
  echo "[1/5] 更新 apt..."
  export DEBIAN_FRONTEND=noninteractive
  sudo apt-get update -y
  echo "[2/5] 安装依赖..."
  sudo apt-get install -y ca-certificates curl gnupg
  echo "[3/5] 添加 Docker 官方源..."
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  echo "[4/5] 安装 Docker..."
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
elif [ -f /etc/redhat-release ] || [ "$OS_ID" = "centos" ] || [ "$OS_ID" = "rhel" ] || [ "$OS_ID" = "rocky" ] || [ "$OS_ID" = "almalinux" ] || [ "$OS_ID" = "fedora" ]; then
  echo "[1/4] 安装 yum 工具..."
  sudo yum install -y yum-utils device-mapper-persistent-data lvm2 || sudo dnf install -y dnf-plugins-core
  echo "[2/4] 添加 Docker 源..."
  sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo 2>/dev/null \\
    || sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo 2>/dev/null \\
    || true
  echo "[3/4] 安装 Docker（若官方源失败则尝试系统自带包）..."
  if ! sudo yum install -y docker-ce docker-ce-cli containerd.io 2>/tmp/vizops-docker-yum.err; then
    echo "[提示] docker-ce 安装失败，尝试 yum install docker ..."
    cat /tmp/vizops-docker-yum.err 2>/dev/null || true
    sudo yum install -y docker || sudo dnf install -y docker
  fi
else
  echo "[错误] 暂不支持的系统: $OS_ID ，请手动安装 Docker 后重试。"
  exit 1
fi

echo "[收尾] 启动服务并配置权限..."
sudo usermod -aG docker "$USER" 2>/dev/null || true
start_daemon
echo "[完成] 安装完成: $(docker --version)"
echo "[提示] 若非 root 用户仍报权限不足，请断开 SSH 后重新连接。"
`;
  return sshPool.execStream(serverId, script, (chunk) => onData(chunk));
}

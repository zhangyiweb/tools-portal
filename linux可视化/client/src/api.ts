export interface ServerInfo {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  connected?: boolean;
}

export interface SystemOverview {
  hostname: string;
  os: string;
  kernel: string;
  uptime: string;
  arch: string;
  ip: string;
  cpu: { cores: number; model: string; usage: number };
  memory: {
    totalKb: number;
    usedKb: number;
    availableKb: number;
    usagePercent: number;
  };
  swap: { totalKb: number; usedKb: number };
  disk: {
    totalKb: number;
    usedKb: number;
    availableKb: number;
    usagePercent: number;
  };
  load: { m1: number; m5: number; m15: number };
  tools: {
    docker: { installed: boolean; version: string };
    node: { installed: boolean; version: string };
    nginx: { installed: boolean };
  };
  processes: { pid: string; cpu: number; mem: number; command: string }[];
  collectedAt: string;
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  statusText?: string;
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

export interface DockerVolume {
  name: string;
  driver: string;
  mountpoint: string;
  created: string;
  labels: string;
  scope: string;
}

export interface ContainerMount {
  type: string;
  source: string;
  destination: string;
  mode: string;
  rw: boolean;
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
  editableRoots: string[];
}

export interface DirEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  mtime: string;
}

export type TaskEvent =
  | { type: 'start'; message: string }
  | { type: 'log'; chunk: string }
  | { type: 'done'; code: number | null; message: string }
  | { type: 'error'; message: string };

/** 前端兜底：把偶发英文错误转成中文 */
export function translateError(raw: string): string {
  const msg = (raw || '').trim();
  if (!msg) return '未知错误';
  if (/Timed out while waiting for handshake/i.test(msg)) {
    return 'SSH 握手超时：请检查主机地址、端口是否正确，以及云厂商安全组/防火墙是否放行 SSH（默认 22）。';
  }
  if (/All configured authentication methods failed|Authentication failed/i.test(msg)) {
    return '认证失败：用户名、密码或私钥不正确。';
  }
  if (/ECONNREFUSED/i.test(msg)) {
    return '连接被拒绝：目标端口未开放，或没有 SSH 服务。';
  }
  if (/ETIMEDOUT|EHOSTUNREACH/i.test(msg)) {
    return '无法连通主机：请检查地址、网络和安全组。';
  }
  if (/ENOTFOUND/i.test(msg)) {
    return '无法解析主机名，请检查域名是否正确。';
  }
  if (/Failed to fetch|NetworkError|Load failed|ERR_CONNECTION_RESET|connection reset/i.test(msg)) {
    return '网络中断或本地服务重启了。请确认 npm run dev 仍在运行，并重新连接服务器后再试。';
  }
  if (/permission denied.*docker|Cannot connect to the Docker daemon/i.test(msg)) {
    return 'Docker 权限不足：请将当前用户加入 docker 组后，断开并重新连接 SSH。';
  }
  if (/No such container/i.test(msg)) {
    return '找不到该容器，请刷新列表后重试。';
  }
  if (/port is already allocated|Bind for.*failed/i.test(msg)) {
    return '端口已被占用，请先停止占用该端口的容器或进程。';
  }
  if (/iptables failed|failed programming external connectivity/i.test(msg)) {
    return '启动失败：Docker 网络/防火墙规则异常（iptables）。可尝试在服务器执行 systemctl restart docker。';
  }
  if (/[\u4e00-\u9fff]/.test(msg)) return msg;
  return msg;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      ...init,
    });
  } catch (e) {
    throw new Error(translateError((e as Error).message || 'Failed to fetch'));
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      translateError((data as { error?: string }).error || `请求失败（${res.status}）`),
    );
  }
  return data as T;
}

/** 开发环境大文件直连后端，避免经 Vite 代理导致崩溃 */
function apiOrigin(): string {
  if (typeof window === 'undefined') return '';
  if (import.meta.env.DEV) return 'http://localhost:3789';
  return '';
}

export const api = {
  health: () => request<{ ok: boolean }>('/api/health'),

  listServers: () => request<{ servers: ServerInfo[] }>('/api/servers'),

  addServer: (body: {
    id?: string;
    name?: string;
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string;
    passphrase?: string;
  }) =>
    request<{ ok: boolean; server: ServerInfo; message: string }>('/api/servers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  removeServer: (id: string) =>
    request<{ ok: boolean }>(`/api/servers/${id}`, { method: 'DELETE' }),

  reconnect: (id: string) =>
    request<{ ok: boolean }>(`/api/servers/${id}/reconnect`, { method: 'POST' }),

  disconnect: (id: string) =>
    request<{ ok: boolean }>(`/api/servers/${id}/disconnect`, { method: 'POST' }),

  exec: (id: string, command: string) =>
    request<{ code: number | null; stdout: string; stderr: string }>(
      `/api/servers/${id}/exec`,
      { method: 'POST', body: JSON.stringify({ command }) },
    ),

  overview: (id: string) => request<SystemOverview>(`/api/servers/${id}/overview`),

  containers: (id: string) =>
    request<{ containers: DockerContainer[] }>(`/api/servers/${id}/docker/containers`),

  images: (id: string) =>
    request<{ images: DockerImage[] }>(`/api/servers/${id}/docker/images`),

  remoteTags: (image: string) =>
    request<{
      repo: string;
      display: string;
      tags: { name: string; full: string; size?: number; lastUpdated?: string }[];
      source: 'hub' | 'fallback';
    }>(`/api/docker/remote-tags?image=${encodeURIComponent(image)}`),

  removeImage: (id: string, ref: string) =>
    request<{ ok: boolean }>(`/api/servers/${id}/docker/images/remove`, {
      method: 'POST',
      body: JSON.stringify({ ref }),
    }),

  containerAction: (id: string, ref: string, action: string) =>
    request<{ ok: boolean }>(`/api/servers/${id}/docker/action`, {
      method: 'POST',
      body: JSON.stringify({ ref, action }),
    }),

  containerLogs: (id: string, ref: string, lines = 100) =>
    request<{ logs: string }>(
      `/api/servers/${id}/docker/containers/${encodeURIComponent(ref)}/logs?lines=${lines}`,
    ),

  inspectContainer: (id: string, ref: string) =>
    request<{ detail: ContainerDetail }>(
      `/api/servers/${id}/docker/containers/${encodeURIComponent(ref)}/inspect`,
    ),

  volumes: (id: string) =>
    request<{ volumes: DockerVolume[] }>(`/api/servers/${id}/docker/volumes`),

  removeVolume: (id: string, name: string) =>
    request<{ ok: boolean }>(`/api/servers/${id}/docker/volumes/remove`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  createVolume: (id: string, name: string) =>
    request<{ ok: boolean; name: string }>(`/api/servers/${id}/docker/volumes/create`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  listFiles: (id: string, path: string) =>
    request<{ path: string; entries: DirEntry[] }>(
      `/api/servers/${id}/files?path=${encodeURIComponent(path)}`,
    ),

  listSites: (id: string) =>
    request<{
      sites: {
        name: string;
        path: string;
        htmlPath: string;
        confPath: string;
        hasHtml: boolean;
        hasIndex: boolean;
      }[];
    }>(`/api/servers/${id}/sites`),

  readFile: (id: string, path: string) =>
    request<{ path: string; content: string; size: number }>(
      `/api/servers/${id}/files/content?path=${encodeURIComponent(path)}`,
    ),

  writeFile: (id: string, path: string, content: string) =>
    request<{ ok: boolean; path: string; size: number }>(`/api/servers/${id}/files/content`, {
      method: 'PUT',
      body: JSON.stringify({ path, content }),
    }),

  mkdir: (id: string, path: string) =>
    request<{ ok: boolean; path: string }>(`/api/servers/${id}/files/mkdir`, {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  createSite: (id: string, name: string) =>
    request<{ ok: boolean; path: string; htmlPath: string; confPath: string }>(
      `/api/servers/${id}/files/site`,
      {
        method: 'POST',
        body: JSON.stringify({ name }),
      },
    ),

  removePath: (id: string, path: string) =>
    request<{ ok: boolean; path: string }>(`/api/servers/${id}/files/remove`, {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  checkPaths: (id: string, paths: string[]) =>
    request<{
      items: { path: string; exists: boolean; type?: 'file' | 'dir' }[];
    }>(`/api/servers/${id}/files/check`, {
      method: 'POST',
      body: JSON.stringify({ paths }),
    }),

  async uploadFile(id: string, remotePath: string, file: Blob) {
    const url = `${apiOrigin()}/api/servers/${id}/files/upload?path=${encodeURIComponent(remotePath)}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      });
    } catch (e) {
      throw new Error(translateError((e as Error).message || 'Failed to fetch'));
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        translateError((data as { error?: string }).error || `上传失败（${res.status}）`),
      );
    }
    return data as { ok: boolean; path: string; size: number };
  },

  runContainer: (id: string, body: Record<string, unknown>) =>
    request<{ ok: boolean; containerId: string }>(`/api/servers/${id}/docker/run`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  startTask: (id: string, path: string, body?: unknown) =>
    request<{ taskId: string }>(`/api/servers/${id}/tasks/${path}`, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }),

  upload: (id: string, remotePath: string, contentBase64: string) =>
    request<{ ok: boolean; path: string }>(`/api/servers/${id}/upload`, {
      method: 'POST',
      body: JSON.stringify({ remotePath, contentBase64 }),
    }),

  async uploadBin(id: string, remotePath: string, file: Blob) {
    const url = `${apiOrigin()}/api/servers/${id}/upload-bin?path=${encodeURIComponent(remotePath)}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      });
    } catch (e) {
      throw new Error(translateError((e as Error).message || 'Failed to fetch'));
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        translateError((data as { error?: string }).error || `上传失败（${res.status}）`),
      );
    }
    return data as { ok: boolean; path: string; size: number };
  },

  streamTask(taskId: string, onEvent: (e: TaskEvent) => void): () => void {
    const es = new EventSource(`/api/tasks/${taskId}/stream`);
    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as TaskEvent;
        onEvent(event);
        if (event.type === 'done' || event.type === 'error') es.close();
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      es.close();
    };
    return () => es.close();
  },
};

export function formatBytes(kb: number): string {
  if (kb < 1024) return `${Math.round(kb)} KB`;
  if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${(kb / 1024 / 1024).toFixed(2)} GB`;
}

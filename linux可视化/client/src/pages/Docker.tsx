import { useCallback, useEffect, useRef, useState } from 'react';
import { Drawer, Button, Modal, Input, Space, Alert, Breadcrumb, App } from 'antd';
import {
  RefreshCw,
  Play,
  Square,
  RotateCcw,
  Trash2,
  ScrollText,
  Plus,
  FolderOpen,
  FolderPlus,
  FilePlus,
  Upload,
  Save,
  ArrowLeft,
  HardDrive,
  Pencil,
  Download,
  ExternalLink,
  Copy,
} from 'lucide-react';
import {
  api,
  translateError,
  type DockerContainer,
  type DockerImage,
  type DockerVolume,
  type ContainerDetail,
  type DirEntry,
} from '../api';
import { useApp } from '../context';
import { Shell, NeedServer, Loading, TaskLog, useTaskRunner } from '../components/Shell';
import { toast } from '../toast';

function canEditMountSource(source: string): boolean {
  if (!source) return false;
  if (source.startsWith('/opt/vizops/')) return true;
  return /^\/var\/lib\/docker\/volumes\/[a-zA-Z0-9][a-zA-Z0-9_.-]*\/_data/.test(source);
}

const SITES_ROOT = '/opt/vizops/sites';

/** 是否像前端 / Web 服务（可提供浏览器访问地址） */
function isWebFrontend(c: DockerContainer): boolean {
  const hint = `${c.name} ${c.image}`.toLowerCase();
  if (/nginx|openresty|httpd|apache|caddy|frontend|static|vite|next|react|vue/.test(hint)) {
    return true;
  }
  return /->(?:80|443)\/tcp/i.test(c.ports || '');
}

/**
 * 从 docker ports 字符串解析可在本机浏览器打开的访问地址。
 * 例：0.0.0.0:8080->80/tcp, :::8080->80/tcp → http://host:8080
 */
function resolveAccessUrl(ports: string, serverHost: string): { url: string; label: string } | null {
  if (!ports || !serverHost) return null;
  const re =
    /(?:((?:\d{1,3}\.){3}\d{1,3}|\[::\]|::|\*):)?(\d+)(?:-\d+)?->(\d+)(?:-\d+)?\/tcp/gi;
  type Cand = { hostPort: number; containerPort: number; loopback: boolean };
  const seen = new Set<number>();
  const cands: Cand[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(ports)) !== null) {
    const hostIp = (m[1] || '0.0.0.0').toLowerCase();
    const hostPort = Number(m[2]);
    const containerPort = Number(m[3]);
    if (!hostPort || !containerPort || seen.has(hostPort)) continue;
    seen.add(hostPort);
    const loopback = hostIp === '127.0.0.1' || hostIp === '::1';
    cands.push({ hostPort, containerPort, loopback });
  }
  const prefer = cands
    .filter((c) => !c.loopback)
    .sort((a, b) => {
      const rank = (p: number) => (p === 80 || p === 443 ? 0 : p === 8080 ? 1 : 2);
      return rank(a.containerPort) - rank(b.containerPort) || a.hostPort - b.hostPort;
    });
  const pick = prefer[0] || cands.find((c) => !c.loopback) || null;
  if (!pick) return null;
  const scheme = pick.containerPort === 443 || pick.hostPort === 443 ? 'https' : 'http';
  const hostPart =
    pick.hostPort === 80 && scheme === 'http'
      ? serverHost
      : pick.hostPort === 443 && scheme === 'https'
        ? serverHost
        : `${serverHost}:${pick.hostPort}`;
  const url = `${scheme}://${hostPart}`;
  return { url, label: url };
}

/** 计算路径归属的浏览根目录：Docker 卷的 _data 根目录，或站点根目录 */
function browseRootOf(path: string): string {
  const p = (path || '').replace(/\/+$/, '') || SITES_ROOT;
  const vol = p.match(/^(\/var\/lib\/docker\/volumes\/[^/]+\/_data)/);
  if (vol) return vol[1];
  if (p === '/opt/vizops' || p.startsWith('/opt/vizops/')) return SITES_ROOT;
  return SITES_ROOT;
}

/** 生成从浏览根目录到当前路径的面包屑；卷根目录用卷名作为标签 */
function buildPathCrumbs(path: string): { label: string; path: string }[] {
  const p = (path || '').replace(/\/+$/, '') || SITES_ROOT;
  const root = browseRootOf(p);
  const rootLabel = root.includes('/_data')
    ? root.split('/').slice(-2, -1)[0] || '_data'
    : root === SITES_ROOT
      ? 'sites'
      : root.split('/').filter(Boolean).pop() || root;
  const items: { label: string; path: string }[] = [{ label: rootLabel, path: root }];
  if (p === root || !p.startsWith(`${root}/`)) return items;
  let cur = root;
  for (const seg of p.slice(root.length + 1).split('/').filter(Boolean)) {
    cur = `${cur}/${seg}`;
    items.push({ label: seg, path: cur });
  }
  return items;
}

const ACTION_LABELS: Record<string, string> = {
  start: '启动',
  stop: '停止',
  restart: '重启',
  remove: '删除',
};

export function DockerPage() {
  const { modal } = App.useApp();
  const { activeId, activeServer, servers } = useApp();
  const [tab, setTab] = useState<
    'containers' | 'images' | 'pull' | 'volumes' | 'files' | 'run' | 'install'
  >('containers');
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [volumes, setVolumes] = useState<DockerVolume[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string | null>(null);
  const [logTitle, setLogTitle] = useState('');
  const [detail, setDetail] = useState<ContainerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [volumeModalOpen, setVolumeModalOpen] = useState(false);
  const [newVolumeName, setNewVolumeName] = useState('');
  const [creatingVolume, setCreatingVolume] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copySource, setCopySource] = useState<DockerContainer | null>(null);
  const [copyTargetId, setCopyTargetId] = useState('');
  const [copyTargetName, setCopyTargetName] = useState('');
  const [copyOverwriteVol, setCopyOverwriteVol] = useState(false);

  const filesTargetRef = useRef<string | null>(null);
  const folderUploadRef = useRef<HTMLInputElement>(null);
  const [fileDir, setFileDir] = useState(SITES_ROOT);
  const [fileEntries, setFileEntries] = useState<DirEntry[]>([]);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [editPath, setEditPath] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editDirty, setEditDirty] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [fileHint, setFileHint] = useState('');
  const [createModal, setCreateModal] = useState<'file' | 'dir' | 'site' | null>(null);
  const [createName, setCreateName] = useState('');
  const [creatingEntry, setCreatingEntry] = useState(false);

  const task = useTaskRunner();
  const pullTask = useTaskRunner();
  const loadTask = useTaskRunner();
  const copyTask = useTaskRunner();
  const [customImage, setCustomImage] = useState('nginx:alpine');
  const [pullingImage, setPullingImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loadHint, setLoadHint] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const COMMON_IMAGES = [
    { repo: 'nginx', image: 'nginx:alpine', title: 'Nginx', desc: '轻量级 Web 服务器，常用于静态站点与反向代理' },
    { repo: 'mysql', image: 'mysql:8.0', title: 'MySQL 8', desc: '主流关系型数据库' },
    { repo: 'postgres', image: 'postgres:16', title: 'PostgreSQL', desc: '功能强大的开源关系型数据库' },
    { repo: 'redis', image: 'redis:7', title: 'Redis', desc: '缓存 / 消息队列' },
    { repo: 'node', image: 'node:20-alpine', title: 'Node 20', desc: '轻量 Node 运行环境' },
  ];

  const [runForm, setRunForm] = useState({
    image: 'nginx:alpine',
    name: '',
    ports: '8080:80',
    env: '',
    restart: 'unless-stopped',
  });

  type TagItem = { name: string; full: string; size?: number; lastUpdated?: string };
  const [tagList, setTagList] = useState<TagItem[]>([]);
  const [tagSource, setTagSource] = useState<'hub' | 'fallback' | null>(null);
  const [tagFilter, setTagFilter] = useState('');
  const [tagLoading, setTagLoading] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState('');
  const [tagPanelTitle, setTagPanelTitle] = useState('');

  const load = useCallback(async () => {
    if (!activeId) return;
    setLoading(true);
    setError(null);
    try {
      const [c, i] = await Promise.all([api.containers(activeId), api.images(activeId)]);
      setContainers(c.containers);
      setImages(i.images);
    } catch (e) {
      const msg = translateError((e as Error).message);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  const loadVolumes = useCallback(async () => {
    if (!activeId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await api.volumes(activeId);
      setVolumes(r.volumes);
    } catch (e) {
      const msg = translateError((e as Error).message);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  const loadFiles = useCallback(
    async (dir?: string) => {
      if (!activeId) return;
      const target = (dir && dir.trim()) || fileDir || SITES_ROOT;
      setFileLoading(true);
      setError(null);
      try {
        const r = await api.listFiles(activeId, target);
        setFileDir(r.path);
        setFileEntries(r.entries);
        setEditPath(null);
      } catch (e) {
        const msg = translateError((e as Error).message);
        setError(msg);
        toast.error(msg);
      } finally {
        setFileLoading(false);
      }
    },
    [activeId, fileDir],
  );

  const openFile = useCallback(
    async (path: string) => {
      if (!activeId) return;
      setFileLoading(true);
      setFileHint('');
      setError(null);
      try {
        const r = await api.readFile(activeId, path);
        setEditPath(r.path);
        setEditContent(r.content);
        setEditDirty(false);
        setTab('files');
      } catch (e) {
        const msg = translateError((e as Error).message);
        setError(msg);
        toast.error(msg);
      } finally {
        setFileLoading(false);
      }
    },
    [activeId],
  );

  useEffect(() => {
    if (tab === 'containers' || tab === 'images' || tab === 'pull') void load();
    if (tab === 'volumes') void loadVolumes();
    if (tab === 'files') {
      const target = filesTargetRef.current;
      filesTargetRef.current = null;
      void loadFiles(target || SITES_ROOT);
    }
    // 仅在切换 Tab 时触发，避免依赖变化导致重复请求
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const showDetail = async (c: DockerContainer) => {
    if (!activeId) return;
    setDetailLoading(true);
    setDetail(null);
    setDetailOpen(true);
    setLogs(null);
    setError(null);
    try {
      const r = await api.inspectContainer(activeId, c.name || c.id);
      setDetail(r.detail);
    } catch (e) {
      const msg = translateError((e as Error).message);
      setError(msg);
      toast.error(msg);
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  /** 跳转到指定目录浏览；若正在编辑且有未保存修改，先确认再跳转 */
  const goToPath = useCallback(
    (path: string) => {
      if (editDirty) {
        modal.confirm({
          title: '放弃未保存的修改？',
          content: '当前文件内容尚未保存，切换目录将丢失修改。',
          okText: '放弃并离开',
          okType: 'danger',
          cancelText: '取消',
          onOk: () => {
            setEditPath(null);
            setEditDirty(false);
            void loadFiles(path);
          },
        });
        return;
      }
      setEditPath(null);
      setEditDirty(false);
      void loadFiles(path);
    },
    [editDirty, loadFiles, modal],
  );

  /** 根据目录（及可选的文件名）生成面包屑；点击目录段跳转，文件段不可点击 */
  const crumbItems = useCallback(
    (dirPath: string, fileName?: string) => {
      const crumbs = buildPathCrumbs(dirPath);
      const items = crumbs.map((c) => ({
        key: c.path,
        title: (
          <a
            onClick={(e) => {
              e.preventDefault();
              goToPath(c.path);
            }}
          >
            {c.label}
          </a>
        ),
      }));
      if (fileName) {
        items.push({ key: '__file__', title: <span>{fileName}</span> });
      }
      return items;
    },
    [goToPath],
  );

  /** 根据挂载来源打开文件管理并跳转到对应目录（配置文件直接定位到所在目录） */
  const openFilesAt = (source: string) => {
    setEditPath(null);
    setEditContent('');
    setEditDirty(false);
    setError(null);
    setDetailOpen(false);
    let path = source.replace(/\/+$/, '');
    if (/\.[a-zA-Z0-9]+$/.test(path)) {
      path = path.replace(/\/[^/]+$/, '') || SITES_ROOT;
    }
    filesTargetRef.current = path;
    if (tab === 'files') {
      void loadFiles(path);
    } else {
      setTab('files');
    }
  };

  const saveFile = async () => {
    if (!activeId || !editPath) return;
    setEditSaving(true);
    setFileHint('');
    try {
      await api.writeFile(activeId, editPath, editContent);
      setEditDirty(false);
      const tip = '保存成功。如该文件被容器挂载使用，可能需要重启容器才能生效。';
      setFileHint(tip);
      toast.success('文件已保存');
    } catch (e) {
      const msg = translateError((e as Error).message);
      setError(msg);
      toast.error(msg);
    } finally {
      setEditSaving(false);
    }
  };

  const joinFileName = (dir: string, name: string) => {
    const n = name.trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!n || n.includes('/') || n.includes('..')) {
      throw new Error('名称无效：不能包含路径分隔符或 ..');
    }
    return `${dir.replace(/\/+$/, '')}/${n}`;
  };

  /** 拼接相对路径（文件夹内相对路径） */
  const joinRelativePath = (dir: string, relative: string) => {
    const rel = relative.trim().replace(/\\/g, '/').replace(/^\/+/, '');
    const parts = rel.split('/').filter(Boolean);
    if (!parts.length || parts.some((p) => p === '.' || p === '..')) {
      throw new Error('路径无效');
    }
    return `${dir.replace(/\/+$/, '')}/${parts.join('/')}`;
  };

  const isIgnoredUploadName = (name: string) =>
    name === '.DS_Store' || name.startsWith('._') || name === 'Thumbs.db';

  /** webkitdirectory 路径常带顶层文件夹名，去掉后内容直接落到当前目录 */
  const stripRootFolderPrefix = (items: { file: File; relative: string }[]) => {
    const parts = items.map((i) => i.relative.replace(/\\/g, '/').split('/').filter(Boolean));
    if (
      parts.length > 0 &&
      parts.every((p) => p.length >= 2 && p[0] === parts[0][0])
    ) {
      return items.map((item, idx) => ({
        ...item,
        relative: parts[idx].slice(1).join('/'),
      }));
    }
    return items;
  };

  const collectFromDirHandle = async (
    dir: FileSystemDirectoryHandle,
    prefix = '',
  ): Promise<{ file: File; relative: string }[]> => {
    const out: { file: File; relative: string }[] = [];
    const iterable = dir as FileSystemDirectoryHandle & {
      entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
    };
    for await (const [name, handle] of iterable.entries()) {
      if (isIgnoredUploadName(name)) continue;
      const relative = prefix ? `${prefix}/${name}` : name;
      if (handle.kind === 'file') {
        const file = await (handle as FileSystemFileHandle).getFile();
        out.push({ file, relative });
      } else if (handle.kind === 'directory') {
        out.push(...(await collectFromDirHandle(handle as FileSystemDirectoryHandle, relative)));
      }
    }
    return out;
  };

  const doUploadItems = async (
    items: { file: File; relative: string; remote: string }[],
    conflictDirs: string[],
  ) => {
    if (!activeId) return;
    setFileUploading(true);
    setError(null);
    try {
      for (const dirPath of conflictDirs) {
        await api.removePath(activeId, dirPath);
      }
      let done = 0;
      for (const item of items) {
        await api.uploadFile(activeId, item.remote, item.file);
        done += 1;
        if (items.length > 5 && done % 5 === 0) {
          setFileHint(`正在上传 ${done}/${items.length}…`);
        }
      }
      setFileHint('');
      toast.success(
        items.length === 1 ? `已上传 ${items[0].relative}` : `已全部上传，共 ${items.length} 个文件`,
      );
      await loadFiles(fileDir);
    } catch (e) {
      const msg = translateError((e as Error).message);
      setError(msg);
      toast.error(msg);
    } finally {
      setFileUploading(false);
      setFileHint('');
      if (folderUploadRef.current) folderUploadRef.current.value = '';
    }
  };

  const uploadFolderItems = async (rawItems: { file: File; relative: string }[]) => {
    if (!activeId) return;
    const normalized = stripRootFolderPrefix(
      rawItems.filter((i) => !isIgnoredUploadName(i.file.name) && i.relative),
    );
    if (!normalized.length) {
      toast.warn('所选文件夹里没有可上传的文件');
      return;
    }

    let items: { file: File; relative: string; remote: string }[];
    try {
      items = normalized.map((item) => ({
        ...item,
        remote: joinRelativePath(fileDir, item.relative),
      }));
    } catch (e) {
      const msg = translateError((e as Error).message);
      setError(msg);
      toast.error(msg);
      return;
    }

    setFileUploading(true);
    setError(null);
    setFileHint(`准备上传 ${items.length} 个文件…`);
    try {
      const { items: checked } = await api.checkPaths(
        activeId,
        items.map((i) => i.remote),
      );
      const conflictMap = new Map(
        (checked || []).filter((c) => c.exists).map((c) => [c.path, c]),
      );
      const conflicts = items.filter((i) => conflictMap.has(i.remote));
      const conflictDirs = [
        ...new Set(
          conflicts
            .filter((i) => conflictMap.get(i.remote)?.type === 'dir')
            .map((i) => i.remote),
        ),
      ];

      if (conflicts.length === 0) {
        await doUploadItems(items, []);
        return;
      }

      setFileUploading(false);
      setFileHint('');
      const preview = conflicts
        .slice(0, 8)
        .map((i) => i.relative)
        .join('\n');
      const more = conflicts.length > 8 ? `\n…另有 ${conflicts.length - 8} 个` : '';

      modal.confirm({
        title: '目标已存在，是否覆盖？',
        content: (
          <div>
            <p style={{ marginBottom: 8 }}>
              将上传全部 {items.length} 个文件（含所有子文件夹），其中 {conflicts.length} 个已存在
              {conflictDirs.length ? `（含 ${conflictDirs.length} 个目录）` : ''}。是否覆盖？
            </p>
            <pre
              className="mono"
              style={{
                margin: 0,
                maxHeight: 180,
                overflow: 'auto',
                fontSize: 12,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {preview}
              {more}
            </pre>
          </div>
        ),
        okText: '覆盖并全部上传',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => doUploadItems(items, conflictDirs),
        onCancel: () => {
          if (folderUploadRef.current) folderUploadRef.current.value = '';
        },
      });
    } catch (e) {
      const msg = translateError((e as Error).message);
      setError(msg);
      toast.error(msg);
      setFileUploading(false);
      setFileHint('');
      if (folderUploadRef.current) folderUploadRef.current.value = '';
    }
  };

  /** 旧版浏览器兜底：系统文件夹选择框 */
  const onUploadFolderInput = async (list: FileList | null) => {
    if (!list?.length) {
      if (folderUploadRef.current) folderUploadRef.current.value = '';
      return;
    }
    const raw = Array.from(list).map((file) => ({
      file,
      relative:
        (file as File & { webkitRelativePath?: string }).webkitRelativePath?.trim() || file.name,
    }));
    await uploadFolderItems(raw);
  };

  /** 点上传：选一个本地文件夹，自动递归上传里面全部文件和子目录 */
  const openFolderUpload = async () => {
    if (!activeId || fileUploading) return;
    const picker = (
      window as Window & {
        showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker;

    if (typeof picker === 'function') {
      try {
        const dir = await picker.call(window);
        setFileUploading(true);
        setFileHint('正在读取文件夹…');
        const items = await collectFromDirHandle(dir);
        setFileUploading(false);
        setFileHint('');
        await uploadFolderItems(items);
      } catch (e) {
        setFileUploading(false);
        setFileHint('');
        // 用户取消选目录
        if ((e as Error)?.name === 'AbortError') return;
        // 不支持或失败时退回 input
        folderUploadRef.current?.click();
      }
      return;
    }

    folderUploadRef.current?.click();
  };

  const submitCreateEntry = async () => {
    if (!activeId || !createModal) return;
    setCreatingEntry(true);
    setError(null);
    try {
      if (createModal === 'site') {
        const name = createName.trim().replace(/[^a-zA-Z0-9_-]/g, '');
        if (!name) throw new Error('站点名称无效：请使用英文、数字、下划线或中划线');
        const r = await api.createSite(activeId, name);
        toast.success(`站点已创建：${r.path}`);
        setCreateModal(null);
        setCreateName('');
        await loadFiles(r.path);
      } else {
        const full = joinFileName(fileDir, createName);
        if (createModal === 'dir') {
          await api.mkdir(activeId, full);
          toast.success('目录已创建');
          setCreateModal(null);
          setCreateName('');
          await loadFiles(fileDir);
        } else {
          await api.writeFile(activeId, full, '');
          toast.success('文件已创建');
          setCreateModal(null);
          setCreateName('');
          await openFile(full);
        }
      }
    } catch (e) {
      const msg = translateError((e as Error).message);
      setError(msg);
      toast.error(msg);
    } finally {
      setCreatingEntry(false);
    }
  };

  const removeEntry = async (ent: DirEntry) => {
    if (!activeId) return;
    modal.confirm({
      title: ent.type === 'dir' ? '删除目录' : '删除文件',
      content:
        ent.type === 'dir'
          ? `确定要删除目录「${ent.name}」吗？将递归删除其内部所有内容，且不可恢复。`
          : `确定要删除文件「${ent.name}」吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await api.removePath(activeId, ent.path);
          toast.success(`已删除：${ent.name}`);
          if (editPath === ent.path) {
            setEditPath(null);
            setEditContent('');
            setEditDirty(false);
          }
          await loadFiles(fileDir);
        } catch (e) {
          const msg = translateError((e as Error).message);
          setError(msg);
          toast.error(msg);
          throw e;
        }
      },
    });
  };

  const removeVol = async (name: string) => {
    if (!activeId) return;
    modal.confirm({
      title: '删除数据卷',
      content: `确定要删除数据卷「${name}」吗？此操作不可撤销，卷内数据将永久丢失。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await api.removeVolume(activeId, name);
          toast.success(`已删除数据卷 ${name}`);
          await loadVolumes();
        } catch (e) {
          toast.error(translateError((e as Error).message));
          throw e;
        }
      },
    });
  };

  const createVol = async () => {
    if (!activeId || !newVolumeName.trim()) {
      toast.warn('请先输入卷名称');
      return;
    }
    setCreatingVolume(true);
    try {
      await api.createVolume(activeId, newVolumeName.trim());
      toast.success(`已创建数据卷 ${newVolumeName.trim()}`);
      setVolumeModalOpen(false);
      setNewVolumeName('');
      await loadVolumes();
    } catch (e) {
      toast.error(translateError((e as Error).message));
    } finally {
      setCreatingVolume(false);
    }
  };

  const act = async (c: DockerContainer, action: string) => {
    if (!activeId) return;
    try {
      await api.containerAction(activeId, c.name || c.id, action);
      toast.success(`容器 ${c.name} 已${ACTION_LABELS[action] || '操作'}`);
      await load();
    } catch (e) {
      const msg = translateError((e as Error).message);
      setError(msg);
      toast.error(msg);
    }
  };

  const openCopyModal = (c: DockerContainer) => {
    const targets = servers.filter((s) => s.connected && s.id !== activeId);
    setCopySource(c);
    setCopyTargetName(c.name);
    setCopyOverwriteVol(false);
    setCopyTargetId(targets[0]?.id || '');
    setCopyModalOpen(true);
    copyTask.reset();
  };

  const submitCopyContainer = async () => {
    if (!activeId || !copySource) return;
    if (!copyTargetId) {
      toast.warn('请先连接另一台服务器，并在此选择目标机');
      return;
    }
    const name = copyTargetName.trim() || copySource.name;
    await copyTask.run(
      () =>
        api.startTask(activeId, 'copy-container', {
          toServerId: copyTargetId,
          containerRef: copySource.name || copySource.id,
          targetName: name,
          overwriteVolumeData: copyOverwriteVol,
        }),
      api.streamTask,
    );
  };

  const showLogs = async (c: DockerContainer) => {
    if (!activeId) return;
    try {
      const r = await api.containerLogs(activeId, c.name || c.id);
      setLogTitle(c.name);
      setLogs(r.logs);
    } catch (e) {
      const msg = translateError((e as Error).message);
      setError(msg);
      toast.error(msg);
    }
  };

  const runContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeId) return;
    setError(null);
    try {
      await api.runContainer(activeId, {
        image: runForm.image,
        name: runForm.name || undefined,
        ports: runForm.ports
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        env: runForm.env
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        restart: runForm.restart,
      });
      toast.success('容器已创建');
      setTab('containers');
      await load();
    } catch (err) {
      const msg = translateError((err as Error).message);
      setError(msg);
      toast.error(msg);
    }
  };

  const installDocker = async () => {
    if (!activeId) return;
    await task.run(() => api.startTask(activeId, 'install-docker'), api.streamTask);
  };

  const pull = async (image: string) => {
    if (!activeId || !image.trim() || pullingImage) return;
    setPullingImage(image.trim());
    try {
      await pullTask.run(
        () => api.startTask(activeId, 'pull-image', { image: image.trim() }),
        api.streamTask,
      );
      await load();
    } finally {
      setPullingImage(null);
    }
  };

  const fetchTags = async (repoOrImage: string, title?: string) => {
    const repo = repoOrImage.includes(':') ? repoOrImage.split(':')[0] : repoOrImage;
    setTagPanelTitle(title || repo);
    setTagLoading(true);
    setTagError(null);
    setTagFilter('');
    setSelectedTag('');
    try {
      const r = await api.remoteTags(repo);
      setTagList(r.tags);
      setTagSource(r.source);
      if (r.tags[0]) setSelectedTag(r.tags[0].full);
    } catch (e) {
      setTagList([]);
      setTagSource(null);
      const msg = translateError((e as Error).message);
      setTagError(msg);
      toast.error(msg);
    } finally {
      setTagLoading(false);
    }
  };

  const imageRef = (img: DockerImage) => {
    if (img.repository && img.repository !== '<none>' && img.tag && img.tag !== '<none>') {
      return `${img.repository}:${img.tag}`;
    }
    return img.id;
  };

  const removeImg = async (img: DockerImage) => {
    if (!activeId) return;
    const ref = imageRef(img);
    modal.confirm({
      title: '删除镜像',
      content: `确定要删除镜像「${ref}」吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await api.removeImage(activeId, ref);
          toast.success(`已删除镜像 ${ref}`);
          await load();
        } catch (e) {
          const msg = translateError((e as Error).message);
          setError(msg);
          toast.error(msg);
          throw e;
        }
      },
    });
  };

  const runFromImage = (img: DockerImage) => {
    const ref = imageRef(img);
    const ports = /nginx/i.test(ref)
      ? '8080:80'
      : /mysql|mariadb/i.test(ref)
        ? '3306:3306'
        : /postgres/i.test(ref)
          ? '5432:5432'
          : /redis/i.test(ref)
            ? '6379:6379'
            : '8080:80';
    setRunForm({
      image: ref,
      name: '',
      ports,
      env: '',
      restart: 'unless-stopped',
    });
    setTab('run');
  };

  const uploadAndLoadImage = async () => {
    if (!activeId || !imageFile) return;
    setLoadError(null);
    setLoadHint('正在上传镜像文件…');
    loadTask.reset();
    const ext =
      imageFile.name.toLowerCase().endsWith('.tar.gz') || imageFile.name.toLowerCase().endsWith('.tgz')
        ? 'tar.gz'
        : 'tar';
    const remotePath = `/tmp/vizops-img-${Date.now()}.${ext}`;
    try {
      await api.uploadBin(activeId, remotePath, imageFile);
      setLoadHint('上传完成，正在执行 docker load…');
      await loadTask.run(
        () => api.startTask(activeId, 'load-image', { archivePath: remotePath }),
        api.streamTask,
      );
      setLoadHint('');
      setImageFile(null);
      await load();
    } catch (e) {
      setLoadHint('');
      setLoadError(translateError((e as Error).message));
    }
  };

  return (
    <Shell
      title="Docker"
      subtitle="管理容器、镜像与数据卷，拉取或上传镜像，并可直接编辑挂载文件"
    >
      <NeedServer>
        <div className="tabs">
          {(
            [
              ['containers', '容器'],
              ['images', '镜像'],
              ['pull', '拉取 / 上传镜像'],
              ['volumes', '数据卷'],
              ['files', '文件管理'],
              ['run', '新建容器'],
              ['install', '安装 Docker'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={`tab ${tab === k ? 'active' : ''}`}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <Alert
            type="error"
            showIcon
            closable
            title={error}
            style={{ marginBottom: 16 }}
            onClose={() => setError(null)}
          />
        )}

        {tab === 'containers' && (
          <div className="stack">
            <div className="tab-toolbar">
              <Button type="primary" icon={<Plus size={14} />} onClick={() => setTab('run')}>
                新建容器
              </Button>
              <Button icon={<RefreshCw size={14} />} disabled={!activeId || loading} onClick={() => void load()}>
                刷新
              </Button>
            </div>
            {loading && <Loading text="正在加载容器" />}
            {!loading && containers.length === 0 && (
              <div className="empty panel">
                <h3>暂无容器</h3>
                <p>还没有运行任何容器。可以新建一个 Nginx 容器，或先去拉取需要的镜像。</p>
              </div>
            )}
            {containers.length > 0 && (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>名称</th>
                      <th>镜像</th>
                      <th>状态</th>
                      <th>端口</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {containers.map((c) => {
                      const access =
                        isWebFrontend(c) && c.state === 'running' && activeServer?.host
                          ? resolveAccessUrl(c.ports, activeServer.host)
                          : null;
                      return (
                      <tr key={`${c.id}-${c.name}`}>
                        <td>
                          <button
                            type="button"
                            className="name-link"
                            onClick={() => void showDetail(c)}
                            title="查看详情"
                          >
                            {c.name}
                          </button>
                          <div className="mono muted">{c.id.slice(0, 12)}</div>
                          {access && (
                            <a
                              className="access-link"
                              href={access.url}
                              target="_blank"
                              rel="noreferrer"
                              title="在浏览器中打开"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink size={11} />
                              {access.label}
                            </a>
                          )}
                        </td>
                        <td className="mono">{c.image}</td>
                        <td>
                          <span className={`badge ${c.state === 'running' ? 'ok' : 'warn'}`}>
                            {c.statusText || c.status}
                          </span>
                        </td>
                        <td className="mono" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.ports || '-'}
                        </td>
                        <td>
                          <div className="actions">
                            {c.state !== 'running' ? (
                              <Button size="small" icon={<Play size={12} />} onClick={() => void act(c, 'start')}>
                                启动
                              </Button>
                            ) : (
                              <Button size="small" icon={<Square size={12} />} onClick={() => void act(c, 'stop')}>
                                停止
                              </Button>
                            )}
                            <Button size="small" icon={<RotateCcw size={12} />} onClick={() => void act(c, 'restart')}>
                              重启
                            </Button>
                            <Button size="small" icon={<ScrollText size={12} />} onClick={() => void showLogs(c)}>
                              日志
                            </Button>
                            <Button size="small" icon={<Copy size={12} />} onClick={() => openCopyModal(c)}>
                              复制到…
                            </Button>
                            <Button
                              size="small"
                              danger
                              icon={<Trash2 size={12} />}
                              onClick={() => {
                                modal.confirm({
                                  title: '删除容器',
                                  content: `确定要删除容器「${c.name}」吗？此操作不可撤销。`,
                                  okText: '删除',
                                  okType: 'danger',
                                  cancelText: '取消',
                                  onOk: () => act(c, 'remove'),
                                });
                              }}
                            >
                              删除
                            </Button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {logs !== null && (
              <Drawer
                title={`日志 · ${logTitle}`}
                placement="right"
                size={560}
                open={logs !== null}
                onClose={() => setLogs(null)}
                destroyOnHidden
              >
                <pre className="terminal" style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {logs || '暂无日志'}
                </pre>
              </Drawer>
            )}

            <Drawer
              title={detail ? `容器详情 · ${detail.name}` : '容器详情'}
              placement="right"
              size={640}
              open={detailOpen}
              onClose={() => {
                setDetailOpen(false);
                setDetail(null);
              }}
              destroyOnHidden
            >
              {detailLoading && <Loading text="正在加载详情" />}
              {detail && (
                <div className="stack">
                  <div className="kv-grid">
                    <div>
                      <span className="muted">镜像</span>
                      <div className="mono">{detail.image}</div>
                    </div>
                    <div>
                      <span className="muted">状态</span>
                      <div>{detail.status}</div>
                    </div>
                    <div>
                      <span className="muted">重启策略</span>
                      <div>{detail.restartPolicy}</div>
                    </div>
                    <div>
                      <span className="muted">网络模式</span>
                      <div className="mono">{detail.networkMode || '-'}</div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span className="muted">端口</span>
                      <div className="mono">{detail.ports.length ? detail.ports.join('，') : '-'}</div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span className="muted">创建时间</span>
                      <div className="mono">{detail.created || '-'}</div>
                    </div>
                  </div>

                  <div>
                    <h4 style={{ margin: '8px 0' }}>挂载 / 数据卷</h4>
                    {detail.mounts.length === 0 ? (
                      <div className="muted">无挂载</div>
                    ) : (
                      <div className="table-wrap">
                        <table className="data">
                          <thead>
                            <tr>
                              <th>类型</th>
                              <th>来源（Source）</th>
                              <th>挂载点</th>
                              <th>权限</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.mounts.map((m, i) => (
                              <tr key={`${m.source}-${m.destination}-${i}`}>
                                <td>{m.type}</td>
                                <td className="mono" style={{ wordBreak: 'break-all' }}>
                                  {m.source || '-'}
                                </td>
                                <td className="mono">{m.destination}</td>
                                <td>
                                  {m.rw ? '可写' : '只读'}
                                  <div className="muted" style={{ fontSize: 11 }}>
                                    以容器内路径为准
                                  </div>
                                </td>
                                <td>
                                  {canEditMountSource(m.source) && (
                                    <Button
                                      type="primary"
                                      size="small"
                                      icon={<FolderOpen size={12} />}
                                      onClick={() => openFilesAt(m.source)}
                                    >
                                      打开目录
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {detail.editableRoots.length > 0 && (
                      <Alert
                        type="info"
                        showIcon
                        style={{ marginTop: 12 }}
                        title={
                          <>
                            该容器挂载的{' '}
                            <code className="mono">
                              {detail.editableRoots.find((p) => p.endsWith('/html')) || detail.editableRoots[0]}
                            </code>{' '}
                            目录可在「文件管理」中直接编辑，保存后可能需要重启容器才能生效。
                          </>
                        }
                      />
                    )}
                  </div>

                  {detail.env.length > 0 && (
                    <details>
                      <summary className="muted" style={{ cursor: 'pointer' }}>
                        环境变量（{detail.env.length}）
                      </summary>
                      <pre className="cmd-block" style={{ maxHeight: 200, marginTop: 8 }}>
                        {detail.env.join('\n')}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </Drawer>

            <Modal
              title={copySource ? `复制容器 · ${copySource.name}` : '复制到其他服务器'}
              open={copyModalOpen}
              onCancel={() => {
                if (!copyTask.running) {
                  setCopyModalOpen(false);
                  setCopySource(null);
                }
              }}
              onOk={() => void submitCopyContainer()}
              okText={copyTask.running ? '复制中…' : '开始复制'}
              cancelText="关闭"
              confirmLoading={copyTask.running}
              okButtonProps={{ disabled: copyTask.running || !copyTargetId }}
              cancelButtonProps={{ disabled: copyTask.running }}
              destroyOnHidden
              width={560}
            >
              <div className="stack" style={{ gap: 12 }}>
                <Alert
                  type="info"
                  showIcon
                  style={{ margin: 0 }}
                  title="将复制镜像、容器配置、/opt/vizops 绑定目录与命名卷数据到目标机并启动。源服务器保持不变。"
                />
                {servers.filter((s) => s.connected && s.id !== activeId).length === 0 ? (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ margin: 0 }}
                    title="请先到「服务器」页连接另一台机器，再回来选择目标。"
                  />
                ) : (
                  <>
                    <div className="field">
                      <label>目标服务器</label>
                      <select
                        value={copyTargetId}
                        disabled={copyTask.running}
                        onChange={(e) => setCopyTargetId(e.target.value)}
                        style={{ width: '100%' }}
                      >
                        {servers
                          .filter((s) => s.connected && s.id !== activeId)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} · {s.host}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>目标容器名称</label>
                      <Input
                        value={copyTargetName}
                        disabled={copyTask.running}
                        onChange={(e) => setCopyTargetName(e.target.value)}
                        placeholder="默认与源容器同名"
                      />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={copyOverwriteVol}
                        disabled={copyTask.running}
                        onChange={(e) => setCopyOverwriteVol(e.target.checked)}
                      />
                      <span>若目标已有同名数据卷，覆盖其中的数据</span>
                    </label>
                  </>
                )}
                {(copyTask.logs || copyTask.running || copyTask.error) && (
                  <div>
                    {copyTask.error && (
                      <Alert type="error" showIcon style={{ marginBottom: 8 }} title={copyTask.error} />
                    )}
                    <TaskLog logs={copyTask.logs} status={copyTask.status} />
                  </div>
                )}
              </div>
            </Modal>
          </div>
        )}

        {tab === 'volumes' && (
          <div className="stack">
            <div className="tab-toolbar">
              <Button type="primary" icon={<HardDrive size={14} />} onClick={() => setVolumeModalOpen(true)}>
                新建存储卷
              </Button>
              <Button icon={<RefreshCw size={14} />} disabled={!activeId || loading} onClick={() => void loadVolumes()}>
                刷新
              </Button>
            </div>
            <Alert
              type="info"
              showIcon
              style={{ margin: 0 }}
              title="Docker 命名卷统一保存在 /var/lib/docker/volumes/ 下，其 _data 目录可在「文件管理」中直接浏览与编辑。"
            />
            {loading && <Loading text="正在加载数据卷" />}
            {!loading && volumes.length === 0 && (
              <div className="empty panel">
                <h3>暂无数据卷</h3>
                <p>还没有创建任何数据卷，数据卷可用于持久化容器内的数据。</p>
              </div>
            )}
            {volumes.length > 0 && (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>名称</th>
                      <th>驱动</th>
                      <th>挂载点</th>
                      <th>创建时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {volumes.map((v) => (
                      <tr key={v.name}>
                        <td className="mono">{v.name}</td>
                        <td>{v.driver}</td>
                        <td className="mono muted" style={{ wordBreak: 'break-all', fontSize: 12 }}>
                          {v.mountpoint || '-'}
                        </td>
                        <td>{v.created || '-'}</td>
                        <td>
                          <Space>
                            {v.mountpoint && canEditMountSource(v.mountpoint) && (
                              <Button size="small" icon={<FolderOpen size={12} />} onClick={() => openFilesAt(v.mountpoint)}>
                                打开目录
                              </Button>
                            )}
                            <Button size="small" danger icon={<Trash2 size={12} />} onClick={() => void removeVol(v.name)}>
                              删除
                            </Button>
                          </Space>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Modal
              title="新建存储卷"
              open={volumeModalOpen}
              onCancel={() => {
                setVolumeModalOpen(false);
                setNewVolumeName('');
              }}
              onOk={() => void createVol()}
              confirmLoading={creatingVolume}
              okText="创建"
              cancelText="取消"
            >
              <Input
                placeholder="卷名称，例如 my-data"
                value={newVolumeName}
                onChange={(e) => setNewVolumeName(e.target.value)}
                onPressEnter={() => void createVol()}
              />
            </Modal>
          </div>
        )}

        {tab === 'files' && (
          <div className="stack files-workspace">
            <Alert
              type="info"
              showIcon
              style={{ margin: 0 }}
              title={
                <>
                  可编辑目录包括 <code className="mono">{SITES_ROOT}/站点名</code> 与 Docker 卷的{' '}
                  <code className="mono">/var/lib/docker/volumes/卷名/_data</code>
                  。点「上传」选择本地文件夹后，会递归上传其中全部内容（文件 + 子目录）；若目标已存在会询问是否覆盖。
                </>
              }
            />

            {editPath ? (
              <div className="panel stack file-edit-panel">
                <div className="file-toolbar">
                  <Button size="small" icon={<ArrowLeft size={12} />} onClick={() => goToPath(fileDir)}>
                    返回目录
                  </Button>
                  <Breadcrumb
                    className="path-crumbs"
                    items={crumbItems(fileDir, editPath.split('/').filter(Boolean).pop() || editPath)}
                  />
                  <Button
                    type="primary"
                    size="small"
                    icon={<Save size={12} />}
                    disabled={!editDirty || editSaving}
                    loading={editSaving}
                    onClick={() => void saveFile()}
                  >
                    保存
                  </Button>
                </div>
                <div className="mono muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                  当前路径：{editPath}
                </div>
                {fileHint && <Alert type="success" showIcon closable title={fileHint} onClose={() => setFileHint('')} />}
                <textarea
                  className="file-editor"
                  value={editContent}
                  onChange={(e) => {
                    setEditContent(e.target.value);
                    setEditDirty(true);
                  }}
                  spellCheck={false}
                />
              </div>
            ) : (
              <div className="panel stack file-edit-panel">
                <div className="file-toolbar">
                  <Breadcrumb className="path-crumbs" items={crumbItems(fileDir)} />
                  <input
                    ref={folderUploadRef}
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
                    onChange={(e) => void onUploadFolderInput(e.target.files)}
                  />
                  <Button
                    type="primary"
                    size="small"
                    icon={<Upload size={12} />}
                    loading={fileUploading}
                    disabled={fileLoading || fileUploading}
                    onClick={() => void openFolderUpload()}
                  >
                    上传
                  </Button>
                  <Button
                    size="small"
                    icon={<FilePlus size={12} />}
                    disabled={fileLoading || fileUploading}
                    onClick={() => {
                      setCreateName('');
                      setCreateModal('file');
                    }}
                  >
                    新建文件
                  </Button>
                  <Button
                    size="small"
                    icon={<FolderPlus size={12} />}
                    disabled={fileLoading || fileUploading}
                    onClick={() => {
                      setCreateName('');
                      setCreateModal('site');
                    }}
                  >
                    新建站点
                  </Button>
                  <Button
                    size="small"
                    icon={<FolderPlus size={12} />}
                    disabled={fileLoading || fileUploading}
                    onClick={() => {
                      setCreateName('');
                      setCreateModal('dir');
                    }}
                  >
                    新建目录
                  </Button>
                  <Button size="small" icon={<RefreshCw size={12} />} disabled={fileLoading || fileUploading} onClick={() => void loadFiles(fileDir)}>
                    刷新
                  </Button>
                </div>
                <div className="mono muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                  当前路径：{fileDir}
                </div>
                {fileHint && !editPath && (
                  <Alert type="info" showIcon style={{ margin: 0 }} title={fileHint} />
                )}
                {fileLoading && <Loading text="正在加载目录" />}
                {fileUploading && <Loading text={fileHint || '正在上传文件夹…'} />}
                {!fileLoading && !fileUploading && fileEntries.length === 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ margin: 0 }}
                    title="该目录为空。可用「新建站点」生成 html/conf 结构，或点「上传」选择本地文件夹整夹上传。"
                  />
                )}
                {!fileLoading && !fileUploading && fileEntries.length > 0 && (
                  <div className="table-wrap">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>名称</th>
                          <th>类型</th>
                          <th>大小</th>
                          <th>修改时间</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fileEntries.map((ent) => (
                          <tr key={ent.path}>
                            <td className="mono">{ent.name}</td>
                            <td>{ent.type === 'dir' ? '目录' : '文件'}</td>
                            <td>{ent.type === 'file' ? `${(ent.size / 1024).toFixed(1)} KB` : '-'}</td>
                            <td>{ent.mtime}</td>
                            <td>
                              <div className="actions">
                                {ent.type === 'dir' ? (
                                  <Button size="small" icon={<FolderOpen size={12} />} onClick={() => void loadFiles(ent.path)}>
                                    打开
                                  </Button>
                                ) : (
                                  <Button type="primary" size="small" icon={<Pencil size={12} />} onClick={() => void openFile(ent.path)}>
                                    编辑
                                  </Button>
                                )}
                                <Button size="small" danger icon={<Trash2 size={12} />} onClick={() => void removeEntry(ent)}>
                                  删除
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <Modal
                  title={
                    createModal === 'site'
                      ? '新建站点'
                      : createModal === 'dir'
                        ? '新建目录'
                        : '新建文件'
                  }
                  open={createModal !== null}
                  onCancel={() => {
                    if (!creatingEntry) {
                      setCreateModal(null);
                      setCreateName('');
                    }
                  }}
                  onOk={() => void submitCreateEntry()}
                  okText="创建"
                  cancelText="取消"
                  confirmLoading={creatingEntry}
                  destroyOnHidden
                >
                  {createModal === 'site' ? (
                    <>
                      <p className="muted" style={{ marginBottom: 8 }}>
                        将在 <code className="mono">/opt/vizops/sites/</code> 下创建标准结构：
                        <code className="mono">站点名/html</code>、
                        <code className="mono">站点名/conf</code>
                        （含默认 Nginx 配置）。
                      </p>
                      <Input
                        placeholder="站点名，例如 my-site（英文、数字、_-）"
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                        onPressEnter={() => void submitCreateEntry()}
                        autoFocus
                      />
                    </>
                  ) : (
                    <>
                      <p className="muted" style={{ marginBottom: 8 }}>
                        将创建在：<code className="mono">{fileDir}</code>
                      </p>
                      <Input
                        placeholder={
                          createModal === 'dir' ? '目录名，例如 assets' : '文件名，例如 index.html'
                        }
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                        onPressEnter={() => void submitCreateEntry()}
                        autoFocus
                      />
                    </>
                  )}
                </Modal>
              </div>
            )}
          </div>
        )}

        {tab === 'images' && (
          <div className="stack">
            <div className="tab-toolbar">
              <Button type="primary" icon={<Plus size={14} />} onClick={() => setTab('pull')}>
                拉取 / 上传镜像
              </Button>
              <Button icon={<RefreshCw size={14} />} disabled={!activeId || loading} onClick={() => void load()}>
                刷新
              </Button>
            </div>
            <div className="panel muted" style={{ margin: 0 }}>
              本地已下载的镜像列表。点击「创建容器」可基于该镜像快速新建容器；镜像名规则为{' '}
              <code className="mono">docker run</code> 时的仓库名与标签。
            </div>
            {loading && <Loading text="正在加载镜像" />}
            {!loading && images.length === 0 && (
              <div className="empty panel">
                <h3>暂无镜像</h3>
                <p>请先前往「拉取 / 上传镜像」获取所需镜像。</p>
              </div>
            )}
            {images.length > 0 && (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>仓库</th>
                      <th>标签</th>
                      <th>大小</th>
                      <th>创建时间</th>
                      <th>ID</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {images.map((img, idx) => {
                      const ref = imageRef(img);
                      return (
                        <tr key={`${img.id}-${img.repository}-${img.tag}-${idx}`}>
                          <td>{img.repository}</td>
                          <td className="mono">{img.tag}</td>
                          <td>{img.size}</td>
                          <td>{img.created}</td>
                          <td className="mono muted">{img.id.slice(0, 12)}</td>
                          <td>
                            <div className="actions">
                              <Button type="primary" size="small" icon={<Play size={12} />} onClick={() => runFromImage(img)}>
                                创建容器
                              </Button>
                              <Button size="small" danger icon={<Trash2 size={12} />} onClick={() => void removeImg(img)}>
                                删除
                              </Button>
                            </div>
                            <div className="mono muted" style={{ fontSize: 11, marginTop: 4 }}>
                              {ref}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'pull' && (
          <div className="stack">
            <div className="panel">
              <h3 className="panel-title">常用镜像 · 一键拉取</h3>
              <p className="muted" style={{ marginTop: 0 }}>
                以下镜像均从 Docker Hub 拉取，需要服务器可访问外网。拉取完成后会自动出现在「镜像」列表。
              </p>
              <div className="grid-3">
                {COMMON_IMAGES.map((item) => {
                  const ready = images.some(
                    (img) =>
                      `${img.repository}:${img.tag}` === item.image ||
                      (img.repository === item.repo && img.tag === (item.image.split(':')[1] || 'latest')),
                  );
                  return (
                    <div key={item.repo} className="panel" style={{ margin: 0, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <strong>{item.title}</strong>
                        <span className={`badge ${ready ? 'ok' : ''}`}>{ready ? '已拉取' : '未拉取'}</span>
                      </div>
                      <div className="mono muted" style={{ margin: '8px 0', fontSize: 12 }}>
                        {item.repo}
                      </div>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                        {item.desc}
                      </div>
                      <div className="actions">
                        <Button type="primary" size="small" disabled={tagLoading} onClick={() => void fetchTags(item.repo, item.title)}>
                          选择版本
                        </Button>
                        <Button
                          size="small"
                          icon={<Download size={12} />}
                          disabled={!!pullingImage}
                          loading={pullingImage === item.image}
                          onClick={() => void pull(item.image)}
                        >
                          {pullingImage === item.image ? '拉取中…' : `拉取 ${item.image.split(':')[1]}`}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="panel" style={{ maxWidth: 640 }}>
              <h3 className="panel-title">自定义镜像 · 浏览版本标签</h3>
              <div className="form-grid">
                <div className="field">
                  <label>镜像名称（不含标签）</label>
                  <input
                    value={customImage.includes(':') ? customImage.split(':')[0] : customImage}
                    onChange={(e) => setCustomImage(e.target.value)}
                    placeholder="例如 nginx、mysql、bitnami/nginx"
                  />
                </div>
                <div className="actions">
                  <Button
                    type="primary"
                    icon={<Download size={14} />}
                    disabled={tagLoading || !(customImage.includes(':') ? customImage.split(':')[0] : customImage).trim()}
                    loading={tagLoading}
                    onClick={() => void fetchTags(customImage.includes(':') ? customImage.split(':')[0] : customImage)}
                  >
                    查询可用版本
                  </Button>
                </div>
              </div>
            </div>

            {(tagLoading || tagList.length > 0 || tagError) && (
              <div className="panel">
                <h3 className="panel-title">
                  可用标签{tagPanelTitle ? ` · ${tagPanelTitle}` : ''}
                  {tagSource === 'fallback' && <span className="badge warn" style={{ marginLeft: 8 }}>常用标签兜底</span>}
                  {tagSource === 'hub' && <span className="badge ok" style={{ marginLeft: 8 }}>Docker Hub</span>}
                </h3>
                {tagError && <Alert type="error" showIcon closable title={tagError} onClose={() => setTagError(null)} />}
                {tagLoading && <Loading text="正在查询标签" />}
                {!tagLoading && tagList.length > 0 && (
                  <>
                    <div className="field" style={{ marginBottom: 10 }}>
                      <label>筛选标签</label>
                      <input
                        value={tagFilter}
                        onChange={(e) => setTagFilter(e.target.value)}
                        placeholder="例如 alpine、8.0、latest"
                      />
                    </div>
                    <div className="tag-list">
                      {tagList
                        .filter((t) => !tagFilter.trim() || t.name.toLowerCase().includes(tagFilter.trim().toLowerCase()))
                        .slice(0, 200)
                        .map((t) => (
                          <button
                            key={t.full}
                            type="button"
                            className={`tag-item ${selectedTag === t.full ? 'active' : ''}`}
                            onClick={() => setSelectedTag(t.full)}
                          >
                            <span className="mono">{t.name}</span>
                            {t.size != null && t.size > 0 && (
                              <span className="muted" style={{ fontSize: 11 }}>
                                {(t.size / 1024 / 1024).toFixed(0)} MB
                              </span>
                            )}
                          </button>
                        ))}
                    </div>
                    <div className="actions" style={{ marginTop: 12 }}>
                      <div className="muted" style={{ flex: 1, fontSize: 13 }}>
                        将拉取：<code className="mono">{selectedTag || '请先选择标签'}</code>
                      </div>
                      <Button
                        type="primary"
                        icon={<Download size={14} />}
                        disabled={!selectedTag || !!pullingImage}
                        loading={pullingImage === selectedTag}
                        onClick={() => void pull(selectedTag)}
                      >
                        拉取所选镜像
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="panel" style={{ maxWidth: 560 }}>
              <h3 className="panel-title">离线导入 · 上传镜像文件</h3>
              <p className="muted" style={{ marginTop: 0, lineHeight: 1.6 }}>
                适用于服务器无法访问外网的场景。请先在有网络的机器上执行{' '}
                <code className="mono">docker save nginx:alpine -o nginx.tar</code>
                ，再上传 <code className="mono">.tar</code> / <code className="mono">.tar.gz</code> 文件。
              </p>
              <div className="form-grid">
                <div className="field">
                  <label>选择镜像文件</label>
                  <input
                    type="file"
                    accept=".tar,.tar.gz,.tgz,application/x-tar,application/gzip"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  />
                  {imageFile && (
                    <div className="muted" style={{ marginTop: 6 }}>
                      已选择：{imageFile.name}（{(imageFile.size / 1024 / 1024).toFixed(2)} MB）
                    </div>
                  )}
                </div>
                <Button
                  type="primary"
                  icon={<Download size={14} />}
                  disabled={!imageFile || loadTask.running || !!pullingImage}
                  loading={loadTask.running}
                  onClick={() => void uploadAndLoadImage()}
                  style={{ alignSelf: 'flex-start' }}
                >
                  上传并导入
                </Button>
              </div>
            </div>

            {pullTask.error && <Alert type="error" showIcon closable title={pullTask.error} />}
            {loadError && <Alert type="error" showIcon closable title={loadError} onClose={() => setLoadError(null)} />}
            {(pullTask.logs || pullTask.running) && (
              <div className="panel">
                <h3 className="panel-title">拉取日志{pullingImage ? ` · ${pullingImage}` : ''}</h3>
                <TaskLog logs={pullTask.logs} status={pullTask.status} />
              </div>
            )}
            {(loadHint || loadTask.logs || loadTask.running) && (
              <div className="panel">
                <h3 className="panel-title">导入日志</h3>
                {loadHint && <div className="muted" style={{ marginBottom: 8 }}>{loadHint}</div>}
                <TaskLog logs={loadTask.logs} status={loadTask.status} />
              </div>
            )}
          </div>
        )}

        {tab === 'run' && (
          <div className="panel" style={{ maxWidth: 560 }}>
            <h3 className="panel-title">
              <Plus size={16} />
              新建容器
            </h3>
            <form className="form-grid" onSubmit={(e) => void runContainer(e)}>
              <div className="field">
                <label>镜像</label>
                <input
                  required
                  value={runForm.image}
                  onChange={(e) => setRunForm({ ...runForm, image: e.target.value })}
                  placeholder="nginx:alpine"
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>容器名称（可选）</label>
                  <input value={runForm.name} onChange={(e) => setRunForm({ ...runForm, name: e.target.value })} />
                </div>
                <div className="field">
                  <label>端口映射（宿主:容器，逗号分隔）</label>
                  <input
                    value={runForm.ports}
                    onChange={(e) => setRunForm({ ...runForm, ports: e.target.value })}
                    placeholder="8080:80"
                  />
                </div>
              </div>
              <div className="field">
                <label>环境变量（每行一项，格式：名称=值）</label>
                <textarea value={runForm.env} onChange={(e) => setRunForm({ ...runForm, env: e.target.value })} />
              </div>
              <div className="field">
                <label>重启策略</label>
                <select value={runForm.restart} onChange={(e) => setRunForm({ ...runForm, restart: e.target.value })}>
                  <option value="no">不自动重启</option>
                  <option value="unless-stopped">除非手动停止（推荐）</option>
                  <option value="always">总是重启</option>
                  <option value="on-failure">失败时重启</option>
                </select>
              </div>
              <Button type="primary" htmlType="submit" icon={<Play size={14} />}>
                创建并启动
              </Button>
            </form>
          </div>
        )}

        {tab === 'install' && (
          <div className="panel stack">
            <p className="muted" style={{ margin: 0 }}>
              自动识别 Ubuntu / Debian（apt）或 CentOS / RHEL（yum）等主流发行版，一键安装并启动 Docker 服务。
            </p>
            <Button
              type="primary"
              icon={<Download size={14} />}
              disabled={task.running}
              loading={task.running}
              onClick={() => void installDocker()}
              style={{ alignSelf: 'flex-start' }}
            >
              安装 / 修复 Docker
            </Button>
            {task.error && <Alert type="error" showIcon closable title={task.error} />}
            {(task.logs || task.running) && <TaskLog logs={task.logs} status={task.status} />}
          </div>
        )}
      </NeedServer>
    </Shell>
  );
}

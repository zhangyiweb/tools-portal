import { Router } from 'express';
import { getSystemOverview } from '../services/system.js';
import {
  listContainers,
  listImages,
  containerAction,
  containerLogs,
  runContainer,
  installDocker,
  pullImage,
  loadImageFromArchive,
  removeImage,
  listRemoteImageTags,
  inspectContainer,
  listVolumes,
  removeVolume,
  createVolume,
} from '../services/docker.js';
import { TaskBus } from '../tasks/bus.js';
import {
  installDatabase,
  deployFrontend,
  deployBackend,
  startExistingFrontendSite,
  uploadBase64File,
  DbType,
} from '../services/deploy.js';
import {
  listSiteDir,
  listDeploySites,
  readSiteFile,
  writeSiteFile,
  uploadEditableFile,
  mkdirEditable,
  removeEditable,
  checkEditablePaths,
  createSiteSkeleton,
} from '../services/files.js';
import { deployComposeStack } from '../services/compose.js';
import { copyContainer } from '../services/migrate.js';
import { sshPool } from '../ssh/pool.js';

export function createApiRouter(taskBus: TaskBus) {
  const router = Router();

  router.get('/servers/:id/overview', async (req, res) => {
    try {
      const data = await getSystemOverview(req.params.id);
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get('/servers/:id/docker/containers', async (req, res) => {
    try {
      const containers = await listContainers(req.params.id);
      res.json({ containers });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get('/servers/:id/docker/images', async (req, res) => {
    try {
      const images = await listImages(req.params.id);
      res.json({ images });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  /** 查询 Docker Hub 可用标签（不依赖服务器外网） */
  router.get('/docker/remote-tags', async (req, res) => {
    try {
      const image = String(req.query.image || '').trim();
      if (!image) {
        res.status(400).json({ error: '请提供镜像名，例如 nginx' });
        return;
      }
      const result = await listRemoteImageTags(image);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/servers/:id/docker/images/remove', async (req, res) => {
    try {
      const ref = String((req.body as { ref?: string }).ref || '').trim();
      if (!ref) {
        res.status(400).json({ error: '请提供镜像名称，例如 nginx:alpine' });
        return;
      }
      const result = await removeImage(req.params.id, ref);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/servers/:id/docker/action', async (req, res) => {
    try {
      const { ref, action } = req.body as {
        ref?: string;
        action?: 'start' | 'stop' | 'restart' | 'remove';
      };
      if (!ref || !action || !['start', 'stop', 'restart', 'remove'].includes(action)) {
        res.status(400).json({ error: '请提供容器名称和操作类型' });
        return;
      }
      const result = await containerAction(req.params.id, ref, action);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/servers/:id/docker/containers/:cid/:action', async (req, res) => {
    try {
      const action = req.params.action as 'start' | 'stop' | 'restart' | 'remove';
      if (!['start', 'stop', 'restart', 'remove'].includes(action)) {
        res.status(400).json({ error: '不支持的容器操作' });
        return;
      }
      const result = await containerAction(
        req.params.id,
        decodeURIComponent(req.params.cid),
        action,
      );
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get('/servers/:id/docker/containers/:cid/logs', async (req, res) => {
    try {
      const lines = Number(req.query.lines) || 100;
      const result = await containerLogs(
        req.params.id,
        decodeURIComponent(req.params.cid),
        lines,
      );
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get('/servers/:id/docker/containers/:cid/inspect', async (req, res) => {
    try {
      const detail = await inspectContainer(
        req.params.id,
        decodeURIComponent(req.params.cid),
      );
      res.json({ detail });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get('/servers/:id/docker/volumes', async (req, res) => {
    try {
      const volumes = await listVolumes(req.params.id);
      res.json({ volumes });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/servers/:id/docker/volumes/remove', async (req, res) => {
    try {
      const name = String((req.body as { name?: string }).name || '').trim();
      if (!name) {
        res.status(400).json({ error: '请提供存储卷名称' });
        return;
      }
      const result = await removeVolume(req.params.id, name);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/servers/:id/docker/volumes/create', async (req, res) => {
    try {
      const name = String((req.body as { name?: string }).name || '').trim();
      if (!name) {
        res.status(400).json({ error: '请填写存储卷名称' });
        return;
      }
      const result = await createVolume(req.params.id, name);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get('/servers/:id/files', async (req, res) => {
    try {
      const path = String(req.query.path || '/opt/vizops/sites');
      const result = await listSiteDir(req.params.id, path);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get('/servers/:id/sites', async (req, res) => {
    try {
      const sites = await listDeploySites(req.params.id);
      res.json({ sites });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get('/servers/:id/files/content', async (req, res) => {
    try {
      const path = String(req.query.path || '');
      if (!path) {
        res.status(400).json({ error: '请提供文件路径' });
        return;
      }
      const result = await readSiteFile(req.params.id, path);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.put('/servers/:id/files/content', async (req, res) => {
    try {
      const { path, content } = req.body as { path?: string; content?: string };
      if (!path || typeof content !== 'string') {
        res.status(400).json({ error: '请提供 path 与 content' });
        return;
      }
      const result = await writeSiteFile(req.params.id, path, content);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  /** 上传文件到可编辑目录（站点或 Docker 卷 _data） */
  router.post('/servers/:id/files/upload', async (req, res) => {
    try {
      const remotePath = String(req.query.path || '');
      if (!remotePath) {
        res.status(400).json({ error: '请提供目标文件路径' });
        return;
      }
      const expected = Number(req.headers['content-length'] || 0) || undefined;
      // 0 = 不限制，大文件上传不因请求超时中断
      req.setTimeout(0);
      res.setTimeout(0);
      const result = await uploadEditableFile(req.params.id, remotePath, req, expected);
      res.json(result);
    } catch (e) {
      if (!res.headersSent) {
        res.status(500).json({ error: (e as Error).message });
      }
    }
  });

  /** 在可编辑范围内新建目录 */
  router.post('/servers/:id/files/mkdir', async (req, res) => {
    try {
      const { path } = req.body as { path?: string };
      if (!path) {
        res.status(400).json({ error: '请提供目录路径' });
        return;
      }
      const result = await mkdirEditable(req.params.id, path);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  /** 新建站点骨架：/opt/vizops/sites/<name>/{html,conf} */
  router.post('/servers/:id/files/site', async (req, res) => {
    try {
      const { name } = req.body as { name?: string };
      if (!name || !String(name).trim()) {
        res.status(400).json({ error: '请填写站点名称' });
        return;
      }
      const result = await createSiteSkeleton(req.params.id, name);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  /** 批量检查路径是否已存在（上传冲突确认） */
  router.post('/servers/:id/files/check', async (req, res) => {
    try {
      const { paths } = req.body as { paths?: string[] };
      if (!Array.isArray(paths) || paths.length === 0) {
        res.status(400).json({ error: '请提供要检查的路径列表' });
        return;
      }
      const items = await checkEditablePaths(req.params.id, paths);
      res.json({ items });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  /** 在可编辑范围内删除文件/目录 */
  router.post('/servers/:id/files/remove', async (req, res) => {
    try {
      const { path } = req.body as { path?: string };
      if (!path) {
        res.status(400).json({ error: '请提供要删除的路径' });
        return;
      }
      const result = await removeEditable(req.params.id, path);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/servers/:id/docker/run', async (req, res) => {
    try {
      const result = await runContainer(req.params.id, req.body);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  /** 流式二进制上传（不整包进内存，避免大 zip 把进程打崩） */
  router.post('/servers/:id/upload-bin', async (req, res) => {
    try {
      const remotePath = String(req.query.path || '');
      if (!remotePath.startsWith('/tmp/vizops-') && !remotePath.startsWith('/opt/vizops/')) {
        res.status(400).json({ error: '远程路径不合法' });
        return;
      }

      req.setTimeout(0);
      res.setTimeout(0);

      const result = await sshPool.uploadStream(req.params.id, remotePath, req);
      if (!result.size) {
        res.status(400).json({ error: '未收到文件内容' });
        return;
      }
      res.json({ ok: true, path: remotePath, size: result.size });
    } catch (e) {
      if (!res.headersSent) {
        res.status(500).json({ error: (e as Error).message });
      }
    }
  });

  router.post('/servers/:id/tasks/install-docker', (req, res) => {
    const taskId = taskBus.create();
    res.json({ taskId });
    void (async () => {
      try {
        taskBus.emit(taskId, { type: 'start', message: '开始安装 Docker...' });
        const result = await installDocker(req.params.id, (chunk) => {
          taskBus.emit(taskId, { type: 'log', chunk });
        });
        taskBus.emit(taskId, {
          type: 'done',
          code: result.code,
          message: result.code === 0 ? 'Docker 安装完成' : '安装结束（可能有错误）',
        });
      } catch (e) {
        taskBus.emit(taskId, { type: 'error', message: (e as Error).message });
      }
    })();
  });

  router.post('/servers/:id/tasks/pull-image', (req, res) => {
    const image = String((req.body as { image?: string }).image || '').trim();
    if (!image) {
      res.status(400).json({ error: '请填写镜像名称，例如 nginx:alpine' });
      return;
    }
    const taskId = taskBus.create();
    res.json({ taskId });
    void (async () => {
      try {
        taskBus.emit(taskId, { type: 'start', message: `开始拉取镜像 ${image}...` });
        const result = await pullImage(req.params.id, image, (chunk) => {
          taskBus.emit(taskId, { type: 'log', chunk });
        });
        taskBus.emit(taskId, {
          type: 'done',
          code: result.code,
          message: result.code === 0 ? `镜像 ${image} 拉取完成` : '拉取结束（可能有错误）',
        });
      } catch (e) {
        taskBus.emit(taskId, { type: 'error', message: (e as Error).message });
      }
    })();
  });

  router.post('/servers/:id/tasks/load-image', (req, res) => {
    const archivePath = String((req.body as { archivePath?: string }).archivePath || '').trim();
    if (!archivePath.startsWith('/tmp/vizops-')) {
      res.status(400).json({ error: '请先上传镜像包' });
      return;
    }
    const taskId = taskBus.create();
    res.json({ taskId });
    void (async () => {
      try {
        taskBus.emit(taskId, { type: 'start', message: '开始导入本地镜像包...' });
        const result = await loadImageFromArchive(req.params.id, archivePath, (chunk) => {
          taskBus.emit(taskId, { type: 'log', chunk });
        });
        taskBus.emit(taskId, {
          type: 'done',
          code: result.code,
          message: result.code === 0 ? '镜像导入完成' : '导入结束（可能有错误）',
        });
      } catch (e) {
        taskBus.emit(taskId, { type: 'error', message: (e as Error).message });
      }
    })();
  });

  /** 跨服务器复制容器（镜像 + 挂载数据 + 配置），源机保留 */
  router.post('/servers/:id/tasks/copy-container', (req, res) => {
    const body = req.body as {
      toServerId?: string;
      containerRef?: string;
      targetName?: string;
      overwriteVolumeData?: boolean;
    };
    const toServerId = String(body.toServerId || '').trim();
    const containerRef = String(body.containerRef || '').trim();
    if (!toServerId) {
      res.status(400).json({ error: '请选择目标服务器' });
      return;
    }
    if (!containerRef) {
      res.status(400).json({ error: '请指定要复制的容器' });
      return;
    }
    if (toServerId === req.params.id) {
      res.status(400).json({ error: '源服务器与目标服务器不能相同' });
      return;
    }
    if (!sshPool.isConnected(req.params.id)) {
      res.status(400).json({ error: '源服务器未连接' });
      return;
    }
    if (!sshPool.isConnected(toServerId)) {
      res.status(400).json({ error: '目标服务器未连接，请先到「服务器」页连接' });
      return;
    }

    const taskId = taskBus.create();
    res.json({ taskId });
    void (async () => {
      try {
        taskBus.emit(taskId, {
          type: 'start',
          message: `开始复制容器 ${containerRef} → 目标服务器…`,
        });
        const result = await copyContainer(
          req.params.id,
          toServerId,
          containerRef,
          {
            targetName: body.targetName,
            overwriteVolumeData: !!body.overwriteVolumeData,
          },
          (chunk) => taskBus.emit(taskId, { type: 'log', chunk }),
        );
        taskBus.emit(taskId, {
          type: 'done',
          code: result.code,
          message: result.code === 0 ? '容器复制完成（源机未改动）' : '复制结束（可能有错误）',
        });
      } catch (e) {
        taskBus.emit(taskId, { type: 'error', message: (e as Error).message });
      }
    })();
  });

  router.post('/servers/:id/tasks/install-db', (req, res) => {
    const taskId = taskBus.create();
    const { type, ...options } = req.body as { type: DbType } & Record<string, unknown>;
    if (!['mysql', 'postgres', 'redis'].includes(type)) {
      res.status(400).json({ error: '数据库类型请选择 MySQL、PostgreSQL 或 Redis' });
      return;
    }
    res.json({ taskId });
    void (async () => {
      try {
        taskBus.emit(taskId, { type: 'start', message: `开始安装 ${type}...` });
        const result = await installDatabase(
          req.params.id,
          type,
          options as Parameters<typeof installDatabase>[2],
          (chunk) => taskBus.emit(taskId, { type: 'log', chunk }),
        );
        taskBus.emit(taskId, {
          type: 'done',
          code: result.code,
          message: result.code === 0 ? `${type} 安装完成` : '安装结束（可能有错误）',
        });
      } catch (e) {
        taskBus.emit(taskId, { type: 'error', message: (e as Error).message });
      }
    })();
  });

  router.post('/servers/:id/tasks/deploy-frontend', (req, res) => {
    const taskId = taskBus.create();
    res.json({ taskId });
    void (async () => {
      try {
        taskBus.emit(taskId, { type: 'start', message: '开始部署前端...' });
        const result = await deployFrontend(req.params.id, req.body, (chunk) =>
          taskBus.emit(taskId, { type: 'log', chunk }),
        );
        taskBus.emit(taskId, {
          type: 'done',
          code: result.code,
          message: result.code === 0 ? '前端部署完成' : '部署结束（可能有错误）',
        });
      } catch (e) {
        taskBus.emit(taskId, { type: 'error', message: (e as Error).message });
      }
    })();
  });

  /** 容器删了但代码还在：重新挂载已有站点目录启动 Nginx */
  router.post('/servers/:id/tasks/start-frontend-site', (req, res) => {
    const taskId = taskBus.create();
    res.json({ taskId });
    void (async () => {
      try {
        taskBus.emit(taskId, { type: 'start', message: '使用已有站点文件启动容器...' });
        const result = await startExistingFrontendSite(req.params.id, req.body, (chunk) =>
          taskBus.emit(taskId, { type: 'log', chunk }),
        );
        taskBus.emit(taskId, {
          type: 'done',
          code: result.code,
          message: result.code === 0 ? '容器已重新挂载启动' : '启动结束（可能有错误）',
        });
      } catch (e) {
        taskBus.emit(taskId, { type: 'error', message: (e as Error).message });
      }
    })();
  });

  router.post('/servers/:id/tasks/deploy-backend', (req, res) => {
    const taskId = taskBus.create();
    res.json({ taskId });
    void (async () => {
      try {
        taskBus.emit(taskId, { type: 'start', message: '开始部署后端...' });
        const result = await deployBackend(req.params.id, req.body, (chunk) =>
          taskBus.emit(taskId, { type: 'log', chunk }),
        );
        taskBus.emit(taskId, {
          type: 'done',
          code: result.code,
          message: result.code === 0 ? '后端部署完成' : '部署结束（可能有错误）',
        });
      } catch (e) {
        taskBus.emit(taskId, { type: 'error', message: (e as Error).message });
      }
    })();
  });

  router.post('/servers/:id/tasks/deploy-compose', (req, res) => {
    const taskId = taskBus.create();
    res.json({ taskId });
    void (async () => {
      try {
        taskBus.emit(taskId, { type: 'start', message: '开始 Compose 一键部署前后端...' });
        const result = await deployComposeStack(req.params.id, req.body, (chunk) =>
          taskBus.emit(taskId, { type: 'log', chunk }),
        );
        taskBus.emit(taskId, {
          type: 'done',
          code: result.code,
          message: result.code === 0 ? '前后端 Compose 部署完成' : '部署结束（可能有错误）',
        });
      } catch (e) {
        taskBus.emit(taskId, { type: 'error', message: (e as Error).message });
      }
    })();
  });

  router.post('/servers/:id/upload', async (req, res) => {
    try {
      const { remotePath, contentBase64 } = req.body as {
        remotePath?: string;
        contentBase64?: string;
      };
      if (!remotePath || !contentBase64) {
        res.status(400).json({ error: '请提供远程路径和文件内容' });
        return;
      }
      const result = await uploadBase64File(req.params.id, remotePath, contentBase64);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get('/tasks/:taskId/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (data: unknown) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const unsub = taskBus.subscribe(req.params.taskId, (event) => {
      send(event);
      if (event.type === 'done' || event.type === 'error') {
        unsub();
        res.end();
      }
    });

    req.on('close', () => unsub());
  });

  return router;
}

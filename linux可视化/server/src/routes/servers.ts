import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { sshPool, ServerCredential } from '../ssh/pool.js';

export const serversRouter = Router();

serversRouter.get('/', (_req, res) => {
  const list = sshPool.list().map((s) => ({
    ...s,
    connected: sshPool.isConnected(s.id),
  }));
  res.json({ servers: list });
});

serversRouter.post('/', async (req, res) => {
  try {
    const { name, host, port, username, password, privateKey, passphrase, id } =
      req.body as Partial<ServerCredential>;

    if (!host || !username) {
      res.status(400).json({ error: '请填写主机地址和用户名' });
      return;
    }
    if (!password && !privateKey) {
      res.status(400).json({ error: '请填写密码或私钥' });
      return;
    }

    const cred: ServerCredential = {
      id: id || uuidv4(),
      name: name || host,
      host: String(host).trim(),
      port: Number(port) > 0 ? Number(port) : 22,
      username,
      password,
      privateKey,
      passphrase,
    };

    const result = await sshPool.connect(cred);
    if (!result.ok) {
      res.status(400).json({ error: result.message, server: { ...cred, password: undefined, privateKey: undefined } });
      return;
    }

    res.json({
      ok: true,
      message: result.message,
      server: {
        id: cred.id,
        name: cred.name,
        host: cred.host,
        port: cred.port,
        username: cred.username,
        connected: true,
      },
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

serversRouter.post('/:id/reconnect', async (req, res) => {
  const cred = sshPool.getCredential(req.params.id);
  if (!cred) {
    res.status(404).json({ error: '服务器不存在，请重新添加' });
    return;
  }
  const result = await sshPool.connect(cred);
  if (!result.ok) {
    res.status(400).json({ error: result.message });
    return;
  }
  res.json({ ok: true, message: result.message });
});

/** 断开 SSH（保留凭证，可再连接） */
serversRouter.post('/:id/disconnect', async (req, res) => {
  await sshPool.disconnect(req.params.id);
  res.json({ ok: true });
});

serversRouter.delete('/:id', async (req, res) => {
  sshPool.remove(req.params.id);
  res.json({ ok: true });
});

serversRouter.post('/:id/exec', async (req, res) => {
  try {
    const { command } = req.body as { command?: string };
    if (!command || typeof command !== 'string') {
      res.status(400).json({ error: '请输入要执行的命令' });
      return;
    }
    // 安全：禁止明显危险的交互式命令，但仍允许运维常用操作
    if (/\brm\s+(-rf\s+)?\/\s*$/.test(command)) {
      res.status(400).json({ error: '已拒绝执行危险命令' });
      return;
    }
    const result = await sshPool.exec(req.params.id, command);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

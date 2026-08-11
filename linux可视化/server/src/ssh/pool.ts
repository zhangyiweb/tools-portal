import { Client, ConnectConfig } from 'ssh2';
import { EventEmitter } from 'events';
import { translateError } from './errors.js';

export interface ServerCredential {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface ExecResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

type ConnState = {
  client: Client;
  ready: boolean;
  lastError?: string;
};

export class SshPool extends EventEmitter {
  private connections = new Map<string, ConnState>();
  private credentials = new Map<string, ServerCredential>();

  list(): ServerCredential[] {
    return [...this.credentials.values()].map((c) => ({
      ...c,
      password: c.password ? '******' : undefined,
      privateKey: c.privateKey ? '[stored]' : undefined,
      passphrase: undefined,
    }));
  }

  getCredential(id: string): ServerCredential | undefined {
    return this.credentials.get(id);
  }

  async connect(cred: ServerCredential): Promise<{ ok: boolean; message: string }> {
    await this.disconnect(cred.id);

    const client = new Client();
    const config: ConnectConfig = {
      host: cred.host.trim(),
      port: Number(cred.port) > 0 ? Number(cred.port) : 22,
      username: cred.username.trim(),
      readyTimeout: 30000,
      tryKeyboard: false,
      keepaliveInterval: 15000,
    };

    if (cred.privateKey) {
      config.privateKey = cred.privateKey;
      if (cred.passphrase) config.passphrase = cred.passphrase;
    } else if (cred.password) {
      config.password = cred.password;
    } else {
      return { ok: false, message: '请填写密码或私钥' };
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (ok: boolean, message: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ ok, message: translateError(message) });
      };

      const timer = setTimeout(() => {
        try {
          client.end();
        } catch {
          /* ignore */
        }
        finish(
          false,
          'Timed out while waiting for handshake',
        );
      }, 32000);

      client
        .on('ready', () => {
          this.credentials.set(cred.id, cred);
          this.connections.set(cred.id, { client, ready: true });
          this.emit('status', { id: cred.id, connected: true });
          finish(true, '连接成功');
        })
        .on('error', (err) => {
          this.connections.set(cred.id, {
            client,
            ready: false,
            lastError: err.message,
          });
          this.emit('status', {
            id: cred.id,
            connected: false,
            error: translateError(err.message),
          });
          finish(false, err.message);
        })
        .on('close', () => {
          const state = this.connections.get(cred.id);
          if (state) state.ready = false;
          this.emit('status', { id: cred.id, connected: false });
        })
        .connect(config);
    });
  }

  async disconnect(id: string): Promise<void> {
    const state = this.connections.get(id);
    if (state) {
      try {
        state.client.end();
      } catch {
        /* ignore */
      }
      this.connections.delete(id);
    }
  }

  remove(id: string): void {
    void this.disconnect(id);
    this.credentials.delete(id);
  }

  isConnected(id: string): boolean {
    return this.connections.get(id)?.ready === true;
  }

  /** 通过 SFTP 上传二进制文件到远程路径 */
  async uploadFile(id: string, remotePath: string, data: Buffer): Promise<void> {
    const { Readable } = await import('stream');
    await this.uploadStream(id, remotePath, Readable.from(data));
  }

  /** 流式上传，避免大文件占满内存 */
  async uploadStream(
    id: string,
    remotePath: string,
    readable: NodeJS.ReadableStream,
    onProgress?: (transferred: number) => void,
  ): Promise<{ size: number }> {
    const state = this.connections.get(id);
    if (!state?.ready) {
      throw new Error('服务器未连接，请先在「服务器」页建立连接');
    }

    const dir = remotePath.includes('/')
      ? remotePath.slice(0, remotePath.lastIndexOf('/'))
      : '.';
    const quotedDir = `'${dir.replace(/'/g, `'\\''`)}'`;
    await this.exec(id, `mkdir -p ${quotedDir}`);

    return new Promise((resolve, reject) => {
      state.client.sftp((err, sftp) => {
        if (err) {
          reject(new Error(translateError(err.message)));
          return;
        }

        let size = 0;
        let lastProgressAt = Date.now();
        const ws = sftp.createWriteStream(remotePath);
        let settled = false;
        const fail = (e: Error) => {
          if (settled) return;
          settled = true;
          clearInterval(idleTimer);
          reject(new Error(translateError(e.message)));
        };
        const ok = () => {
          if (settled) return;
          settled = true;
          clearInterval(idleTimer);
          resolve({ size });
        };

        // 5 分钟无数据视为卡住
        const idleTimer = setInterval(() => {
          if (Date.now() - lastProgressAt > 5 * 60 * 1000) {
            fail(new Error('上传超时：超过 5 分钟没有数据进度，请检查网络后重试'));
            try {
              (readable as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
            } catch {
              /* ignore */
            }
            try {
              ws.destroy?.();
            } catch {
              /* ignore */
            }
          }
        }, 30_000);

        readable.on('data', (chunk: Buffer | string) => {
          const n = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
          size += n;
          lastProgressAt = Date.now();
          onProgress?.(size);
        });
        readable.on('error', fail);
        ws.on('error', fail);
        ws.on('close', ok);
        readable.pipe(ws);
      });
    });
  }

  /** 流式下载远程文件到本地可写流（带进度） */
  async downloadToLocal(
    id: string,
    remotePath: string,
    localPath: string,
    onProgress?: (transferred: number) => void,
  ): Promise<{ size: number }> {
    const fs = await import('fs');
    const { pipeline } = await import('stream/promises');
    const rs = await this.downloadStream(id, remotePath);
    const ws = fs.createWriteStream(localPath);
    let size = 0;
    let lastProgressAt = Date.now();

    const idleTimer = setInterval(() => {
      if (Date.now() - lastProgressAt > 5 * 60 * 1000) {
        try {
          (rs as NodeJS.ReadableStream & { destroy?: (e?: Error) => void }).destroy?.(
            new Error('下载超时：超过 5 分钟没有数据进度'),
          );
        } catch {
          /* ignore */
        }
      }
    }, 30_000);

    try {
      rs.on('data', (chunk: Buffer | string) => {
        const n = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
        size += n;
        lastProgressAt = Date.now();
        onProgress?.(size);
      });
      await pipeline(rs as NodeJS.ReadableStream, ws);
      return { size };
    } finally {
      clearInterval(idleTimer);
    }
  }

  /** 流式下载远程文件（SFTP ReadStream） */
  async downloadStream(id: string, remotePath: string): Promise<NodeJS.ReadableStream> {
    const state = this.connections.get(id);
    if (!state?.ready) {
      throw new Error('服务器未连接，请先在「服务器」页建立连接');
    }

    return new Promise((resolve, reject) => {
      state.client.sftp((err, sftp) => {
        if (err) {
          reject(new Error(translateError(err.message)));
          return;
        }
        resolve(sftp.createReadStream(remotePath));
      });
    });
  }

  /**
   * 源机 → 本机临时文件 → 目标机。
   * 避免两台 SFTP 直连 pipe 在大文件时卡死；支持进度回调。
   */
  async transferFile(
    fromId: string,
    fromPath: string,
    toId: string,
    toPath: string,
    onProgress?: (message: string) => void,
  ): Promise<{ size: number }> {
    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
    const localPath = path.join(
      os.tmpdir(),
      `vizops-xfer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.bin`,
    );

    const formatMb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
    let lastLogged = 0;
    const report = (phase: string, n: number) => {
      if (!onProgress) return;
      if (n - lastLogged < 8 * 1024 * 1024 && n !== lastLogged) return;
      // 每约 8MB 打一次，或强制
      if (n - lastLogged >= 8 * 1024 * 1024) {
        lastLogged = n;
        onProgress(`[${phase}] 已传输 ${formatMb(n)}`);
      }
    };

    try {
      onProgress?.(`[下载] 从源机拉取到本机中转…`);
      lastLogged = 0;
      const { size: downloaded } = await this.downloadToLocal(fromId, fromPath, localPath, (n) =>
        report('下载中', n),
      );
      onProgress?.(`[下载完成] ${formatMb(downloaded)}，开始上传到目标机…`);

      lastLogged = 0;
      const rs = fs.createReadStream(localPath);
      const { size } = await this.uploadStream(toId, toPath, rs, (n) => report('上传中', n));
      onProgress?.(`[上传完成] ${formatMb(size)}`);
      return { size };
    } finally {
      await fs.promises.unlink(localPath).catch(() => undefined);
    }
  }

  async exec(id: string, command: string, timeoutMs = 120000): Promise<ExecResult> {
    const state = this.connections.get(id);
    if (!state?.ready) {
      throw new Error('服务器未连接，请先在「服务器」页建立连接');
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('命令执行超时，请稍后重试'));
      }, timeoutMs);

      state.client.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          reject(new Error(translateError(err.message)));
          return;
        }

        let stdout = '';
        let stderr = '';

        stream
          .on('close', (code: number | null) => {
            clearTimeout(timer);
            resolve({ code, stdout, stderr });
          })
          .on('data', (data: Buffer) => {
            stdout += data.toString();
          });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
      });
    });
  }

  /** 流式执行，适合长任务；通过 onData 回调推送输出 */
  async execStream(
    id: string,
    command: string,
    onData: (chunk: string, stream: 'stdout' | 'stderr') => void,
    timeoutMs = 600000,
  ): Promise<ExecResult> {
    const state = this.connections.get(id);
    if (!state?.ready) {
      throw new Error('服务器未连接，请先在「服务器」页建立连接');
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('命令执行超时，请稍后重试'));
      }, timeoutMs);

      state.client.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          reject(new Error(translateError(err.message)));
          return;
        }

        let stdout = '';
        let stderr = '';

        stream
          .on('close', (code: number | null) => {
            clearTimeout(timer);
            resolve({ code, stdout, stderr });
          })
          .on('data', (data: Buffer) => {
            const text = data.toString();
            stdout += text;
            onData(text, 'stdout');
          });

        stream.stderr.on('data', (data: Buffer) => {
          const text = data.toString();
          stderr += text;
          onData(text, 'stderr');
        });
      });
    });
  }
}

export const sshPool = new SshPool();

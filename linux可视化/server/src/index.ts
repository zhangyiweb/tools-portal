import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { serversRouter } from './routes/servers.js';
import { createApiRouter } from './routes/api.js';
import { TaskBus } from './tasks/bus.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3789;

const app = express();
const taskBus = new TaskBus();

app.use(cors());

// 二进制上传走流式处理，不能先被 json 吃掉
app.use((req, res, next) => {
  if (req.path.includes('/upload-bin') || req.path.includes('/files/upload')) return next();
  express.json({ limit: '1024mb' })(req, res, next);
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'linux-viz-ops', version: '1.0.0' });
});

app.use('/api/servers', serversRouter);
app.use('/api', createApiRouter(taskBus));

const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err);
});

const server = app.listen(PORT, () => {
  console.log(`\n  Linux Viz Ops API  →  http://localhost:${PORT}`);
  console.log(`  健康检查           →  http://localhost:${PORT}/api/health\n`);
});

server.timeout = 0;
server.headersTimeout = 0;
server.requestTimeout = 0;

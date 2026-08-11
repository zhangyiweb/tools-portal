const fs = require('fs');
const path = require('path');
const { getNginxConfPath, getNginxLogsDir, getNginxSitesDir } = require('./paths');

function winPathToNginxPath(p) {
  // nginx.conf 里反斜杠在 Windows 上偶尔会带来转义困扰，统一替换成正斜杠更稳妥
  return p.replace(/\\/g, '/');
}

function renderServerBlock(project) {
  // Windows nginx 对中文路径兼容性不稳定，这里为每个项目创建一个英文路径的 junction，nginx 使用该路径作为 root
  const sitesDir = getNginxSitesDir();
  fs.mkdirSync(sitesDir, { recursive: true });
  const linkPath = path.join(sitesDir, project.id);
  try {
    if (!fs.existsSync(linkPath)) {
      fs.symlinkSync(project.distPath, linkPath, 'junction');
    }
  } catch {
    // junction 创建失败时兜底使用原始路径（可能会因中文路径导致 nginx 报错）
  }

  const root = winPathToNginxPath(fs.existsSync(linkPath) ? linkPath : project.distPath);
  const accessLog = winPathToNginxPath(path.join(getNginxLogsDir(), `access-${project.port}.log`));
  const errorLog = winPathToNginxPath(path.join(getNginxLogsDir(), `error-${project.port}.log`));

  return `
  server {
    listen ${project.port};
    server_name localhost;

    root ${root};
    index index.html;

    access_log ${accessLog};
    error_log ${errorLog};

    # 兼容 Vue/React 等 SPA：找不到文件时回退到 index.html
    location / {
      try_files $uri $uri/ /index.html;
    }
  }`;
}

function writeNginxConf(state) {
  const enabled = (state.projects || []).filter((p) => p.enabled);

  const conf = `worker_processes  1;
pid logs/nginx.pid;
error_log logs/error.log;

events {
  worker_connections  1024;
}

http {
  include       mime.types;
  default_type  application/octet-stream;

  sendfile        on;
  keepalive_timeout  65;

  ${enabled.map(renderServerBlock).join('\n')}
}
`;

  const confPath = getNginxConfPath();
  fs.mkdirSync(path.dirname(confPath), { recursive: true });
  fs.writeFileSync(confPath, conf, 'utf-8');
}

module.exports = { writeNginxConf };


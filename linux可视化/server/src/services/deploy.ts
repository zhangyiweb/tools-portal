import { sshPool } from '../ssh/pool.js';

export type DbType = 'mysql' | 'postgres' | 'redis';

function shellQuote(s: string): string {
  if (/^[a-zA-Z0-9_./:=@+-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export async function installDatabase(
  serverId: string,
  type: DbType,
  options: {
    rootPassword?: string;
    database?: string;
    user?: string;
    password?: string;
    port?: number;
    useDocker?: boolean;
  },
  onData: (chunk: string) => void,
) {
  const useDocker = options.useDocker !== false;

  if (useDocker) {
    return installDbViaDocker(serverId, type, options, onData);
  }
  return installDbViaApt(serverId, type, options, onData);
}

async function installDbViaDocker(
  serverId: string,
  type: DbType,
  options: {
    rootPassword?: string;
    database?: string;
    user?: string;
    password?: string;
    port?: number;
  },
  onData: (chunk: string) => void,
) {
  const name = `vizops-${type}`;
  const check = await sshPool.exec(serverId, `docker ps -a --format '{{.Names}}' | grep -x '${name}' || true`);
  if (check.stdout.trim() === name) {
    onData(`[info] 容器 ${name} 已存在，尝试启动...\n`);
    const start = await sshPool.execStream(
      serverId,
      `docker start ${name}`,
      (c) => onData(c),
    );
    return start;
  }

  let cmd = '';
  if (type === 'mysql') {
    const port = options.port || 3306;
    const rootPass = options.rootPassword || 'root123456';
    const db = options.database || 'app';
    cmd = [
      'docker run -d',
      `--name ${name}`,
      '--restart unless-stopped',
      `-p ${port}:3306`,
      `-e MYSQL_ROOT_PASSWORD=${shellQuote(rootPass)}`,
      `-e MYSQL_DATABASE=${shellQuote(db)}`,
      options.user
        ? `-e MYSQL_USER=${shellQuote(options.user)} -e MYSQL_PASSWORD=${shellQuote(options.password || 'pass123456')}`
        : '',
      '-v vizops-mysql-data:/var/lib/mysql',
      'mysql:8.0',
    ]
      .filter(Boolean)
      .join(' ');
  } else if (type === 'postgres') {
    const port = options.port || 5432;
    const pass = options.rootPassword || options.password || 'postgres123';
    const db = options.database || 'app';
    const user = options.user || 'postgres';
    cmd = [
      'docker run -d',
      `--name ${name}`,
      '--restart unless-stopped',
      `-p ${port}:5432`,
      `-e POSTGRES_PASSWORD=${shellQuote(pass)}`,
      `-e POSTGRES_USER=${shellQuote(user)}`,
      `-e POSTGRES_DB=${shellQuote(db)}`,
      '-v vizops-pg-data:/var/lib/postgresql/data',
      'postgres:16',
    ].join(' ');
  } else {
    const port = options.port || 6379;
    cmd = [
      'docker run -d',
      `--name ${name}`,
      '--restart unless-stopped',
      `-p ${port}:6379`,
      '-v vizops-redis-data:/data',
      'redis:7',
      'redis-server --appendonly yes',
    ].join(' ');
  }

  onData(`[cmd] ${cmd.replace(/PASSWORD=\S+/g, 'PASSWORD=***')}\n`);
  return sshPool.execStream(serverId, cmd, (c) => onData(c));
}

async function installDbViaApt(
  serverId: string,
  type: DbType,
  options: {
    rootPassword?: string;
    database?: string;
    password?: string;
  },
  onData: (chunk: string) => void,
) {
  let script = 'set -e\nexport DEBIAN_FRONTEND=noninteractive\nsudo apt-get update -y\n';

  if (type === 'mysql') {
    const pass = options.rootPassword || 'root123456';
    script += `
echo "[1/3] 预配置 MySQL root 密码..."
sudo debconf-set-selections <<< "mysql-server mysql-server/root_password password ${pass}"
sudo debconf-set-selections <<< "mysql-server mysql-server/root_password_again password ${pass}"
echo "[2/3] 安装 mysql-server..."
sudo apt-get install -y mysql-server
echo "[3/3] 启动服务..."
sudo systemctl enable --now mysql
echo "[ok] MySQL 安装完成"
`;
  } else if (type === 'postgres') {
    script += `
echo "[1/2] 安装 PostgreSQL..."
sudo apt-get install -y postgresql postgresql-contrib
echo "[2/2] 启动服务..."
sudo systemctl enable --now postgresql
echo "[ok] PostgreSQL 安装完成"
`;
  } else {
    script += `
echo "[1/2] 安装 Redis..."
sudo apt-get install -y redis-server
echo "[2/2] 启动服务..."
sudo systemctl enable --now redis-server
echo "[ok] Redis 安装完成"
`;
  }

  return sshPool.execStream(serverId, script, (c) => onData(c));
}

export async function deployFrontend(
  serverId: string,
  options: {
    /** 站点名，用于容器名与目录，默认 frontend */
    siteName?: string;
    /** 监听端口，默认 80 */
    port?: number;
    /** dist-zip：上传的 zip；git：仓库；advanced：旧版系统 nginx */
    mode: 'dist-zip' | 'git' | 'nginx-only' | 'upload';
    gitUrl?: string;
    archivePath?: string;
    remoteDir?: string;
    serverName?: string;
    installNginx?: boolean;
    /** 前端容器使用的 Nginx 镜像，本地有则跳过拉取 */
    nginxImage?: string;
  },
  onData: (chunk: string) => void,
) {
  if (options.mode === 'dist-zip' || (options.mode === 'upload' && options.archivePath)) {
    return deployFrontendDistZip(serverId, options, onData);
  }
  return deployFrontendLegacyNginx(serverId, options, onData);
}

/** 推荐：上传 dist zip → 自动用 Nginx 容器发布（前端无需关心服务器目录） */
async function deployFrontendDistZip(
  serverId: string,
  options: {
    siteName?: string;
    port?: number;
    archivePath?: string;
    /** 本地已有的 Nginx 镜像，默认 nginx:alpine；有则跳过拉取 */
    nginxImage?: string;
  },
  onData: (chunk: string) => void,
) {
  // 站点名只保留英文数字；中文名会落到默认 frontend，避免容器名非法
  const rawName = (options.siteName || 'frontend').trim();
  const site = rawName.replace(/[^a-zA-Z0-9_-]/g, '') || 'frontend';
  const port = options.port || 8080;
  const archive = options.archivePath || `/tmp/vizops-${site}.zip`;
  const base = `/opt/vizops/sites/${site}`;
  const htmlDir = `${base}/html`;
  const confDir = `${base}/conf`;
  const container = site;
  const nginxImage = (options.nginxImage || '').trim();
  if (!nginxImage || !/^[a-zA-Z0-9_./:@+-]+$/.test(nginxImage)) {
    throw new Error('请选择服务器上已有的 Nginx 镜像（可先到 Docker → 拉取/上传镜像）');
  }

  const script = `
set -e
SITE=${shellQuote(site)}
PORT=${port}
ARCHIVE=${shellQuote(archive)}
BASE=${shellQuote(base)}
HTML=${shellQuote(htmlDir)}
CONF=${shellQuote(confDir)}
NAME=${shellQuote(container)}
NGINX_IMG=${shellQuote(nginxImage)}

echo "[1/5] 准备站点目录（无需手动填写，工具自动管理）..."
sudo mkdir -p "$HTML" "$CONF"
sudo rm -rf "$HTML"/* "$HTML"/.[!.]* 2>/dev/null || true

if [ ! -f "$ARCHIVE" ]; then
  echo "[错误] 未找到上传包: $ARCHIVE"
  exit 1
fi

echo "[2/5] 解压构建产物（不依赖 yum，避免 CentOS 源不可用）..."
TMP=$(mktemp -d)
extract_zip() {
  local zipfile="$1"
  local dest="$2"
  if command -v unzip >/dev/null 2>&1; then
    sudo unzip -o "$zipfile" -d "$dest" >/dev/null
    return 0
  fi
  if command -v python3 >/dev/null 2>&1; then
    echo "[解压] 使用 python3..."
    sudo python3 -c "import zipfile; zipfile.ZipFile(r'''$zipfile''').extractall(r'''$dest''')"
    return 0
  fi
  if command -v python >/dev/null 2>&1; then
    echo "[解压] 使用 python..."
    sudo python -c "import zipfile; zipfile.ZipFile(r'''$zipfile''').extractall(r'''$dest''')"
    return 0
  fi
  echo "[解压] 使用临时 alpine 容器解压..."
  local Dbin
  if docker info >/dev/null 2>&1; then Dbin=docker; else Dbin="sudo docker"; fi
  $Dbin run --rm -v "$zipfile:/in.zip:ro" -v "$dest:/out" alpine:3.19 \\
    sh -c "apk add --no-cache unzip >/dev/null && unzip -o /in.zip -d /out" >/dev/null
}
extract_zip "$ARCHIVE" "$TMP"
# 兼容：zip 根目录就是 dist 内容 / 包含 dist 目录 / 单层文件夹
if [ -f "$TMP/index.html" ]; then
  SRC="$TMP"
elif [ -f "$TMP/dist/index.html" ]; then
  SRC="$TMP/dist"
elif [ -f "$TMP/build/index.html" ]; then
  SRC="$TMP/build"
else
  COUNT=$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | wc -l)
  if [ "$COUNT" -eq 1 ] && [ -f "$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -1)/index.html" ]; then
    SRC=$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -1)
  else
    SRC="$TMP"
  fi
fi
echo "[复制] 发布文件到 $HTML"
sudo mkdir -p "$HTML"
sudo rm -rf "$HTML"/* "$HTML"/.[!.]* 2>/dev/null || true
if command -v rsync >/dev/null 2>&1; then
  sudo rsync -a --delete "$SRC"/ "$HTML"/
else
  sudo cp -a "$SRC"/. "$HTML"/
fi
sudo rm -rf "$TMP"

if [ ! -f "$HTML/index.html" ]; then
  echo "[警告] 未检测到 index.html，请确认压缩包是前端 build/dist 产物。"
fi

echo "[3/5] 写入 Nginx 配置（支持前端路由）..."
sudo tee "$CONF/default.conf" > /dev/null <<'NGX'
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

echo "[4/5] 准备镜像并启动容器..."
docker_bin() {
  if docker info >/dev/null 2>&1; then echo docker; else echo "sudo docker"; fi
}
D=$(docker_bin)
$D rm -f "$NAME" 2>/dev/null || true

ensure_nginx() {
  if $D image inspect "$NGINX_IMG" >/dev/null 2>&1; then
    echo "[镜像] 使用本地镜像 $NGINX_IMG，直接启动容器"
    return 0
  fi
  echo "[错误] 本地没有镜像 $NGINX_IMG。请先到 Docker → 拉取/上传镜像 准备好后再部署。"
  return 1
}
ensure_nginx

$D run -d \\
  --name "$NAME" \\
  --restart unless-stopped \\
  -p "$PORT":80 \\
  -v "$HTML":/usr/share/nginx/html \\
  -v "$CONF/default.conf":/etc/nginx/conf.d/default.conf \\
  "$NGINX_IMG"

echo "[5/5] 清理临时上传包..."
rm -f "$ARCHIVE" 2>/dev/null || true

IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo ""
echo "[完成] 前端已发布"
echo "  容器名: $NAME"
echo "  访问地址: http://\${IP}:$PORT  或  http://服务器IP:$PORT"
echo "  文件目录: $HTML（由工具自动管理，无需记忆）"
`;

  return sshPool.execStream(serverId, script, (c) => onData(c));
}

/**
 * 不重新上传：用已有 /opt/vizops/sites/<site>/html 重新创建 Nginx 容器并挂载。
 * 适合容器被删除后，代码还在服务器上的场景。
 */
export async function startExistingFrontendSite(
  serverId: string,
  options: {
    siteName?: string;
    port?: number;
    nginxImage?: string;
  },
  onData: (chunk: string) => void,
) {
  const rawName = (options.siteName || 'frontend').trim();
  const site = rawName.replace(/[^a-zA-Z0-9_-]/g, '') || 'frontend';
  const port = options.port || 8080;
  const base = `/opt/vizops/sites/${site}`;
  const htmlDir = `${base}/html`;
  const confDir = `${base}/conf`;
  const container = site;
  const nginxImage = (options.nginxImage || '').trim();
  if (!nginxImage || !/^[a-zA-Z0-9_./:@+-]+$/.test(nginxImage)) {
    throw new Error('请选择服务器上已有的 Nginx 镜像');
  }

  const script = `
set -e
SITE=${shellQuote(site)}
PORT=${port}
BASE=${shellQuote(base)}
HTML=${shellQuote(htmlDir)}
CONF=${shellQuote(confDir)}
NAME=${shellQuote(container)}
NGINX_IMG=${shellQuote(nginxImage)}

echo "[1/3] 检查已有站点文件..."
if [ ! -d "$HTML" ]; then
  echo "[错误] 找不到目录 $HTML"
  echo "请先用「应用部署」上传 zip 发布一次，或确认站点名称是否正确。"
  exit 1
fi
if [ ! -f "$HTML/index.html" ]; then
  echo "[警告] $HTML 下没有 index.html，容器仍会启动，但网站可能空白。"
fi

# 没有 conf 就补一份默认 SPA 配置
if [ ! -f "$CONF/default.conf" ]; then
  echo "[配置] 未找到 Nginx 配置，正在写入默认 SPA 配置..."
  sudo mkdir -p "$CONF"
  sudo tee "$CONF/default.conf" > /dev/null <<'NGX'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
}
NGX
fi

echo "[2/3] 检查镜像 $NGINX_IMG ..."
docker_bin() {
  if docker info >/dev/null 2>&1; then echo docker; else echo "sudo docker"; fi
}
D=$(docker_bin)
if ! $D image inspect "$NGINX_IMG" >/dev/null 2>&1; then
  echo "[错误] 本地没有镜像 $NGINX_IMG，请先到 Docker 页准备镜像。"
  exit 1
fi

echo "[3/3] 创建并启动容器（绑定已有代码）..."
$D rm -f "$NAME" 2>/dev/null || true
$D run -d \\
  --name "$NAME" \\
  --restart unless-stopped \\
  -p "$PORT":80 \\
  -v "$HTML":/usr/share/nginx/html \\
  -v "$CONF/default.conf":/etc/nginx/conf.d/default.conf \\
  "$NGINX_IMG"

IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo ""
echo "[完成] 已用已有文件重新挂载启动"
echo "  容器名: $NAME"
echo "  代码目录: $HTML"
echo "  访问: http://\${IP}:$PORT"
`;

  return sshPool.execStream(serverId, script, (c) => onData(c));
}

async function deployFrontendLegacyNginx(
  serverId: string,
  options: {
    remoteDir?: string;
    serverName?: string;
    port?: number;
    mode: string;
    gitUrl?: string;
    archivePath?: string;
    installNginx?: boolean;
  },
  onData: (chunk: string) => void,
) {
  const remoteDir = options.remoteDir || '/var/www/app';
  const port = options.port || 80;
  const serverName = options.serverName || '_';
  const siteName = 'vizops-frontend';

  let script = `set -e
export DEBIAN_FRONTEND=noninteractive
REMOTE_DIR=${shellQuote(remoteDir)}
SITE=${shellQuote(siteName)}
PORT=${port}
SERVER_NAME=${shellQuote(serverName)}

echo "[1] 准备目录 $REMOTE_DIR"
sudo mkdir -p "$REMOTE_DIR"
`;

  if (options.installNginx !== false) {
    script += `
if ! command -v nginx >/dev/null 2>&1; then
  echo "[2] 安装 Nginx..."
  sudo apt-get update -y
  sudo apt-get install -y nginx
fi
`;
  }

  if (options.mode === 'git' && options.gitUrl) {
    script += `
echo "[3] 从 Git 拉取前端..."
TMP=$(mktemp -d)
git clone --depth 1 ${shellQuote(options.gitUrl)} "$TMP/repo"
if [ -f "$TMP/repo/package.json" ]; then
  echo "[3.1] 检测到 package.json，尝试构建..."
  cd "$TMP/repo"
  if command -v npm >/dev/null 2>&1; then
    npm ci || npm install
    npm run build || true
  fi
  if [ -d dist ]; then SRC=dist
  elif [ -d build ]; then SRC=build
  else SRC=.
  fi
  sudo rsync -a --delete "$TMP/repo/$SRC/" "$REMOTE_DIR/"
else
  sudo rsync -a --delete "$TMP/repo/" "$REMOTE_DIR/"
fi
rm -rf "$TMP"
`;
  } else if (options.mode === 'upload' && options.archivePath) {
    script += `
echo "[3] 解压上传包..."
sudo tar -xzf ${shellQuote(options.archivePath)} -C "$REMOTE_DIR" --strip-components=0
`;
  }

  script += `
echo "[4] 写入 Nginx 配置..."
sudo tee /etc/nginx/sites-available/$SITE > /dev/null <<EOF
server {
    listen $PORT;
    server_name $SERVER_NAME;
    root $REMOTE_DIR;
    index index.html;

    location / {
        try_files \\$uri \\$uri/ /index.html;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public";
    }
}
EOF
sudo ln -sfn /etc/nginx/sites-available/$SITE /etc/nginx/sites-enabled/$SITE
sudo rm -f /etc/nginx/sites-enabled/default
echo "[5] 测试并重载 Nginx..."
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
echo "[完成] 前端已部署到 $REMOTE_DIR ，端口 $PORT"
`;

  return sshPool.execStream(serverId, script, (c) => onData(c));
}

export async function deployBackend(
  serverId: string,
  options: {
    mode: 'docker' | 'pm2' | 'git-pm2';
    /** Docker 镜像或 git 仓库 */
    image?: string;
    gitUrl?: string;
    name?: string;
    port?: number;
    env?: Record<string, string>;
    /** 容器端口映射 host:container */
    containerPort?: number;
    workDir?: string;
    startCommand?: string;
  },
  onData: (chunk: string) => void,
) {
  const name = options.name || 'vizops-backend';
  const port = options.port || 3000;

  if (options.mode === 'docker') {
    if (!options.image) throw new Error('请填写 Docker 镜像名称');
    const cport = options.containerPort || port;
    const envFlags = Object.entries(options.env || {})
      .map(([k, v]) => `-e ${shellQuote(`${k}=${v}`)}`)
      .join(' ');
    const script = `
set -e
NAME=${shellQuote(name)}
echo "[1] 停止旧容器（如有）..."
docker rm -f "$NAME" 2>/dev/null || true
echo "[2] 拉取镜像 ${options.image}..."
docker pull ${shellQuote(options.image)}
echo "[3] 启动容器..."
docker run -d --name "$NAME" --restart unless-stopped -p ${port}:${cport} ${envFlags} ${shellQuote(options.image)}
echo "[ok] 后端容器已启动: $NAME -> 宿主机端口 ${port}"
docker ps --filter name=^/$NAME$
`;
    return sshPool.execStream(serverId, script, (c) => onData(c));
  }

  // pm2 / git-pm2
  const workDir = options.workDir || `/opt/${name}`;
  const startCmd = options.startCommand || 'npm start';
  let script = `
set -e
export DEBIAN_FRONTEND=noninteractive
NAME=${shellQuote(name)}
WORKDIR=${shellQuote(workDir)}
echo "[1] 确保 Node / PM2..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi
sudo mkdir -p "$WORKDIR"
`;

  if (options.mode === 'git-pm2' && options.gitUrl) {
    script += `
echo "[2] 克隆仓库..."
TMP=$(mktemp -d)
git clone --depth 1 ${shellQuote(options.gitUrl)} "$TMP/repo"
sudo rsync -a --delete "$TMP/repo/" "$WORKDIR/"
rm -rf "$TMP"
`;
  }

  script += `
echo "[3] 安装依赖并启动..."
cd "$WORKDIR"
if [ -f package.json ]; then
  npm ci || npm install
fi
pm2 delete "$NAME" 2>/dev/null || true
PORT=${port} pm2 start ${shellQuote(startCmd)} --name "$NAME"
pm2 save
sudo env PATH=$PATH pm2 startup systemd -u "$USER" --hp "$HOME" 2>/dev/null || true
echo "[ok] 后端已通过 PM2 启动: $NAME"
pm2 status
`;

  return sshPool.execStream(serverId, script, (c) => onData(c));
}

export async function uploadBase64File(
  serverId: string,
  remotePath: string,
  base64Content: string,
) {
  const dir = remotePath.includes('/')
    ? remotePath.slice(0, remotePath.lastIndexOf('/'))
    : '.';
  // 分段写入避免命令行过长：用 python/base64
  const script = `
set -e
mkdir -p ${shellQuote(dir)}
python3 - <<'PY'
import base64, pathlib
data = """${base64Content}"""
path = pathlib.Path(${JSON.stringify(remotePath)})
path.write_bytes(base64.b64decode(data))
print("written", path, "size", path.stat().st_size)
PY
`;
  const result = await sshPool.exec(serverId, script, 300000);
  if (result.code !== 0) {
    throw new Error(result.stderr || '上传失败');
  }
  return { ok: true, path: remotePath };
}

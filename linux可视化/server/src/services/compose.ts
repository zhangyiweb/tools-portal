import { sshPool } from '../ssh/pool.js';

function shellQuote(s: string): string {
  if (/^[a-zA-Z0-9_./:=@+-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function yamlEscape(s: string): string {
  if (/^[a-zA-Z0-9_./:@+-]+$/.test(s)) return s;
  return JSON.stringify(s);
}

export type ComposeDeployMode = 'frontend' | 'backend' | 'both';

export type DeployComposeStackOptions = {
  project: string;
  /** 默认 both；可只部署前端或只部署后端 */
  mode?: ComposeDeployMode;
  frontend?: {
    port: number;
    nginxImage: string;
    archivePath?: string;
  };
  backend?: {
    image: string;
    port: number;
    containerPort: number;
    env?: Record<string, string>;
    proxyPath?: string;
  };
};

function buildStackComposeYaml(opts: {
  withWeb: boolean;
  withApi: boolean;
  htmlDir: string;
  confDir: string;
  nginxImage: string;
  fePort: number;
  beImage: string;
  beHostPort: number;
  beContainerPort: number;
  env: Record<string, string>;
}): string {
  const lines: string[] = ['services:'];

  if (opts.withWeb) {
    lines.push('  web:');
    lines.push(`    image: ${yamlEscape(opts.nginxImage)}`);
    lines.push('    restart: unless-stopped');
    lines.push('    ports:');
    lines.push(`      - "${opts.fePort}:80"`);
    lines.push('    volumes:');
    lines.push(`      - ${yamlEscape(`${opts.htmlDir}:/usr/share/nginx/html`)}`);
    lines.push(
      `      - ${yamlEscape(`${opts.confDir}/default.conf:/etc/nginx/conf.d/default.conf:ro`)}`,
    );
    if (opts.withApi) {
      lines.push('    depends_on:');
      lines.push('      - api');
    }
  }

  if (opts.withApi) {
    lines.push('  api:');
    lines.push(`    image: ${yamlEscape(opts.beImage)}`);
    lines.push('    restart: unless-stopped');
    lines.push('    ports:');
    lines.push(`      - "${opts.beHostPort}:${opts.beContainerPort}"`);
    lines.push('    expose:');
    lines.push(`      - "${opts.beContainerPort}"`);
    const envKeys = Object.keys(opts.env);
    if (envKeys.length) {
      lines.push('    environment:');
      for (const k of envKeys) {
        lines.push(`      ${yamlEscape(k)}: ${yamlEscape(opts.env[k])}`);
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

function buildNginxConf(opts: {
  withApi: boolean;
  proxyPath: string;
  beContainerPort: number;
}): string {
  const proxy = opts.withApi
    ? `
    location ${opts.proxyPath.replace(/\/$/, '')}/ {
        proxy_pass http://api:${opts.beContainerPort}/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
`
    : '';

  return `server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
${proxy}
    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 7d;
        try_files $uri =404;
    }
}
`;
}

/** Compose 部署：可只前端、只后端，或前后端一起 */
export async function deployComposeStack(
  serverId: string,
  options: DeployComposeStackOptions,
  onData: (chunk: string) => void,
) {
  const project = (options.project || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!project) throw new Error('请填写项目名称');

  const mode: ComposeDeployMode =
    options.mode === 'frontend' || options.mode === 'backend' || options.mode === 'both'
      ? options.mode
      : 'both';
  const withWeb = mode === 'frontend' || mode === 'both';
  const withApi = mode === 'backend' || mode === 'both';

  const nginxImage = (options.frontend?.nginxImage || '').trim();
  const beImage = (options.backend?.image || '').trim();

  if (withWeb && (!nginxImage || !/^[a-zA-Z0-9_./:@+-]+$/.test(nginxImage))) {
    throw new Error('请选择服务器上已有的 Nginx 镜像（到 Docker → 拉取/上传）');
  }
  if (withApi && !beImage) {
    throw new Error('请填写后端 Docker 镜像');
  }

  const fePort = Number(options.frontend?.port) > 0 ? Number(options.frontend!.port) : 8080;
  const beHostPort = Number(options.backend?.port) > 0 ? Number(options.backend!.port) : 3000;
  const beContainerPort =
    Number(options.backend?.containerPort) > 0
      ? Number(options.backend!.containerPort)
      : beHostPort;
  const proxyPath = (options.backend?.proxyPath || '/api').trim() || '/api';
  const archive = (options.frontend?.archivePath || '').trim();
  const env = options.backend?.env || {};

  const base = `/opt/vizops/sites/${project}`;
  const htmlDir = `${base}/html`;
  const confDir = `${base}/conf`;
  const composeDir = `/opt/vizops/compose/${project}`;

  const yaml = buildStackComposeYaml({
    withWeb,
    withApi,
    htmlDir,
    confDir,
    nginxImage,
    fePort,
    beImage,
    beHostPort,
    beContainerPort,
    env,
  });
  const yamlB64 = Buffer.from(yaml, 'utf8').toString('base64');
  const ngxB64 = Buffer.from(
    buildNginxConf({ withApi: withWeb && withApi, proxyPath, beContainerPort }),
    'utf8',
  ).toString('base64');

  const script = `
set -e
PROJECT=${shellQuote(project)}
BASE=${shellQuote(base)}
HTML=${shellQuote(htmlDir)}
CONF=${shellQuote(confDir)}
COMPOSE_DIR=${shellQuote(composeDir)}
NGINX_IMG=${shellQuote(nginxImage || '')}
ARCHIVE=${shellQuote(archive || '')}
FE_PORT=${fePort}
BE_PORT=${beHostPort}
WITH_WEB=${withWeb ? '1' : '0'}
WITH_API=${withApi ? '1' : '0'}

echo "[部署模式] $([ "$WITH_WEB" = 1 ] && [ "$WITH_API" = 1 ] && echo 前端+后端 || ([ "$WITH_WEB" = 1 ] && echo 仅前端 || echo 仅后端))"

if [ "$WITH_WEB" = 1 ]; then
  echo "[检查] Nginx 镜像..."
  if ! docker image inspect "$NGINX_IMG" >/dev/null 2>&1 && ! sudo docker image inspect "$NGINX_IMG" >/dev/null 2>&1; then
    echo "[错误] 本地没有镜像 $NGINX_IMG ，请先到「Docker → 拉取/上传镜像」。"
    exit 1
  fi
  echo "[准备] 前端站点目录 $HTML ..."
  sudo mkdir -p "$HTML" "$CONF"

  if [ -n "$ARCHIVE" ]; then
    if [ ! -f "$ARCHIVE" ]; then
      echo "[错误] 未找到上传包: $ARCHIVE"
      exit 1
    fi
    echo "[解压] 前端构建包..."
    TMP=$(mktemp -d)
    extract_zip() {
      local zipfile="$1"
      local dest="$2"
      if command -v unzip >/dev/null 2>&1; then
        sudo unzip -o "$zipfile" -d "$dest" >/dev/null; return 0
      fi
      if command -v python3 >/dev/null 2>&1; then
        sudo python3 -c "import zipfile; zipfile.ZipFile(r'''$zipfile''').extractall(r'''$dest''')"; return 0
      fi
      if command -v python >/dev/null 2>&1; then
        sudo python -c "import zipfile; zipfile.ZipFile(r'''$zipfile''').extractall(r'''$dest''')"; return 0
      fi
      local Dbin
      if docker info >/dev/null 2>&1; then Dbin=docker; else Dbin="sudo docker"; fi
      $Dbin run --rm -v "$zipfile:/in.zip:ro" -v "$dest:/out" alpine:3.19 \\
        sh -c "apk add --no-cache unzip >/dev/null && unzip -o /in.zip -d /out" >/dev/null
    }
    extract_zip "$ARCHIVE" "$TMP"
    if [ -f "$TMP/index.html" ]; then SRC="$TMP"
    elif [ -f "$TMP/dist/index.html" ]; then SRC="$TMP/dist"
    elif [ -f "$TMP/build/index.html" ]; then SRC="$TMP/build"
    else
      COUNT=$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | wc -l)
      if [ "$COUNT" -eq 1 ] && [ -f "$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -1)/index.html" ]; then
        SRC=$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -1)
      else
        SRC="$TMP"
      fi
    fi
    sudo rm -rf "$HTML"/* "$HTML"/.[!.]* 2>/dev/null || true
    if command -v rsync >/dev/null 2>&1; then sudo rsync -a --delete "$SRC"/ "$HTML"/
    else sudo cp -a "$SRC"/. "$HTML"/; fi
    sudo rm -rf "$TMP"
    if [ ! -f "$HTML/index.html" ]; then
      echo "[警告] 未检测到 index.html，请确认压缩包是前端 build/dist 产物。"
    fi
  else
    echo "[提示] 未上传 zip，使用已有站点文件 $HTML"
    if [ ! -f "$HTML/index.html" ]; then
      echo "[警告] $HTML 下没有 index.html，网站可能空白。"
    fi
  fi

  echo "[配置] 写入 Nginx..."
  echo ${shellQuote(ngxB64)} | base64 -d | sudo tee "$CONF/default.conf" > /dev/null
fi

echo "[Compose] 写入配置并启动..."
sudo mkdir -p "$COMPOSE_DIR"
echo ${shellQuote(yamlB64)} | base64 -d | sudo tee "$COMPOSE_DIR/docker-compose.yml" > /dev/null
sudo cat "$COMPOSE_DIR/docker-compose.yml"
cd "$COMPOSE_DIR"
docker rm -f "$PROJECT" 2>/dev/null || true
if docker compose version >/dev/null 2>&1; then
  sudo docker compose -p "$PROJECT" up -d --remove-orphans
elif command -v docker-compose >/dev/null 2>&1; then
  sudo docker-compose -p "$PROJECT" up -d --remove-orphans
else
  echo "[错误] 未找到 docker compose，请先安装 Docker（含 compose 插件）。"
  exit 1
fi

echo ""
echo "[完成] 部署成功"
[ "$WITH_WEB" = 1 ] && echo "  前端: http://<服务器IP>:$FE_PORT"
[ "$WITH_API" = 1 ] && echo "  后端: http://<服务器IP>:$BE_PORT"
[ "$WITH_WEB" = 1 ] && [ "$WITH_API" = 1 ] && echo "  前端反代 API: http://<服务器IP>:$FE_PORT${proxyPath.replace(/\/$/, '')}/"
[ "$WITH_WEB" = 1 ] && echo "  站点文件: $HTML"
echo "  Compose: $COMPOSE_DIR"
sudo docker compose -p "$PROJECT" ps 2>/dev/null || sudo docker-compose -p "$PROJECT" ps 2>/dev/null || true
`;

  return sshPool.execStream(serverId, script, (c) => onData(c));
}

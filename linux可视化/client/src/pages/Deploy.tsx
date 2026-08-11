import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, translateError, type DockerImage } from '../api';
import { useApp } from '../context';
import { Shell, NeedServer, TaskLog, useTaskRunner } from '../components/Shell';
import { toast } from '../toast';

type FeMode = 'upload' | 'existing';

type SiteInfo = {
  name: string;
  path: string;
  htmlPath: string;
  confPath: string;
  hasHtml: boolean;
  hasIndex: boolean;
};

export function DeployPage() {
  const { activeId, activeServer } = useApp();
  const [side, setSide] = useState<'frontend' | 'backend' | 'compose'>('frontend');
  const feTask = useTaskRunner();
  const beTask = useTaskRunner();
  const composeTask = useTaskRunner();
  const [uploading, setUploading] = useState(false);
  const [uploadHint, setUploadHint] = useState('');
  const [feError, setFeError] = useState<string | null>(null);
  const [composeHint, setComposeHint] = useState('');
  const [composeError, setComposeError] = useState<string | null>(null);
  const [localImages, setLocalImages] = useState<DockerImage[]>([]);
  const [sites, setSites] = useState<SiteInfo[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);

  const [fe, setFe] = useState({
    mode: 'upload' as FeMode,
    siteName: 'frontend',
    port: '8080',
    file: null as File | null,
    nginxImage: '',
  });

  const [be, setBe] = useState({
    mode: 'docker' as 'docker' | 'git-pm2',
    image: '',
    gitUrl: '',
    name: 'vizops-backend',
    port: '3000',
    containerPort: '3000',
    startCommand: 'npm start',
    workDir: '/opt/vizops-backend',
    envText: '',
  });

  const [compose, setCompose] = useState({
    mode: 'frontend' as 'frontend' | 'backend' | 'both',
    project: 'myapp',
    feMode: 'upload' as FeMode,
    fePort: '8080',
    file: null as File | null,
    nginxImage: '',
    beImage: '',
    bePort: '3000',
    beContainerPort: '3000',
    beEnv: '',
  });

  const refreshSites = useCallback(async () => {
    if (!activeId) {
      setSites([]);
      return;
    }
    setSitesLoading(true);
    try {
      const r = await api.listSites(activeId);
      setSites(r.sites);
      if (r.sites.length && fe.mode === 'existing' && !fe.siteName.trim()) {
        setFe((prev) => ({ ...prev, siteName: r.sites[0].name }));
      }
    } catch {
      setSites([]);
    } finally {
      setSitesLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    if (!activeId) {
      setLocalImages([]);
      setSites([]);
      return;
    }
    void refreshSites();
    void api
      .images(activeId)
      .then((r) => {
        setLocalImages(r.images);
        const nginxOnes = r.images.filter(
          (img) =>
            /nginx|openresty/i.test(img.repository) &&
            img.tag &&
            img.tag !== '<none>' &&
            img.repository !== '<none>',
        );
        if (nginxOnes.length) {
          const preferred =
            nginxOnes.find((i) => `${i.repository}:${i.tag}` === fe.nginxImage) ||
            nginxOnes.find((i) => i.tag === 'alpine') ||
            nginxOnes[0];
          const ref = `${preferred.repository}:${preferred.tag}`;
          setFe((prev) =>
            prev.nginxImage && nginxOnes.some((i) => `${i.repository}:${i.tag}` === prev.nginxImage)
              ? prev
              : { ...prev, nginxImage: ref },
          );
          setCompose((prev) =>
            prev.nginxImage && nginxOnes.some((i) => `${i.repository}:${i.tag}` === prev.nginxImage)
              ? prev
              : { ...prev, nginxImage: ref },
          );
        } else {
          setFe((prev) => ({ ...prev, nginxImage: '' }));
          setCompose((prev) => ({ ...prev, nginxImage: '' }));
        }
      })
      .catch(() => setLocalImages([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const nginxOptions = useMemo(() => {
    const opts = localImages
      .filter(
        (img) =>
          /nginx|openresty/i.test(img.repository) &&
          img.repository &&
          img.repository !== '<none>' &&
          img.tag &&
          img.tag !== '<none>',
      )
      .map((img) => `${img.repository}:${img.tag}`);
    return Array.from(new Set(opts));
  }, [localImages]);

  const feSite = fe.siteName.trim().replace(/[^a-zA-Z0-9_-]/g, '') || 'frontend';
  const fePort = fe.port.trim() || '8080';
  const host = activeServer?.host || '服务器IP';
  const nginxImg = fe.nginxImage.trim();
  const sitePath = `/opt/vizops/sites/${feSite}`;
  const htmlPath = `${sitePath}/html`;
  const selectedSite = sites.find((s) => s.name === feSite);

  const frontendManualCmd = useMemo(() => {
    const name = feSite;
    const dir = sitePath;
    const img = nginxImg || '<请先选择本地 Nginx 镜像>';
    if (fe.mode === 'existing') {
      return `# ===== 用已有站点文件重新挂载容器 =====
# 站点目录: ${dir}/html
docker image inspect ${img} >/dev/null 2>&1 || exit 1
docker rm -f ${name} 2>/dev/null || true
docker run -d --name ${name} --restart unless-stopped \\
  -p ${fePort}:80 \\
  -v ${dir}/html:/usr/share/nginx/html \\
  -v ${dir}/conf/default.conf:/etc/nginx/conf.d/default.conf \\
  ${img}

# 访问: http://${host}:${fePort}
`;
    }
    return `# ===== 上传 zip 部署参考 =====
# 1) 本地 npm run build，打成 dist.zip
# 2) 上传后工具解压到 ${dir}/html
# 3) 启动容器名 = 站点名「${name}」
docker rm -f ${name} 2>/dev/null || true
docker run -d --name ${name} --restart unless-stopped \\
  -p ${fePort}:80 \\
  -v ${dir}/html:/usr/share/nginx/html \\
  -v ${dir}/conf/default.conf:/etc/nginx/conf.d/default.conf \\
  ${img}

# 访问: http://${host}:${fePort}
`;
  }, [fe.mode, feSite, fePort, host, nginxImg, sitePath]);

  const backendManualCmd = useMemo(() => {
    if (be.mode === 'docker') {
      return `# ===== 后端手动部署参考（Docker）=====
docker pull ${be.image || '<镜像名>'}
docker rm -f ${be.name} 2>/dev/null || true
docker run -d --name ${be.name} --restart unless-stopped \\
  -p ${be.port}:${be.containerPort} \\
  ${be.envText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `-e ${l}`)
    .join(' \\\n  ')}${be.envText.trim() ? ' \\\n  ' : ''}${be.image || '<镜像名>'}

# 访问: http://${host}:${be.port}
`;
    }
    return `# ===== 后端手动部署参考（Git + PM2）=====
sudo mkdir -p ${be.workDir}
git clone --depth 1 ${be.gitUrl || '<仓库地址>'} /tmp/app-src
sudo rsync -a --delete /tmp/app-src/ ${be.workDir}/
cd ${be.workDir}
npm ci || npm install
pm2 delete ${be.name} 2>/dev/null || true
PORT=${be.port} pm2 start ${be.startCommand} --name ${be.name}
pm2 save

# 访问: http://${host}:${be.port}
`;
  }, [be, host]);

  const deployFrontend = async () => {
    if (!activeId || !fe.file || !nginxImg) return;
    const remotePath = `/tmp/vizops-${feSite}.zip`;
    setUploading(true);
    setUploadHint('正在上传构建包到服务器…');
    setFeError(null);
    feTask.reset();
    try {
      await api.uploadBin(activeId, remotePath, fe.file);
      setUploadHint('上传完成，开始部署…');
      setUploading(false);
      await feTask.run(
        () =>
          api.startTask(activeId, 'deploy-frontend', {
            mode: 'dist-zip',
            siteName: feSite,
            port: Number(fePort) || 8080,
            archivePath: remotePath,
            nginxImage: nginxImg,
          }),
        api.streamTask,
      );
      setUploadHint('');
      await refreshSites();
    } catch (e) {
      setUploading(false);
      setUploadHint('');
      const msg = translateError((e as Error).message);
      setFeError(msg);
      toast.error(msg);
    }
  };

  const startExistingSite = async () => {
    if (!activeId || !nginxImg || !feSite) return;
    setFeError(null);
    setUploadHint('');
    await feTask.run(
      () =>
        api.startTask(activeId, 'start-frontend-site', {
          siteName: feSite,
          port: Number(fePort) || 8080,
          nginxImage: nginxImg,
        }),
      api.streamTask,
    );
  };

  const deployBackend = async () => {
    if (!activeId) return;
    const env: Record<string, string> = {};
    for (const line of be.envText.split('\n')) {
      const i = line.indexOf('=');
      if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    await beTask.run(
      () =>
        api.startTask(activeId, 'deploy-backend', {
          mode: be.mode,
          image: be.image || undefined,
          gitUrl: be.gitUrl || undefined,
          name: be.name,
          port: Number(be.port),
          containerPort: Number(be.containerPort),
          startCommand: be.startCommand,
          workDir: be.workDir,
          env,
        }),
      api.streamTask,
    );
  };

  const deployComposeStack = async () => {
    if (!activeId) return;
    const project = compose.project.trim().replace(/[^a-zA-Z0-9_-]/g, '') || 'myapp';
    const needFe = compose.mode === 'frontend' || compose.mode === 'both';
    const needBe = compose.mode === 'backend' || compose.mode === 'both';
    const nginxImg = compose.nginxImage.trim();

    if (needFe && !nginxImg) {
      setComposeError('请选择本地已有的 Nginx 镜像');
      toast.warn('请选择本地已有的 Nginx 镜像');
      return;
    }
    if (needBe && !compose.beImage.trim()) {
      setComposeError('请填写后端 Docker 镜像');
      toast.warn('请填写后端 Docker 镜像');
      return;
    }
    if (needFe && compose.feMode === 'upload' && !compose.file) {
      setComposeError('请上传前端 dist.zip，或改用「已有站点文件」');
      toast.warn('请上传前端 dist.zip，或改用「已有站点文件」');
      return;
    }

    setComposeError(null);
    setComposeHint('');
    composeTask.reset();

    const env: Record<string, string> = {};
    for (const line of compose.beEnv.split('\n')) {
      const i = line.indexOf('=');
      if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }

    let archivePath: string | undefined;
    try {
      if (needFe && compose.feMode === 'upload' && compose.file) {
        setUploading(true);
        setComposeHint('正在上传前端构建包…');
        archivePath = `/tmp/vizops-compose-${project}.zip`;
        await api.uploadBin(activeId, archivePath, compose.file);
        setComposeHint('上传完成，开始部署…');
        setUploading(false);
      } else if (needFe) {
        setComposeHint('使用已有站点文件，开始部署…');
      } else {
        setComposeHint('开始部署后端…');
      }

      await composeTask.run(
        () =>
          api.startTask(activeId, 'deploy-compose', {
            project,
            mode: compose.mode,
            frontend: needFe
              ? {
                  port: Number(compose.fePort) || 8080,
                  nginxImage: nginxImg,
                  archivePath,
                }
              : undefined,
            backend: needBe
              ? {
                  image: compose.beImage.trim(),
                  port: Number(compose.bePort) || 3000,
                  containerPort: Number(compose.beContainerPort) || 3000,
                  env,
                  proxyPath: '/api',
                }
              : undefined,
          }),
        api.streamTask,
      );
      setComposeHint('');
      await refreshSites();
    } catch (e) {
      setUploading(false);
      setComposeHint('');
      const msg = translateError((e as Error).message);
      setComposeError(msg);
      toast.error(msg);
    }
  };

  const switchFeMode = (mode: FeMode) => {
    setFe((prev) => {
      const next = { ...prev, mode };
      // 切到已有站点时：仅在未填写名称时预填列表第一项，不覆盖用户手动输入
      if (mode === 'existing' && !prev.siteName.trim() && sites.length) {
        next.siteName = sites[0].name;
      }
      return next;
    });
    setFeError(null);
  };

  return (
    <Shell
      title="应用部署"
      subtitle="左侧一键部署；右侧为等价手动命令，方便对照学习"
    >
      <NeedServer>
        <div className="tabs">
          <button
            type="button"
            className={`tab ${side === 'frontend' ? 'active' : ''}`}
            onClick={() => setSide('frontend')}
          >
            部署前端
          </button>
          <button
            type="button"
            className={`tab ${side === 'backend' ? 'active' : ''}`}
            onClick={() => setSide('backend')}
          >
            部署后端
          </button>
          <button
            type="button"
            className={`tab ${side === 'compose' ? 'active' : ''}`}
            onClick={() => setSide('compose')}
          >
            Compose 编排
          </button>
        </div>

        {side === 'frontend' && (
          <div className="stack">
            <div className="deploy-layout">
              <div className="stack">
                <div className="panel">
                  <h3 className="panel-title">前端部署</h3>
                  <p className="muted" style={{ marginTop: 0, lineHeight: 1.6 }}>
                    站点目录按「站点名」区分，路径为{' '}
                    <code className="mono">/opt/vizops/sites/站点名/html</code>
                    ，可自选站点，不写死某一个。
                  </p>

                  <div className="mode-switch" role="tablist" aria-label="部署方式">
                    <button
                      type="button"
                      className={`mode-switch-btn ${fe.mode === 'upload' ? 'active' : ''}`}
                      onClick={() => switchFeMode('upload')}
                    >
                      上传 zip 部署
                    </button>
                    <button
                      type="button"
                      className={`mode-switch-btn ${fe.mode === 'existing' ? 'active' : ''}`}
                      onClick={() => switchFeMode('existing')}
                    >
                      使用已有站点文件
                    </button>
                  </div>

                  <div className="form-grid" style={{ marginTop: 16 }}>
                    {fe.mode === 'upload' ? (
                      <>
                        <div className="field">
                          <label>选择构建产物（.zip）</label>
                          <input
                            type="file"
                            accept=".zip,application/zip"
                            onChange={(e) => setFe({ ...fe, file: e.target.files?.[0] || null })}
                          />
                          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                            本地 <code className="mono">npm run build</code> 后打成 zip；解压到所选站点目录。
                          </div>
                          {fe.file && (
                            <div className="muted" style={{ marginTop: 6 }}>
                              已选择：{fe.file.name}（{(fe.file.size / 1024 / 1024).toFixed(2)} MB）
                            </div>
                          )}
                        </div>
                        <div className="field">
                          <label>站点名称（决定目录与容器名，建议英文）</label>
                          <input
                            value={fe.siteName}
                            onChange={(e) => setFe({ ...fe, siteName: e.target.value })}
                            placeholder="例如 frontend、admin、h5"
                          />
                          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                            将写入：<code className="mono">{htmlPath}</code>
                            ；容器名：<code className="mono">{feSite}</code>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="field">
                        <label>站点名称（可手动填写或从列表选择）</label>
                        <input
                          list="existing-sites-list"
                          value={fe.siteName}
                          onChange={(e) => setFe({ ...fe, siteName: e.target.value })}
                          placeholder="例如 frontend、admin，或已有目录名"
                          autoComplete="off"
                        />
                        <datalist id="existing-sites-list">
                          {sites.map((s) => (
                            <option key={s.name} value={s.name}>
                              {s.hasIndex ? s.htmlPath : `${s.htmlPath}（无 index.html）`}
                            </option>
                          ))}
                        </datalist>
                        {sites.length > 0 && (
                          <select
                            value={sites.some((s) => s.name === fe.siteName) ? fe.siteName : ''}
                            onChange={(e) => {
                              if (e.target.value) setFe({ ...fe, siteName: e.target.value });
                            }}
                            style={{ marginTop: 8 }}
                          >
                            <option value="">从已有站点快速选择…</option>
                            {sites.map((s) => (
                              <option key={s.name} value={s.name}>
                                {s.name}
                                {s.hasIndex ? '' : '（无 index.html）'} — {s.htmlPath}
                              </option>
                            ))}
                          </select>
                        )}
                        <div className="actions" style={{ marginTop: 8 }}>
                          <button
                            className="btn btn-sm"
                            type="button"
                            disabled={sitesLoading || !activeId}
                            onClick={() => void refreshSites()}
                          >
                            {sitesLoading ? '加载中…' : '刷新站点列表'}
                          </button>
                        </div>
                        <div className="muted" style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5 }}>
                          将挂载：<code className="mono">{htmlPath}</code>
                          <br />
                          容器名：<code className="mono">{feSite}</code>
                          {selectedSite
                            ? selectedSite.hasIndex
                              ? ' · 列表中已检测到 index.html'
                              : ' · 列表中未检测到 index.html'
                            : sitesLoading
                              ? ''
                              : ' · 可手动填写站点名（对应 /opt/vizops/sites/名称）'}
                        </div>
                      </div>
                    )}

                    <div className="field-row">
                      <div className="field">
                        <label>访问端口</label>
                        <input
                          value={fe.port}
                          onChange={(e) => setFe({ ...fe, port: e.target.value })}
                          placeholder="8080"
                        />
                      </div>
                      <div className="field">
                        <label>Nginx 镜像（仅本地已有）</label>
                        {nginxOptions.length === 0 ? (
                          <div className="alert warn" style={{ margin: 0 }}>
                            请先到 Docker → 拉取/上传 Nginx 镜像
                          </div>
                        ) : (
                          <select
                            value={fe.nginxImage}
                            onChange={(e) => setFe({ ...fe, nginxImage: e.target.value })}
                          >
                            {nginxOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>

                    {fe.mode === 'upload' ? (
                      <button
                        className="btn btn-primary"
                        type="button"
                        disabled={!fe.file || !nginxImg || feTask.running || uploading}
                        onClick={() => void deployFrontend()}
                        style={{ alignSelf: 'flex-start' }}
                      >
                        {uploading || feTask.running ? '部署中…' : '上传并发布'}
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        type="button"
                        disabled={
                          !nginxImg ||
                          !feSite ||
                          feTask.running ||
                          uploading
                        }
                        onClick={() => void startExistingSite()}
                        style={{ alignSelf: 'flex-start' }}
                      >
                        {feTask.running ? '启动中…' : '挂载已有文件并启动容器'}
                      </button>
                    )}

                    {activeServer && (
                      <div className="muted" style={{ fontSize: 12 }}>
                        成功后访问：http://{activeServer.host}:{fePort}
                      </div>
                    )}
                  </div>
                </div>

                {(uploadHint || feError || feTask.error || feTask.logs || feTask.running) && (
                  <div className="panel">
                    <h3 className="panel-title">部署日志</h3>
                    {uploadHint && <div className="muted" style={{ marginBottom: 8 }}>{uploadHint}</div>}
                    {(feError || feTask.error) && (
                      <div className="alert error">{feError || feTask.error}</div>
                    )}
                    <TaskLog logs={feTask.logs} status={feTask.status} />
                  </div>
                )}
              </div>

              <div className="panel">
                <h3 className="panel-title">手动命令参考</h3>
                <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
                  随左侧模式 / 站点 / 端口自动更新。
                </p>
                <pre className="cmd-block">{frontendManualCmd}</pre>
              </div>
            </div>
          </div>
        )}

        {side === 'backend' && (
          <div className="deploy-layout">
            <div className="stack">
              <div className="panel">
                <h3 className="panel-title">后端部署</h3>
                <div className="form-grid">
                  <div className="field">
                    <label>部署方式</label>
                    <select
                      value={be.mode}
                      onChange={(e) => setBe({ ...be, mode: e.target.value as typeof be.mode })}
                    >
                      <option value="docker">Docker 镜像（推荐）</option>
                      <option value="git-pm2">Git + Node + PM2</option>
                    </select>
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label>应用名称</label>
                      <input value={be.name} onChange={(e) => setBe({ ...be, name: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>对外端口</label>
                      <input value={be.port} onChange={(e) => setBe({ ...be, port: e.target.value })} />
                    </div>
                  </div>
                  {be.mode === 'docker' ? (
                    <>
                      <div className="field">
                        <label>Docker 镜像</label>
                        <input
                          value={be.image}
                          onChange={(e) => setBe({ ...be, image: e.target.value })}
                          placeholder="例如：ghcr.io/你的账号/api:latest"
                        />
                      </div>
                      <div className="field">
                        <label>容器内端口</label>
                        <input
                          value={be.containerPort}
                          onChange={(e) => setBe({ ...be, containerPort: e.target.value })}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="field">
                        <label>Git 仓库地址</label>
                        <input
                          value={be.gitUrl}
                          onChange={(e) => setBe({ ...be, gitUrl: e.target.value })}
                          placeholder="https://github.com/你的账号/api.git"
                        />
                      </div>
                      <div className="field">
                        <label>服务器工作目录</label>
                        <input
                          value={be.workDir}
                          onChange={(e) => setBe({ ...be, workDir: e.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label>启动命令</label>
                        <input
                          value={be.startCommand}
                          onChange={(e) => setBe({ ...be, startCommand: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                  <div className="field">
                    <label>环境变量（每行一项，格式：名称=值）</label>
                    <textarea
                      value={be.envText}
                      onChange={(e) => setBe({ ...be, envText: e.target.value })}
                      placeholder={'NODE_ENV=production\nDATABASE_URL=...'}
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={
                      beTask.running ||
                      (be.mode === 'docker' && !be.image) ||
                      (be.mode === 'git-pm2' && !be.gitUrl)
                    }
                    onClick={() => void deployBackend()}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    {beTask.running ? '部署中…' : '开始部署后端'}
                  </button>
                </div>
              </div>
              {beTask.error && <div className="alert error">{beTask.error}</div>}
              {(beTask.logs || beTask.running) && (
                <div className="panel">
                  <h3 className="panel-title">部署日志</h3>
                  <TaskLog logs={beTask.logs} status={beTask.status} />
                </div>
              )}
            </div>

            <div className="panel">
              <h3 className="panel-title">手动部署命令参考</h3>
              <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
                随左侧表单自动更新，可复制到服务器执行。
              </p>
              <pre className="cmd-block">{backendManualCmd}</pre>
            </div>
          </div>
        )}

        {side === 'compose' && (
          <div className="deploy-layout">
            <div className="stack">
              <div className="panel">
                <h3 className="panel-title">Compose 一键部署</h3>
                <p className="muted" style={{ marginTop: 0, lineHeight: 1.6 }}>
                  按项目部署：可以<strong>只部署前端</strong>、<strong>只部署后端</strong>，或两者一起。
                  Nginx 须选服务器<strong>本地已有</strong>镜像。
                </p>

                <div className="form-grid">
                  <div className="field">
                    <label>部署内容</label>
                    <div className="mode-switch" role="tablist">
                      <button
                        type="button"
                        className={`mode-switch-btn ${compose.mode === 'frontend' ? 'active' : ''}`}
                        onClick={() => setCompose({ ...compose, mode: 'frontend' })}
                      >
                        仅前端
                      </button>
                      <button
                        type="button"
                        className={`mode-switch-btn ${compose.mode === 'backend' ? 'active' : ''}`}
                        onClick={() => setCompose({ ...compose, mode: 'backend' })}
                      >
                        仅后端
                      </button>
                      <button
                        type="button"
                        className={`mode-switch-btn ${compose.mode === 'both' ? 'active' : ''}`}
                        onClick={() => setCompose({ ...compose, mode: 'both' })}
                      >
                        前端 + 后端
                      </button>
                    </div>
                  </div>

                  <div className="field">
                    <label>项目名称</label>
                    <input
                      value={compose.project}
                      onChange={(e) => setCompose({ ...compose, project: e.target.value })}
                      placeholder="myapp"
                    />
                  </div>

                  {(compose.mode === 'frontend' || compose.mode === 'both') && (
                  <div className="panel" style={{ margin: 0, padding: 14, background: 'rgba(0,0,0,0.12)' }}>
                    <strong style={{ fontSize: 13 }}>前端</strong>
                    <div className="mode-switch" role="tablist" style={{ marginTop: 10 }}>
                      <button
                        type="button"
                        className={`mode-switch-btn ${compose.feMode === 'upload' ? 'active' : ''}`}
                        onClick={() => setCompose({ ...compose, feMode: 'upload' })}
                      >
                        上传 zip
                      </button>
                      <button
                        type="button"
                        className={`mode-switch-btn ${compose.feMode === 'existing' ? 'active' : ''}`}
                        onClick={() => setCompose({ ...compose, feMode: 'existing' })}
                      >
                        已有站点文件
                      </button>
                    </div>
                    <div className="field-row" style={{ marginTop: 10 }}>
                      <div className="field">
                        <label>前端访问端口</label>
                        <input
                          value={compose.fePort}
                          onChange={(e) => setCompose({ ...compose, fePort: e.target.value })}
                          placeholder="8080"
                        />
                      </div>
                      <div className="field">
                        <label>Nginx 镜像（仅本地已有）</label>
                        {nginxOptions.length === 0 ? (
                          <div className="alert warn" style={{ margin: 0 }}>
                            请先到 Docker → 拉取/上传 Nginx
                          </div>
                        ) : (
                          <select
                            value={compose.nginxImage}
                            onChange={(e) => setCompose({ ...compose, nginxImage: e.target.value })}
                          >
                            {nginxOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                    {compose.feMode === 'upload' ? (
                      <div className="field">
                        <label>前端构建包（dist.zip）</label>
                        <input
                          type="file"
                          accept=".zip,application/zip"
                          onChange={(e) =>
                            setCompose({ ...compose, file: e.target.files?.[0] || null })
                          }
                        />
                        {compose.file && (
                          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                            已选：{compose.file.name}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                        将使用{' '}
                        <code className="mono">
                          /opt/vizops/sites/{compose.project.trim() || 'myapp'}/html
                        </code>
                      </div>
                    )}
                  </div>
                  )}

                  {(compose.mode === 'backend' || compose.mode === 'both') && (
                  <div className="panel" style={{ margin: 0, padding: 14, background: 'rgba(0,0,0,0.12)' }}>
                    <strong style={{ fontSize: 13 }}>后端</strong>
                    <div className="field" style={{ marginTop: 10 }}>
                      <label>后端 Docker 镜像</label>
                      <input
                        value={compose.beImage}
                        onChange={(e) => setCompose({ ...compose, beImage: e.target.value })}
                        placeholder="例如：你的仓库/api:latest"
                      />
                    </div>
                    <div className="field-row">
                      <div className="field">
                        <label>后端对外端口</label>
                        <input
                          value={compose.bePort}
                          onChange={(e) => setCompose({ ...compose, bePort: e.target.value })}
                          placeholder="3000"
                        />
                      </div>
                      <div className="field">
                        <label>容器内端口</label>
                        <input
                          value={compose.beContainerPort}
                          onChange={(e) =>
                            setCompose({ ...compose, beContainerPort: e.target.value })
                          }
                          placeholder="3000"
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label>后端环境变量（每行 KEY=值）</label>
                      <textarea
                        value={compose.beEnv}
                        onChange={(e) => setCompose({ ...compose, beEnv: e.target.value })}
                        placeholder={'NODE_ENV=production\nDATABASE_URL=...'}
                        rows={3}
                      />
                    </div>
                  </div>
                  )}

                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={
                      composeTask.running ||
                      uploading ||
                      ((compose.mode === 'frontend' || compose.mode === 'both') &&
                        (!compose.nginxImage ||
                          (compose.feMode === 'upload' && !compose.file))) ||
                      ((compose.mode === 'backend' || compose.mode === 'both') &&
                        !compose.beImage.trim())
                    }
                    onClick={() => void deployComposeStack()}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    {uploading || composeTask.running
                      ? '部署中…'
                      : compose.mode === 'frontend'
                        ? '部署前端'
                        : compose.mode === 'backend'
                          ? '部署后端'
                          : '部署前后端'}
                  </button>
                </div>
              </div>

              {(composeHint || composeError || composeTask.error || composeTask.logs || composeTask.running) && (
                <div className="panel">
                  <h3 className="panel-title">部署日志</h3>
                  {composeHint && <div className="muted" style={{ marginBottom: 8 }}>{composeHint}</div>}
                  {(composeError || composeTask.error) && (
                    <div className="alert error">{composeError || composeTask.error}</div>
                  )}
                  <TaskLog logs={composeTask.logs} status={composeTask.status} />
                </div>
              )}
            </div>

            <div className="panel">
              <h3 className="panel-title">部署说明</h3>
              <ul className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, fontSize: 13 }}>
                <li>仅前端：只起 Nginx，挂载站点目录</li>
                <li>仅后端：只起 API 容器</li>
                <li>前端+后端：一起起，并配置 <code className="mono">/api/</code> 反代</li>
                {activeServer && (
                  <li>
                    访问地址：
                    {(compose.mode === 'frontend' || compose.mode === 'both') && (
                      <>
                        <br />
                        前端{' '}
                        <code className="mono">
                          http://{activeServer.host}:{compose.fePort || '8080'}
                        </code>
                      </>
                    )}
                    {(compose.mode === 'backend' || compose.mode === 'both') && (
                      <>
                        <br />
                        后端{' '}
                        <code className="mono">
                          http://{activeServer.host}:{compose.bePort || '3000'}
                        </code>
                      </>
                    )}
                    {compose.mode === 'both' && (
                      <>
                        <br />
                        API 反代{' '}
                        <code className="mono">
                          http://{activeServer.host}:{compose.fePort || '8080'}/api/
                        </code>
                      </>
                    )}
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
      </NeedServer>
    </Shell>
  );
}

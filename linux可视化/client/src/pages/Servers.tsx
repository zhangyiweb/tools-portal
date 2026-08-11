import { useState } from 'react';
import { Plus, Trash2, RefreshCw, KeyRound, Eye, EyeOff } from 'lucide-react';
import { api, translateError } from '../api';
import { useApp } from '../context';
import { Shell } from '../components/Shell';

/** 常用服务器预设（可按需继续往下加；勿提交真实密码） */
const SERVER_PRESETS = [
  {
    id: 'centos-192-168-100-128',
    label: '本地虚拟机 · 192.168.100.128',
    name: '本地虚拟机',
    host: '192.168.100.128',
    port: '',
    username: 'root',
    password: '',
  },
  {
    id: 'server-192-168-63-72',
    label: '72服务器 · 192.168.63.72',
    name: '72服务器',
    host: '192.168.63.72',
    port: '',
    username: 'root',
    password: 'Qwer1234!@#$',
  },
  {
    id: 'server-192-168-63-71',
    label: '71服务器 · 192.168.63.71',
    name: '71服务器',
    host: '192.168.63.71',
    port: '',
    username: 'root',
    password: 'Qwer1234!@#$',
  },
] as const;

export function ServersPage() {
  const { servers, refreshServers, setActiveId, activeId, persistAndConnect, removeServer, restoring } =
    useApp();
  const [showForm, setShowForm] = useState(true);
  const [authMode, setAuthMode] = useState<'password' | 'key'>('password');
  const [presetId, setPresetId] = useState<string>(SERVER_PRESETS[0].id);
  const [form, setForm] = useState<{
    name: string;
    host: string;
    port: string;
    username: string;
    password: string;
    privateKey: string;
    passphrase: string;
  }>({
    name: SERVER_PRESETS[0].name,
    host: SERVER_PRESETS[0].host,
    port: SERVER_PRESETS[0].port,
    username: SERVER_PRESETS[0].username,
    password: SERVER_PRESETS[0].password,
    privateKey: '',
    passphrase: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);

  const applyPreset = (id: string) => {
    setPresetId(id);
    if (id === 'custom') return;
    const preset = SERVER_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setForm((f) => ({
      ...f,
      name: preset.name,
      host: preset.host,
      port: preset.port,
      username: preset.username,
      password: preset.password || '',
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const stableId =
        presetId !== 'custom'
          ? presetId
          : `custom-${form.host.trim()}-${form.username.trim()}`;
      const result = await persistAndConnect({
        id: stableId,
        name: form.name || form.host,
        host: form.host.trim(),
        port: form.port.trim() ? Number(form.port) : 22,
        username: form.username.trim(),
        password: authMode === 'password' ? form.password : undefined,
        privateKey: authMode === 'key' ? form.privateKey : undefined,
        passphrase: authMode === 'key' ? form.passphrase || undefined : undefined,
      });
      setSuccess(result.message + '（已记住，刷新后会自动重连）');
      setShowForm(false);
    } catch (err) {
      setError(translateError((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('确定移除该服务器连接？')) return;
    await removeServer(id);
  };

  const reconnect = async (id: string) => {
    setError(null);
    try {
      await api.reconnect(id);
      await refreshServers();
      setSuccess('重新连接成功');
    } catch (err) {
      // 内存丢失时用本地凭证再连
      try {
        const { loadSavedServers } = await import('../storage');
        const saved = loadSavedServers().find((s) => s.id === id);
        if (saved) {
          await persistAndConnect(saved);
          setSuccess('重新连接成功');
          return;
        }
      } catch {
        /* fallthrough */
      }
      setError(translateError((err as Error).message));
    }
  };

  return (
    <Shell
      title="服务器连接"
      subtitle="第一步：通过 SSH 连接远程 Linux。连上之后才能使用总览、Docker、部署等功能"
    >
      <div className="stack">
        <div className="tab-toolbar">
          <button className="btn btn-primary" type="button" onClick={() => setShowForm(true)}>
            <Plus size={14} />
            添加服务器
          </button>
        </div>
        {restoring && <div className="alert success">正在用已保存的账号自动重连…</div>}
        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}

        {showForm && (
          <div className="panel">
            <h3 className="panel-title">
              <KeyRound size={16} />
              新建 SSH 连接
            </h3>
            <form className="form-grid" onSubmit={(e) => void submit(e)}>
              <div className="field">
                <label>选择服务器</label>
                <select
                  value={presetId}
                  onChange={(e) => applyPreset(e.target.value)}
                >
                  {SERVER_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                  <option value="custom">自定义（手动填写）</option>
                </select>
                <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                  {presetId === 'custom'
                    ? '请手动填写主机、账号和密码后连接。'
                    : (() => {
                        const p = SERVER_PRESETS.find((x) => x.id === presetId);
                        return p
                          ? `已预填：${p.name} · ${p.host} · ${p.username} / 预设密码，可直接点连接。`
                          : '选择预设后可直接连接。';
                      })()}
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>显示名称</label>
                  <input
                    value={form.name}
                    onChange={(e) => {
                      setPresetId('custom');
                      setForm({ ...form, name: e.target.value });
                    }}
                    placeholder="例如：生产机"
                  />
                </div>
                <div className="field">
                  <label>主机地址 *</label>
                  <input
                    required
                    value={form.host}
                    onChange={(e) => {
                      setPresetId('custom');
                      setForm({ ...form, host: e.target.value });
                    }}
                    placeholder="IP 或域名"
                  />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>端口（可选）</label>
                  <input
                    value={form.port}
                    onChange={(e) => setForm({ ...form, port: e.target.value })}
                    placeholder="默认 22，一般不用填"
                    inputMode="numeric"
                  />
                </div>
                <div className="field">
                  <label>用户名 *</label>
                  <input
                    required
                    value={form.username}
                    onChange={(e) => {
                      setPresetId('custom');
                      setForm({ ...form, username: e.target.value });
                    }}
                    placeholder="例如 root 或 ubuntu"
                  />
                </div>
              </div>
              <div className="tabs">
                <button
                  type="button"
                  className={`tab ${authMode === 'password' ? 'active' : ''}`}
                  onClick={() => setAuthMode('password')}
                >
                  密码登录
                </button>
                <button
                  type="button"
                  className={`tab ${authMode === 'key' ? 'active' : ''}`}
                  onClick={() => setAuthMode('key')}
                >
                  私钥登录
                </button>
              </div>
              {authMode === 'password' ? (
                <div className="field">
                  <label>密码 *</label>
                  <div className="password-field">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      title={showPassword ? '隐藏密码' : '显示密码'}
                      aria-label={showPassword ? '隐藏密码' : '显示密码'}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="field">
                    <label>私钥内容 *</label>
                    <textarea
                      required
                      value={form.privateKey}
                      onChange={(e) => setForm({ ...form, privateKey: e.target.value })}
                      placeholder="粘贴完整私钥，以 -----BEGIN 开头"
                    />
                  </div>
                  <div className="field">
                    <label>私钥口令（可选）</label>
                    <div className="password-field">
                      <input
                        type={showPassphrase ? 'text' : 'password'}
                        value={form.passphrase}
                        onChange={(e) => setForm({ ...form, passphrase: e.target.value })}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        title={showPassphrase ? '隐藏口令' : '显示口令'}
                        aria-label={showPassphrase ? '隐藏口令' : '显示口令'}
                        onClick={() => setShowPassphrase((v) => !v)}
                      >
                        {showPassphrase ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </>
              )}
              <div className="actions">
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  {busy ? '连接中…' : '连接并保存'}
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>
                  取消
                </button>
              </div>
            </form>
          </div>
        )}

        {servers.length === 0 && !showForm ? (
          <div className="empty panel">
            <h3>还没有服务器</h3>
            <p>添加一台 Ubuntu / Debian / CentOS 等 Linux 主机，开始可视化运维。</p>
            <button className="btn btn-primary" type="button" onClick={() => setShowForm(true)}>
              添加第一台服务器
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>状态</th>
                  <th>名称</th>
                  <th>地址</th>
                  <th>用户</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {servers.map((s) => (
                  <tr key={s.id} style={{ background: activeId === s.id ? 'var(--accent-soft)' : undefined }}>
                    <td>
                      <span className={`badge conn-status ${s.connected ? 'ok' : 'err'}`}>
                        <span className={`dot ${s.connected ? 'on' : 'off'}`} />
                        {s.connected ? '已连接' : '未连接'}
                      </span>
                    </td>
                    <td>{s.name}</td>
                    <td className="mono">
                      {s.host}:{s.port}
                    </td>
                    <td className="mono">{s.username}</td>
                    <td>
                      <div className="actions">
                        <button
                          className="btn btn-sm"
                          type="button"
                          disabled={!s.connected}
                          title={s.connected ? '设为当前服务器' : '请先重连'}
                          onClick={() => {
                            if (!s.connected) return;
                            setActiveId(s.id);
                          }}
                        >
                          选用
                        </button>
                        <button className="btn btn-sm" type="button" onClick={() => void reconnect(s.id)}>
                          <RefreshCw size={12} />
                          重连
                        </button>
                        <button className="btn btn-sm btn-danger" type="button" onClick={() => void remove(s.id)}>
                          <Trash2 size={12} />
                          移除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="panel muted">
          <strong style={{ color: 'var(--text)' }}>使用提示</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>
            <li>连接成功后会记住账号（保存在本机浏览器），刷新页面会自动重连。</li>
            <li>端口一般不用填，默认使用 22；只有改过 SSH 端口时才需要填写。</li>
            <li>若提示「SSH 握手超时」，请检查虚拟机网段是否与本机一致，以及 SSH 服务是否启动。</li>
            <li>安装/部署操作需要 sudo 权限；root 用户通常可直接执行。</li>
          </ul>
        </div>
      </div>
    </Shell>
  );
}

import { useState } from 'react';
import { Database } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../context';
import { Shell, NeedServer, TaskLog, useTaskRunner } from '../components/Shell';

type DbType = 'mysql' | 'postgres' | 'redis';

const presets: { type: DbType; title: string; desc: string; defaultPort: number }[] = [
  { type: 'mysql', title: 'MySQL 8', desc: '关系型数据库，适合大多数业务应用', defaultPort: 3306 },
  { type: 'postgres', title: 'PostgreSQL 16', desc: '功能强大的开源对象关系型数据库', defaultPort: 5432 },
  { type: 'redis', title: 'Redis 7', desc: '内存缓存与消息队列', defaultPort: 6379 },
];

export function DatabasePage() {
  const { activeId } = useApp();
  const [type, setType] = useState<DbType>('mysql');
  const [useDocker, setUseDocker] = useState(true);
  const [form, setForm] = useState({
    rootPassword: 'root123456',
    database: 'app',
    user: '',
    password: 'pass123456',
    port: '3306',
  });
  const task = useTaskRunner();

  const selectType = (t: DbType) => {
    setType(t);
    const p = presets.find((x) => x.type === t)!;
    setForm((f) => ({ ...f, port: String(p.defaultPort) }));
  };

  const install = async () => {
    if (!activeId) return;
    await task.run(
      () =>
        api.startTask(activeId, 'install-db', {
          type,
          useDocker,
          rootPassword: form.rootPassword,
          database: form.database,
          user: form.user || undefined,
          password: form.password,
          port: Number(form.port),
        }),
      api.streamTask,
    );
  };

  return (
    <Shell
      title="数据库安装"
      subtitle="一键安装 MySQL / PostgreSQL / Redis（推荐 Docker 方式，隔离干净）"
    >
      <NeedServer>
        <div className="stack">
          <div className="wizard-steps">
            <div className="wizard-step active">
              <strong>1. 选择数据库</strong>
              MySQL / PG / Redis
            </div>
            <div className={`wizard-step ${type ? 'active' : ''}`}>
              <strong>2. 配置参数</strong>
              端口与密码
            </div>
            <div className={`wizard-step ${task.running || task.logs ? 'active' : ''}`}>
              <strong>3. 执行安装</strong>
              实时日志
            </div>
          </div>

          <div className="grid-3">
            {presets.map((p) => (
              <button
                key={p.type}
                type="button"
                className="panel"
                onClick={() => selectType(p.type)}
                style={{
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderColor: type === p.type ? 'var(--accent-dim)' : undefined,
                  background: type === p.type ? 'var(--accent-soft)' : undefined,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Database size={18} color="var(--accent)" />
                  <strong>{p.title}</strong>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>{p.desc}</div>
              </button>
            ))}
          </div>

          <div className="panel" style={{ maxWidth: 640 }}>
            <h3 className="panel-title">安装配置</h3>
            <div className="form-grid">
              <div className="field">
                <label>安装方式</label>
                <select
                  value={useDocker ? 'docker' : 'apt'}
                  onChange={(e) => setUseDocker(e.target.value === 'docker')}
                >
                  <option value="docker">Docker 容器（推荐）</option>
                  <option value="apt">系统 apt 安装</option>
                </select>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>宿主机端口</label>
                  <input
                    value={form.port}
                    onChange={(e) => setForm({ ...form, port: e.target.value })}
                  />
                </div>
                {type !== 'redis' && (
                  <div className="field">
                    <label>数据库名</label>
                    <input
                      value={form.database}
                      onChange={(e) => setForm({ ...form, database: e.target.value })}
                    />
                  </div>
                )}
              </div>
              {type !== 'redis' && (
                <>
                  <div className="field">
                    <label>{type === 'mysql' ? 'Root 密码' : '管理员密码'}</label>
                    <input
                      type="password"
                      value={form.rootPassword}
                      onChange={(e) => setForm({ ...form, rootPassword: e.target.value })}
                    />
                  </div>
                  {type === 'mysql' && useDocker && (
                    <div className="field-row">
                      <div className="field">
                        <label>业务用户（可选）</label>
                        <input
                          value={form.user}
                          onChange={(e) => setForm({ ...form, user: e.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label>业务用户密码</label>
                        <input
                          type="password"
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
              <button
                className="btn btn-primary"
                type="button"
                disabled={task.running}
                onClick={() => void install()}
                style={{ alignSelf: 'flex-start' }}
              >
                {task.running ? '安装中…' : `安装 ${presets.find((p) => p.type === type)?.title}`}
              </button>
            </div>
          </div>

          {task.error && <div className="alert error">{task.error}</div>}
          {(task.logs || task.running) && (
            <div className="panel">
              <h3 className="panel-title">安装日志</h3>
              <TaskLog logs={task.logs} status={task.status} />
            </div>
          )}

          <div className="panel muted">
            Docker 方式容器名约定：<code className="mono">vizops-mysql / vizops-postgres / vizops-redis</code>
            。安装后可在 Docker 页面查看与管理。
          </div>
        </div>
      </NeedServer>
    </Shell>
  );
}

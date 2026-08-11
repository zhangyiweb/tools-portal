import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import {
  LayoutDashboard,
  Server,
  Container,
  Database,
  Rocket,
  Terminal,
  LogOut,
  Activity,
} from 'lucide-react';
import { useApp } from '../context';
import { translateError } from '../api';
import { toast } from '../toast';

const links = [
  { to: '/servers', icon: Server, label: '服务器', end: false },
  { to: '/', icon: LayoutDashboard, label: '总览', end: true },
  { to: '/docker', icon: Container, label: 'Docker' },
  { to: '/database', icon: Database, label: '数据库' },
  { to: '/deploy', icon: Rocket, label: '部署' },
  { to: '/terminal', icon: Terminal, label: '命令行' },
];

export function Shell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { servers, activeId, setActiveId, activeServer, leaveServer } = useApp();
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);

  const onLeave = async () => {
    if (!activeId) return;
    setLeaving(true);
    try {
      await leaveServer();
      toast.success('已退出当前服务器');
      navigate('/servers');
    } catch (e) {
      toast.error((e as Error).message || '退出失败');
    } finally {
      setLeaving(false);
    }
  };

  const connected = !!activeServer?.connected;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">LV</div>
          <div className="brand-text">
            <strong>Linux Viz Ops</strong>
            <span>可视化运维台</span>
          </div>
        </div>
        <nav className="nav">
          {links.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={16} strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="topbar-right">
            <div className={`session ${connected ? 'on' : 'off'}`}>
              <span className="session-status" title={connected ? '已连接' : '未连接'} />
              <div className="session-body">
                {connected && activeServer ? (
                  <>
                    <select
                      className="session-select"
                      value={activeId || ''}
                      aria-label="当前服务器"
                      onChange={(e) => {
                        const v = e.target.value || null;
                        if (!v) {
                          setActiveId(null);
                          navigate('/servers');
                          return;
                        }
                        const target = servers.find((s) => s.id === v);
                        if (target && !target.connected) {
                          toast.warn('该服务器未连接，请先到「服务器」页重连');
                          navigate('/servers');
                          return;
                        }
                        setActiveId(v);
                      }}
                    >
                      {servers.map((s) => (
                        <option key={s.id} value={s.id} disabled={!s.connected}>
                          {s.name}
                          {!s.connected ? '（未连接）' : ''}
                        </option>
                      ))}
                    </select>
                    <span className="session-addr mono">
                      {activeServer.host}:{activeServer.port}
                    </span>
                  </>
                ) : (
                  <button
                    type="button"
                    className="session-empty"
                    onClick={() => navigate('/servers')}
                  >
                    未连接 · 去选择服务器
                  </button>
                )}
              </div>
              {connected && (
                <button
                  type="button"
                  className="session-leave"
                  disabled={leaving}
                  title="退出服务器"
                  onClick={() => void onLeave()}
                >
                  <LogOut size={14} />
                  <span>退出</span>
                </button>
              )}
            </div>
            {actions && <div className="actions">{actions}</div>}
          </div>
        </header>
        <div className="content fade-in">{children}</div>
      </div>
    </div>
  );
}

export function NeedServer({ children }: { children: ReactNode }) {
  const { activeId, activeServer, restoring } = useApp();
  const navigate = useNavigate();

  if (restoring) {
    return <Loading text="正在连接服务器" />;
  }

  if (!activeId || !activeServer?.connected) {
    return (
      <div className="empty panel">
        <Activity size={40} color="var(--text-dim)" style={{ marginBottom: 12 }} />
        <h3>第一步：先连接服务器</h3>
        <p>
          所有运维操作（总览、Docker、部署、数据库、命令行）都依赖 SSH 连接。
          请先在「服务器」页完成连接，再回来操作。
        </p>
        <Button type="primary" icon={<Server size={14} />} onClick={() => navigate('/servers')}>
          去连接服务器
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}

export function TaskLog({ logs, status }: { logs: string; status?: string }) {
  return (
    <div className="stack">
      {status && <div className="muted">{status}</div>}
      <div className="terminal">{logs || '等待输出...'}</div>
    </div>
  );
}

export function useTaskRunner() {
  const [logs, setLogs] = useState('');
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setLogs('');
    setStatus('');
    setError(null);
  };

  const run = async (start: () => Promise<{ taskId: string }>, stream: typeof import('../api').api.streamTask) => {
    reset();
    setRunning(true);
    try {
      const { taskId } = await start();
      await new Promise<void>((resolve) => {
        stream(taskId, (e) => {
          if (e.type === 'start') setStatus(e.message);
          if (e.type === 'log') setLogs((prev) => prev + e.chunk);
          if (e.type === 'done') {
            const msg = e.message || (e.code === 0 ? '操作完成' : '操作失败');
            setStatus(msg);
            setRunning(false);
            if (e.code === 0) {
              toast.success(msg);
            } else {
              const failMsg = translateError(msg);
              setError(failMsg);
              toast.error(failMsg);
            }
            resolve();
          }
          if (e.type === 'error') {
            const msg = translateError(e.message);
            setError(msg);
            toast.error(msg);
            setStatus('失败');
            setRunning(false);
            resolve();
          }
        });
      });
    } catch (e) {
      const msg = translateError((e as Error).message);
      setError(msg);
      toast.error(msg);
      setRunning(false);
    }
  };

  return { logs, status, running, error, run, reset };
}

export function Loading({ text = '加载中...' }: { text?: string }) {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? '' : d + '.')), 400);
    return () => clearInterval(t);
  }, []);
  return <div className="muted" style={{ padding: 24 }}>{text}{dots}</div>;
}

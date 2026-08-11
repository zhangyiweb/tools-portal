import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { api, formatBytes, translateError, type SystemOverview } from '../api';
import { useApp } from '../context';
import { Shell, NeedServer, Loading } from '../components/Shell';

function usageClass(pct: number) {
  if (pct >= 90) return 'danger';
  if (pct >= 75) return 'warn';
  return '';
}

export function OverviewPage() {
  const { activeId, activeServer } = useApp();
  const [data, setData] = useState<SystemOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activeId) return;
    setLoading(true);
    setError(null);
    try {
      const ov = await api.overview(activeId);
      setData(ov);
    } catch (e) {
      setError(translateError((e as Error).message));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => {
    void load();
    if (!activeId) return;
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [activeId, load]);

  const gauge = data
    ? [
        { name: 'CPU', value: data.cpu.usage, fill: '#3ecf8e' },
        { name: '内存', value: data.memory.usagePercent, fill: '#5bb8e8' },
        { name: '磁盘', value: data.disk.usagePercent, fill: '#e6b84d' },
      ]
    : [];

  return (
    <Shell
      title="系统总览"
      subtitle={
        activeServer
          ? `${activeServer.name} · 资源与运行环境一览`
          : '连接服务器后展示 CPU、内存、磁盘与常用工具状态'
      }
    >
      <NeedServer>
        <div className="tab-toolbar" style={{ marginBottom: 16 }}>
          <button className="btn" type="button" onClick={() => void load()} disabled={!activeId || loading}>
            <RefreshCw size={14} />
            刷新
          </button>
        </div>
        {error && <div className="alert error" style={{ marginBottom: 16 }}>{error}</div>}
        {loading && !data && <Loading text="正在通过 SSH 采集系统信息" />}
        {data && (
          <div className="stack">
            <div className="grid-4">
              <div className="stat-card">
                <div className="stat-label">CPU 使用率</div>
                <div className="stat-value">{data.cpu.usage.toFixed(1)}%</div>
                <div className="stat-sub">{data.cpu.cores} 核 · {data.cpu.model || '—'}</div>
                <div className={`progress ${usageClass(data.cpu.usage)}`}>
                  <span style={{ width: `${Math.min(100, data.cpu.usage)}%` }} />
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">内存</div>
                <div className="stat-value">{data.memory.usagePercent}%</div>
                <div className="stat-sub">
                  {formatBytes(data.memory.usedKb)} / {formatBytes(data.memory.totalKb)}
                </div>
                <div className={`progress ${usageClass(data.memory.usagePercent)}`}>
                  <span style={{ width: `${Math.min(100, data.memory.usagePercent)}%` }} />
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">根分区磁盘</div>
                <div className="stat-value">{data.disk.usagePercent}%</div>
                <div className="stat-sub">
                  {formatBytes(data.disk.usedKb)} / {formatBytes(data.disk.totalKb)}
                </div>
                <div className={`progress ${usageClass(data.disk.usagePercent)}`}>
                  <span style={{ width: `${Math.min(100, data.disk.usagePercent)}%` }} />
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">负载 Load</div>
                <div className="stat-value" style={{ fontSize: 22 }}>
                  {data.load.m1.toFixed(2)}
                </div>
                <div className="stat-sub">
                  1m / 5m / 15m · {data.load.m5.toFixed(2)} · {data.load.m15.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="panel">
                <h3 className="panel-title">主机信息</h3>
                <div className="form-grid" style={{ fontSize: 13 }}>
                  {[
                    ['主机名', data.hostname],
                    ['系统', data.os],
                    ['内核', data.kernel],
                    ['架构', data.arch],
                    ['IP', data.ip || '—'],
                    ['运行时间', data.uptime],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span className="muted">{k}</span>
                      <span className="mono" style={{ textAlign: 'right' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel">
                <h3 className="panel-title">资源环形对比</h3>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="30%"
                      outerRadius="100%"
                      data={gauge}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <RadialBar background dataKey="value" cornerRadius={4} />
                      <Tooltip
                        contentStyle={{
                          background: '#121a17',
                          border: '1px solid #2a3d34',
                          borderRadius: 8,
                        }}
                        formatter={(v: number) => [`${Number(v).toFixed(1)}%`, '使用率']}
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
                <div className="actions" style={{ justifyContent: 'center' }}>
                  {gauge.map((g) => (
                    <span key={g.name} className="badge">
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: g.fill }} />
                      {g.name} {g.value.toFixed(0)}%
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="panel">
                <h3 className="panel-title">运行环境</h3>
                <div className="stack" style={{ gap: 10 }}>
                  <ToolRow
                    name="Docker"
                    ok={data.tools.docker.installed}
                    detail={data.tools.docker.version || '未安装'}
                  />
                  <ToolRow
                    name="Node.js"
                    ok={data.tools.node.installed}
                    detail={data.tools.node.version || '未安装'}
                  />
                  <ToolRow
                    name="Nginx"
                    ok={data.tools.nginx.installed}
                    detail={data.tools.nginx.installed ? '已检测到' : '未安装'}
                  />
                </div>
              </div>
              <div className="panel">
                <h3 className="panel-title">内存占用 Top 进程</h3>
                {data.processes.length === 0 ? (
                  <div className="muted">暂无进程数据</div>
                ) : (
                  <div style={{ height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.processes.map((p) => ({
                          name: p.command.split('/').pop()?.slice(0, 16) || p.pid,
                          mem: p.mem,
                          cpu: p.cpu,
                        }))}
                        layout="vertical"
                        margin={{ left: 8, right: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e2e27" />
                        <XAxis type="number" stroke="#5f756a" fontSize={11} />
                        <YAxis type="category" dataKey="name" width={90} stroke="#5f756a" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            background: '#121a17',
                            border: '1px solid #2a3d34',
                            borderRadius: 8,
                          }}
                        />
                        <Bar dataKey="mem" name="内存 %" fill="#5bb8e8" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
            <div className="muted" style={{ fontSize: 11 }}>
              采集时间 {new Date(data.collectedAt).toLocaleString()} · 约每 8 秒自动刷新
            </div>
          </div>
        )}
      </NeedServer>
    </Shell>
  );
}

function ToolRow({ name, ok, detail }: { name: string; ok: boolean; detail: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        background: 'var(--bg)',
        borderRadius: 8,
        border: '1px solid var(--border-soft)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className={`badge ${ok ? 'ok' : ''}`}>{ok ? '就绪' : '缺失'}</span>
        <strong style={{ fontSize: 13 }}>{name}</strong>
      </div>
      <span className="mono muted">{detail}</span>
    </div>
  );
}

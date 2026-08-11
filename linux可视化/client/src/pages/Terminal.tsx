import { useState } from 'react';
import { api, translateError } from '../api';
import { useApp } from '../context';
import { Shell, NeedServer } from '../components/Shell';

const shortcuts = [
  { label: '磁盘占用', cmd: 'df -h' },
  { label: '内存', cmd: 'free -h' },
  { label: '监听端口', cmd: 'ss -tlnp' },
  { label: '近期登录', cmd: 'last -n 10' },
  { label: '系统版本', cmd: 'cat /etc/os-release' },
  { label: 'Docker 状态', cmd: 'docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}" 2>&1 || echo "无 Docker"' },
];

export function TerminalPage() {
  const { activeId } = useApp();
  const [command, setCommand] = useState('uname -a && uptime');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (cmd?: string) => {
    if (!activeId) return;
    const c = (cmd ?? command).trim();
    if (!c) return;
    setBusy(true);
    setError(null);
    setOutput(`$ ${c}\n\n`);
    try {
      const r = await api.exec(activeId, c);
      setOutput(
        (prev) =>
          prev +
          (r.stdout || '') +
          (r.stderr ? `\n[错误输出]\n${r.stderr}` : '') +
          `\n\n[退出码 ${r.code}]`,
      );
    } catch (e) {
      setError(translateError((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="命令行" subtitle="在已连接的服务器上执行常用命令（适合快速排查）">
      <NeedServer>
        <div className="stack">
          <div className="actions">
            {shortcuts.map((s) => (
              <button
                key={s.label}
                className="btn btn-sm"
                type="button"
                disabled={busy}
                onClick={() => {
                  setCommand(s.cmd);
                  void run(s.cmd);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="panel">
            <div className="field">
              <label>命令</label>
              <textarea
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void run();
                  }
                }}
              />
            </div>
            <div className="actions" style={{ marginTop: 12 }}>
              <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void run()}>
                {busy ? '执行中…' : '运行 (Ctrl+Enter)'}
              </button>
            </div>
          </div>
          {error && <div className="alert error">{error}</div>}
          <div className="terminal" style={{ minHeight: 240 }}>
            {output || '输出将显示在这里'}
          </div>
        </div>
      </NeedServer>
    </Shell>
  );
}

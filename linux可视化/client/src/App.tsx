import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { api, type ServerInfo } from './api';
import { AppContext } from './context';
import {
  getActiveServerId,
  loadSavedServers,
  removeSavedServer,
  saveServerCredential,
  setActiveServerId,
  type SavedServer,
} from './storage';
import { OverviewPage } from './pages/Overview';
import { ServersPage } from './pages/Servers';
import { DockerPage } from './pages/Docker';
import { DatabasePage } from './pages/Database';
import { DeployPage } from './pages/Deploy';
import { TerminalPage } from './pages/Terminal';
import './styles.css';

function AppProvider({ children }: { children: React.ReactNode }) {
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(() => getActiveServerId());
  const [restoring, setRestoring] = useState(true);
  const restoreOnce = useRef(false);

  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id);
    setActiveServerId(id);
  }, []);

  const refreshServers = useCallback(async () => {
    try {
      const { servers: list } = await api.listServers();
      setServers(list);
      const currentActive = getActiveServerId();
      if (!currentActive) return;
      const cur = list.find((s) => s.id === currentActive);
      // 已断开或不存在：清空当前选择，避免 Docker 等页继续请求导致 500
      if (!cur || !cur.connected) {
        setActiveId(null);
      }
    } catch {
      /* backend may be starting */
    }
  }, [setActiveId]);

  const persistAndConnect = useCallback(
    async (cred: SavedServer) => {
      const result = await api.addServer(cred);
      saveServerCredential({
        ...cred,
        id: result.server.id,
        name: result.server.name,
        host: result.server.host,
        port: result.server.port,
        username: result.server.username,
      });
      setActiveId(result.server.id);
      await refreshServers();
      return result;
    },
    [refreshServers, setActiveId],
  );

  // 刷新页面后：用本地保存的凭证自动重连
  useEffect(() => {
    if (restoreOnce.current) return;
    restoreOnce.current = true;

    void (async () => {
      setRestoring(true);
      const saved = loadSavedServers();
      for (const s of saved) {
        try {
          await api.addServer(s);
        } catch {
          /* 单台失败不影响其它 */
        }
      }
      await refreshServers();
      const prefer = getActiveServerId();
      const { servers: list } = await api.listServers().catch(() => ({ servers: [] as ServerInfo[] }));
      if (prefer && list.some((s) => s.id === prefer && s.connected)) {
        setActiveId(prefer);
      } else {
        const firstOk = list.find((s) => s.connected);
        // 没有已连接服务器时必须清空，否则会带着旧 id 去请求 Docker 接口报 500
        setActiveId(firstOk?.id ?? null);
      }
      setRestoring(false);
    })();
  }, [refreshServers, setActiveId]);

  useEffect(() => {
    const t = setInterval(() => void refreshServers(), 15000);
    return () => clearInterval(t);
  }, [refreshServers]);

  const removeServer = useCallback(
    async (id: string) => {
      await api.removeServer(id);
      removeSavedServer(id);
      if (getActiveServerId() === id) setActiveId(null);
      await refreshServers();
    },
    [refreshServers, setActiveId],
  );

  const leaveServer = useCallback(async () => {
    const id = getActiveServerId();
    if (id) {
      try {
        await api.disconnect(id);
      } catch {
        /* ignore */
      }
      setActiveId(null);
      await refreshServers();
    }
  }, [refreshServers, setActiveId]);

  const activeServer = useMemo(
    () => servers.find((s) => s.id === activeId) ?? null,
    [servers, activeId],
  );

  return (
    <AppContext.Provider
      value={{
        servers,
        activeId,
        setActiveId,
        refreshServers,
        activeServer,
        restoring,
        persistAndConnect,
        removeServer,
        leaveServer,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route path="/servers" element={<ServersPage />} />
          <Route path="/" element={<OverviewPage />} />
          <Route path="/docker" element={<DockerPage />} />
          <Route path="/database" element={<DatabasePage />} />
          <Route path="/deploy" element={<DeployPage />} />
          <Route path="/terminal" element={<TerminalPage />} />
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}

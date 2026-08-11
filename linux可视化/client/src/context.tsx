import { createContext, useContext } from 'react';
import type { ServerInfo } from './api';
import type { SavedServer } from './storage';

export interface AppContextValue {
  servers: ServerInfo[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  refreshServers: () => Promise<void>;
  activeServer: ServerInfo | null;
  restoring: boolean;
  persistAndConnect: (cred: SavedServer) => Promise<{
    ok: boolean;
    server: ServerInfo;
    message: string;
  }>;
  removeServer: (id: string) => Promise<void>;
  /** 退出当前服务器（断开 SSH，保留本地凭证） */
  leaveServer: () => Promise<void>;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('内部错误：缺少应用上下文');
  return ctx;
}

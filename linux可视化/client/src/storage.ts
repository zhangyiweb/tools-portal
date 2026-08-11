export interface SavedServer {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

const SAVED_KEY = 'vizops-saved-servers';
const ACTIVE_KEY = 'vizops-active-server';

export function loadSavedServers(): SavedServer[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SavedServer[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveServerCredential(server: SavedServer) {
  const list = loadSavedServers().filter((s) => s.id !== server.id);
  // 同 host+username 也合并，避免重复
  const merged = list.filter(
    (s) => !(s.host === server.host && s.username === server.username && s.port === server.port),
  );
  merged.push(server);
  localStorage.setItem(SAVED_KEY, JSON.stringify(merged));
}

export function removeSavedServer(id: string) {
  const list = loadSavedServers().filter((s) => s.id !== id);
  localStorage.setItem(SAVED_KEY, JSON.stringify(list));
}

export function getActiveServerId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveServerId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}

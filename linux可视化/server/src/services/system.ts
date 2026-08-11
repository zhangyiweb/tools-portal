import { sshPool } from '../ssh/pool.js';

function num(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export async function getSystemOverview(serverId: string) {
  const script = `
set -e
HOSTNAME=$(hostname 2>/dev/null || echo unknown)
OS=$( ( . /etc/os-release 2>/dev/null && echo "$PRETTY_NAME" ) || uname -s )
KERNEL=$(uname -r)
UPTIME=$(uptime -p 2>/dev/null || uptime | sed 's/.*up //' | cut -d',' -f1)
ARCH=$(uname -m)

# CPU
CPU_CORES=$(nproc 2>/dev/null || echo 1)
CPU_MODEL=$(grep -m1 'model name' /proc/cpuinfo 2>/dev/null | cut -d: -f2 | sed 's/^ *//' || echo unknown)
CPU_USAGE=$(top -bn1 2>/dev/null | grep -i 'Cpu(s)' | awk '{print 100-$8}' | head -1)
if [ -z "$CPU_USAGE" ]; then
  CPU_USAGE=$(grep 'cpu ' /proc/stat | awk '{u=($2+$4)*100/($2+$4+$5); printf "%.1f", u}')
fi

# Memory (KB)
MEM_TOTAL=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
MEM_AVAIL=$(awk '/MemAvailable/ {print $2}' /proc/meminfo)
MEM_USED=$((MEM_TOTAL - MEM_AVAIL))

# Swap
SWAP_TOTAL=$(awk '/SwapTotal/ {print $2}' /proc/meminfo)
SWAP_FREE=$(awk '/SwapFree/ {print $2}' /proc/meminfo)
SWAP_USED=$((SWAP_TOTAL - SWAP_FREE))

# Disk root
DISK_LINE=$(df -P / | awk 'NR==2 {print $2","$3","$4","$5}')

# Load
LOAD=$(cat /proc/loadavg | awk '{print $1","$2","$3}')

# Network primary IP
IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo '')

# Docker
DOCKER_OK=0
DOCKER_VER=''
if command -v docker >/dev/null 2>&1; then
  DOCKER_OK=1
  DOCKER_VER=$(docker --version 2>/dev/null | head -1 || true)
fi

# Node
NODE_OK=0
NODE_VER=''
if command -v node >/dev/null 2>&1; then
  NODE_OK=1
  NODE_VER=$(node -v 2>/dev/null || true)
fi

# Nginx
NGINX_OK=0
if command -v nginx >/dev/null 2>&1 || systemctl is-active --quiet nginx 2>/dev/null; then
  NGINX_OK=1
fi

# Processes top by memory
TOP_PROCS=$(ps aux --sort=-%mem 2>/dev/null | awk 'NR>1 && NR<=6 {printf "%s|%s|%s|%s\\n",$2,$3,$4,$11}')

printf 'HOST=%s\\n' "$HOSTNAME"
printf 'OS=%s\\n' "$OS"
printf 'KERNEL=%s\\n' "$KERNEL"
printf 'UPTIME=%s\\n' "$UPTIME"
printf 'ARCH=%s\\n' "$ARCH"
printf 'CPU_CORES=%s\\n' "$CPU_CORES"
printf 'CPU_MODEL=%s\\n' "$CPU_MODEL"
printf 'CPU_USAGE=%s\\n' "$CPU_USAGE"
printf 'MEM_TOTAL=%s\\n' "$MEM_TOTAL"
printf 'MEM_USED=%s\\n' "$MEM_USED"
printf 'MEM_AVAIL=%s\\n' "$MEM_AVAIL"
printf 'SWAP_TOTAL=%s\\n' "$SWAP_TOTAL"
printf 'SWAP_USED=%s\\n' "$SWAP_USED"
printf 'DISK=%s\\n' "$DISK_LINE"
printf 'LOAD=%s\\n' "$LOAD"
printf 'IP=%s\\n' "$IP"
printf 'DOCKER_OK=%s\\n' "$DOCKER_OK"
printf 'DOCKER_VER=%s\\n' "$DOCKER_VER"
printf 'NODE_OK=%s\\n' "$NODE_OK"
printf 'NODE_VER=%s\\n' "$NODE_VER"
printf 'NGINX_OK=%s\\n' "$NGINX_OK"
printf 'TOP_PROCS_BEGIN\\n'
printf '%s' "$TOP_PROCS"
printf 'TOP_PROCS_END\\n'
`;

  const result = await sshPool.exec(serverId, script);
  if (result.code !== 0 && !result.stdout) {
    throw new Error(result.stderr || '获取系统信息失败，请确认服务器已连接且系统为 Linux');
  }

  const lines = result.stdout.split('\n');
  const map: Record<string, string> = {};
  let inProcs = false;
  const procs: string[] = [];

  for (const line of lines) {
    if (line === 'TOP_PROCS_BEGIN') {
      inProcs = true;
      continue;
    }
    if (line === 'TOP_PROCS_END') {
      inProcs = false;
      continue;
    }
    if (inProcs) {
      if (line.trim()) procs.push(line);
      continue;
    }
    const idx = line.indexOf('=');
    if (idx > 0) {
      map[line.slice(0, idx)] = line.slice(idx + 1);
    }
  }

  const diskParts = (map.DISK || '0,0,0,0%').split(',');
  const loadParts = (map.LOAD || '0,0,0').split(',');

  const processes = procs.map((p) => {
    const [pid, cpu, mem, ...cmd] = p.split('|');
    return {
      pid,
      cpu: num(cpu),
      mem: num(mem),
      command: cmd.join('|'),
    };
  });

  return {
    hostname: map.HOST || '',
    os: map.OS || '',
    kernel: map.KERNEL || '',
    uptime: map.UPTIME || '',
    arch: map.ARCH || '',
    ip: map.IP || '',
    cpu: {
      cores: num(map.CPU_CORES),
      model: map.CPU_MODEL || '',
      usage: Math.min(100, Math.max(0, num(map.CPU_USAGE))),
    },
    memory: {
      totalKb: num(map.MEM_TOTAL),
      usedKb: num(map.MEM_USED),
      availableKb: num(map.MEM_AVAIL),
      usagePercent:
        num(map.MEM_TOTAL) > 0
          ? Math.round((num(map.MEM_USED) / num(map.MEM_TOTAL)) * 1000) / 10
          : 0,
    },
    swap: {
      totalKb: num(map.SWAP_TOTAL),
      usedKb: num(map.SWAP_USED),
    },
    disk: {
      totalKb: num(diskParts[0]),
      usedKb: num(diskParts[1]),
      availableKb: num(diskParts[2]),
      usagePercent: num(String(diskParts[3] || '0').replace('%', '')),
    },
    load: {
      m1: num(loadParts[0]),
      m5: num(loadParts[1]),
      m15: num(loadParts[2]),
    },
    tools: {
      docker: { installed: map.DOCKER_OK === '1', version: map.DOCKER_VER || '' },
      node: { installed: map.NODE_OK === '1', version: map.NODE_VER || '' },
      nginx: { installed: map.NGINX_OK === '1' },
    },
    processes,
    collectedAt: new Date().toISOString(),
  };
}

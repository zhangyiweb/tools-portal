const os = require('os');

function isIPv4(net) {
  return net.family === 'IPv4' || net.family === 4;
}

function getLocalIp() {
  const nets = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (!isIPv4(net) || net.internal) continue;
      candidates.push(net.address);
    }
  }

  if (candidates.length === 0) return '127.0.0.1';

  // 优先返回常见局域网网段地址
  const preferred = candidates.find((ip) =>
    ip.startsWith('192.168.') || ip.startsWith('10.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
  return preferred || candidates[0];
}

module.exports = { getLocalIp };

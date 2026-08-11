/** 将 ssh2 / Node 网络英文错误转为中文说明 */
export function translateError(raw: string): string {
  const msg = (raw || '').trim();
  if (!msg) return '未知错误';

  const rules: [RegExp | string, string][] = [
    [
      /Timed out while waiting for handshake/i,
      'SSH 握手超时：请检查主机地址、端口是否正确，以及云厂商安全组/防火墙是否放行 SSH（默认 22）。也可确认本机网络能否访问该服务器。',
    ],
    [
      /All configured authentication methods failed/i,
      '认证失败：用户名、密码或私钥不正确，请核对后再试。',
    ],
    [/Authentication failed/i, '认证失败：用户名、密码或私钥不正确。'],
    [
      /Encrypted private key detected, but no passphrase given/i,
      '私钥已加密，请填写私钥口令。',
    ],
    [/Cannot parse privateKey|Invalid private key/i, '私钥格式无效，请粘贴完整的 PEM / OpenSSH 私钥内容。'],
    [/connect ECONNREFUSED/i, '连接被拒绝：目标端口未开放，或该地址上没有 SSH 服务。请确认端口（默认 22）。'],
    [/connect ETIMEDOUT|connect EHOSTUNREACH/i, '无法连通主机：请检查 IP/域名、网络，以及安全组是否放行。'],
    [/getaddrinfo ENOTFOUND|getaddrinfo EAI_AGAIN/i, '无法解析主机名，请检查域名是否正确。'],
    [/ENETUNREACH/i, '网络不可达，请检查本机网络或 VPN。'],
    [/ECONNRESET/i, '连接被对端重置，请稍后重试或检查服务器 SSH 服务状态。'],
    [
      /permission denied while trying to connect to the Docker daemon|Cannot connect to the Docker daemon/i,
      'Docker 权限不足：请将当前用户加入 docker 组后，断开并重新连接 SSH。',
    ],
    [/Permission denied/i, '权限被拒绝：账号或密钥无权限登录。'],
    [/No such container/i, '找不到该容器，请刷新列表后重试。'],
    [/port is already allocated|Bind for .* failed/i, '端口已被占用，请先停止占用该端口的容器或进程。'],
    [/No response from server/i, '服务器无响应，请检查 SSH 服务是否运行、端口是否正确。'],
    [/Connection lost/i, '连接已断开。'],
    [/Not connected|服务器未连接/i, '服务器未连接，请先在「服务器」页建立连接。'],
    [/命令执行超时/, '命令执行超时，请稍后重试或检查服务器负载。'],
    [/连接超时/, '连接超时：请检查网络与 SSH 端口。'],
  ];

  for (const [pattern, text] of rules) {
    if (typeof pattern === 'string') {
      if (msg.includes(pattern)) return text;
    } else if (pattern.test(msg)) {
      return text;
    }
  }

  if (/[\u4e00-\u9fff]/.test(msg)) return msg;

  return `连接失败：${msg}`;
}

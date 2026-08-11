const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const POWERSHELL = 'powershell.exe';

// 仅控制 Windows「专用网络」配置文件的防火墙
const TARGET_PROFILE = 'Private';
const TARGET_PROFILE_LABEL = '专用网络';

function isWindows() {
  return process.platform === 'win32';
}

async function runPowerShell(script) {
  const { stdout, stderr } = await execFileAsync(
    POWERSHELL,
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { windowsHide: true, maxBuffer: 1024 * 1024 }
  );
  return (stdout || stderr || '').trim();
}

async function getFirewallStatus() {
  if (!isWindows()) {
    return { supported: false, enabled: false, profile: TARGET_PROFILE, profileLabel: TARGET_PROFILE_LABEL };
  }

  const out = await runPowerShell(
    'Get-NetFirewallProfile | Select-Object Name, Enabled | ConvertTo-Json -Compress'
  );
  let profiles = JSON.parse(out);
  if (!Array.isArray(profiles)) profiles = [profiles];

  const privateProfile = profiles.find((p) => p.Name === TARGET_PROFILE);
  const enabled = privateProfile ? !!privateProfile.Enabled : false;

  return {
    supported: true,
    profile: TARGET_PROFILE,
    profileLabel: TARGET_PROFILE_LABEL,
    enabled
  };
}

async function setFirewallEnabled(targetEnabled) {
  if (!isWindows()) {
    throw new Error('仅支持 Windows 系统。');
  }

  const state = targetEnabled ? 'on' : 'off';
  const script = [
    `$p = Start-Process -FilePath netsh -ArgumentList 'advfirewall','set','privateprofile','state','${state}' -Verb RunAs -PassThru -Wait -WindowStyle Hidden`,
    'if ($null -eq $p) { exit 1 }',
    'exit $p.ExitCode'
  ].join('; ');

  try {
    await runPowerShell(script);
  } catch {
    throw new Error('操作失败，请在弹出的管理员授权窗口中点击「是」。');
  }

  const status = await getFirewallStatus();
  const wantOn = !!targetEnabled;

  if (wantOn && !status.enabled) {
    throw new Error('专用网络防火墙未能成功开启，可能已取消管理员授权。');
  }
  if (!wantOn && status.enabled) {
    throw new Error('专用网络防火墙未能成功关闭，可能已取消管理员授权。');
  }

  return status;
}

module.exports = { getFirewallStatus, setFirewallEnabled };

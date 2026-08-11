let state = null;
let nginxRunning = false;
let firewallEnabled = false;
let localIp = '127.0.0.1';

const elList = document.getElementById('projectList');
const elEmpty = document.getElementById('emptyTip');
const elAccessHint = document.getElementById('accessHint');
const elStatus = document.getElementById('nginxStatus');
const elStatusText = elStatus.querySelector('.status-text');
const btnNginxToggle = document.getElementById('btnNginxToggle');
const elFirewallStatus = document.getElementById('firewallStatus');
const elFirewallStatusText = elFirewallStatus.querySelector('.status-text');
const btnFirewallToggle = document.getElementById('btnFirewallToggle');

if (!window.api) {
  elStatusText.textContent = '状态：初始化失败（预加载未注入 api）';
  alert('初始化失败：预加载未注入 window.api。请关闭所有窗口后重新运行 npm run dev；如果仍失败，我会继续帮你排查。');
  throw new Error('window.api is undefined');
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function refreshLocalIp() {
  const res = await window.api.getLocalIp();
  if (res?.ok && res.ip) {
    localIp = res.ip;
    elAccessHint.innerHTML = `提示：每个项目一个端口，打开后用浏览器访问 <code>http://${escapeHtml(localIp)}:端口</code>`;
  }
}

async function refresh() {
  await refreshLocalIp();
  state = await window.api.getState();
  render();
  await Promise.all([refreshNginxStatus(), refreshFirewallStatus()]);
}

function updateNginxUI(running, pid) {
  nginxRunning = running;
  elStatus.classList.toggle('running', running);
  elStatus.classList.toggle('stopped', !running);

  if (running) {
    elStatusText.textContent = `Nginx 运行中（PID ${pid}）`;
    btnNginxToggle.textContent = '停止 Nginx';
    btnNginxToggle.className = 'btn danger';
  } else {
    elStatusText.textContent = 'Nginx 未运行';
    btnNginxToggle.textContent = '启动 Nginx';
    btnNginxToggle.className = 'btn primary';
  }
  btnNginxToggle.disabled = false;
}

async function refreshNginxStatus() {
  const res = await window.api.nginxStatus();
  if (!res?.ok) {
    elStatusText.textContent = '状态：获取失败';
    btnNginxToggle.disabled = false;
    return;
  }
  updateNginxUI(res.status.running, res.status.pid);
}

function updateFirewallUI(status) {
  if (!status?.supported) {
    elFirewallStatus.className = 'pill stopped';
    elFirewallStatusText.textContent = '专用网络防火墙：当前系统不支持';
    btnFirewallToggle.textContent = '不可用';
    btnFirewallToggle.disabled = true;
    return;
  }

  firewallEnabled = !!status.enabled;

  elFirewallStatus.classList.remove('running', 'stopped', 'warning');
  if (firewallEnabled) {
    elFirewallStatus.classList.add('running');
    elFirewallStatusText.textContent = '专用网络防火墙：已开启';
    btnFirewallToggle.textContent = '关闭专用网络防火墙';
    btnFirewallToggle.className = 'btn danger';
  } else {
    elFirewallStatus.classList.add('stopped');
    elFirewallStatusText.textContent = '专用网络防火墙：已关闭';
    btnFirewallToggle.textContent = '开启专用网络防火墙';
    btnFirewallToggle.className = 'btn primary';
  }
  btnFirewallToggle.disabled = false;
}

async function refreshFirewallStatus() {
  const res = await window.api.firewallStatus();
  if (!res?.ok) {
    elFirewallStatusText.textContent = '专用网络防火墙：获取失败';
    btnFirewallToggle.disabled = false;
    return;
  }
  updateFirewallUI(res.status);
}

function startRename(item, project) {
  const nameEl = item.querySelector('.name');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'name-input';
  input.value = project.name;
  input.maxLength = 64;
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  const finish = async (save) => {
    if (save) {
      const newName = input.value.trim();
      if (!newName) {
        alert('项目名称不能为空。');
        input.focus();
        return;
      }
      if (newName !== project.name) {
        const res = await window.api.renameProject(project.id, newName);
        if (!res.ok) {
          alert(res.error || '重命名失败');
          await refresh();
          return;
        }
      }
    }
    await refresh();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
}

function render() {
  const projects = state?.projects || [];
  elList.innerHTML = '';
  elEmpty.style.display = projects.length ? 'none' : 'block';

  for (const p of projects) {
    const item = document.createElement('div');
    item.className = 'item';
    const toggleLabel = p.enabled ? '关闭' : '开启';
    const toggleClass = p.enabled ? 'btn success' : 'btn';
    item.innerHTML = `
      <div class="meta">
        <div class="name-row">
          <div class="name">${escapeHtml(p.name)}</div>
          <button class="btn-icon" data-rename="${p.id}" title="重命名">✎</button>
        </div>
        <div class="sub">端口：<code>${p.port}</code>　访问：<code>http://${escapeHtml(localIp)}:${p.port}</code></div>
        <div class="sub">目录：<code title="${escapeHtml(p.distPath)}">${escapeHtml(p.distPath)}</code></div>
      </div>
      <button class="${toggleClass}" data-toggle="${p.id}">${toggleLabel}</button>
      <button class="btn" data-remove="${p.id}">移除</button>
    `;
    elList.appendChild(item);
  }

  elList.querySelectorAll('button[data-toggle]').forEach((el) => {
    el.addEventListener('click', async () => {
      const id = el.getAttribute('data-toggle');
      const project = (state?.projects || []).find((x) => x.id === id);
      if (!project) return;
      const res = await window.api.toggleProject(id, !project.enabled);
      if (!res.ok) alert(res.error || '切换失败');
      await refresh();
    });
  });

  elList.querySelectorAll('button[data-rename]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-rename');
      const project = (state?.projects || []).find((x) => x.id === id);
      if (!project) return;
      const item = el.closest('.item');
      startRename(item, project);
    });
  });

  elList.querySelectorAll('.name').forEach((el) => {
    el.addEventListener('dblclick', () => {
      const item = el.closest('.item');
      const id = item.querySelector('button[data-rename]')?.getAttribute('data-rename');
      const project = (state?.projects || []).find((x) => x.id === id);
      if (project) startRename(item, project);
    });
  });

  elList.querySelectorAll('button[data-remove]').forEach((el) => {
    el.addEventListener('click', async () => {
      const id = el.getAttribute('data-remove');
      const res = await window.api.removeProject(id);
      if (!res.ok) alert(res.error || '移除失败');
      await refresh();
    });
  });
}

document.getElementById('btnAdd').addEventListener('click', async () => {
  const res = await window.api.addProject();
  if (!res.ok) alert(res.error || '添加失败');
  await refresh();
});

btnNginxToggle.addEventListener('click', async () => {
  btnNginxToggle.disabled = true;
  try {
    const res = nginxRunning ? await window.api.nginxStop() : await window.api.nginxStart();
    if (!res.ok) {
      alert(res.error || (nginxRunning ? '停止失败' : '启动失败'));
    } else if (res.status) {
      updateNginxUI(res.status.running, res.status.pid);
    }
  } catch (e) {
    alert(`${nginxRunning ? '停止' : '启动'}失败：${e.message || e}`);
  } finally {
    await refreshNginxStatus();
  }
});

btnFirewallToggle.addEventListener('click', async () => {
  const turningOff = firewallEnabled;
  if (turningOff) {
    const ok = confirm('关闭专用网络防火墙会降低该网络环境下的安全性，确定要关闭吗？');
    if (!ok) return;
  }

  btnFirewallToggle.disabled = true;
  try {
    const res = await window.api.firewallSet(!firewallEnabled);
    if (!res.ok) {
      alert(res.error || '防火墙切换失败');
    } else if (res.status) {
      updateFirewallUI(res.status);
    }
  } catch (e) {
    alert(`防火墙切换失败：${e.message || e}`);
  }
  await refreshFirewallStatus();
});

document.getElementById('btnOpenData').addEventListener('click', async () => {
  await window.api.openDataDir();
});

refresh();

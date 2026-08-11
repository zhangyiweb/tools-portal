(() => {
  const state = {
    tab: 'installed',
    installed: [],
    available: [],
    availableLoaded: false,
    current: null,
    arch: null,
    search: '',
    ltsOnly: false,
    busy: false,
    nvmOk: false,
  };

  const $ = (id) => document.getElementById(id);

  const els = {
    statusPill: $('statusPill'),
    statusText: $('statusText'),
    currentVersion: $('currentVersion'),
    currentArch: $('currentArch'),
    searchInput: $('searchInput'),
    ltsOnly: $('ltsOnly'),
    ltsFilterWrap: $('ltsFilterWrap'),
    listEmpty: $('listEmpty'),
    versionList: $('versionList'),
    busyOverlay: $('busyOverlay'),
    busyText: $('busyText'),
    toastArea: $('toastArea'),
    nvmMissing: $('nvmMissing'),
    btnInstallNvm: $('btnInstallNvm'),
    btnUpdateNvm: $('btnUpdateNvm'),
    app: document.querySelector('.app'),
  };

  let toastTimer = null;
  let offProgress = null;

  function toast(message, type = '') {
    els.toastArea.innerHTML = '';
    const el = document.createElement('div');
    el.className = `toast ${type}`.trim();
    el.textContent = message;
    els.toastArea.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toastArea.innerHTML = '';
    }, 5200);
  }

  function setBusy(on, text) {
    state.busy = on;
    els.busyOverlay.hidden = !on;
    els.busyOverlay.classList.toggle('is-on', on);
    if (text) els.busyText.textContent = text;
    document.querySelectorAll('button').forEach((btn) => {
      if (btn.dataset.keepEnabled) return;
      btn.disabled = on;
    });
  }

  function setNvmPresence(ok, message) {
    state.nvmOk = ok;
    els.btnInstallNvm.hidden = ok;
    els.btnUpdateNvm.hidden = !ok;
    els.nvmMissing.hidden = ok;
    els.app.classList.toggle('has-nvm-missing', !ok);

    const nodeOpsDisabled = !ok;
    ['btnInstallCustom', 'btnInstallLts', 'btnInstallLatest', 'customVersion'].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.disabled = nodeOpsDisabled;
    });

    if (!ok) {
      els.listEmpty.hidden = false;
      els.versionList.hidden = true;
      els.listEmpty.textContent = message || '请先安装 nvm-windows';
      els.currentVersion.textContent = '—';
      els.currentArch.textContent = '';
    }
  }

  function installedSet() {
    return new Set(state.installed.map((v) => v.version));
  }

  function filteredRows() {
    const q = state.search.trim().toLowerCase();
    if (state.tab === 'installed') {
      return state.installed.filter((v) => !q || v.version.includes(q));
    }
    return state.available.filter((v) => {
      if (q && !v.version.includes(q) && !(v.lts || '').toLowerCase().includes(q)) return false;
      if (state.ltsOnly && !v.lts) return false;
      return true;
    });
  }

  function renderList() {
    if (!state.nvmOk) {
      els.versionList.hidden = true;
      els.listEmpty.hidden = false;
      els.listEmpty.textContent = '请先安装 nvm-windows';
      return;
    }

    const rows = filteredRows();
    const installed = installedSet();

    if (!rows.length) {
      els.versionList.hidden = true;
      els.listEmpty.hidden = false;
      els.listEmpty.textContent =
        state.tab === 'installed' ? '暂无已安装版本' : '没有匹配的可安装版本';
      return;
    }

    els.listEmpty.hidden = true;
    els.versionList.hidden = false;
    els.versionList.innerHTML = '';

    const limit = state.tab === 'available' && !state.search && !state.ltsOnly ? 80 : rows.length;
    const slice = rows.slice(0, limit);

    for (const item of slice) {
      const li = document.createElement('li');
      const isActive = state.tab === 'installed'
        ? item.active || item.version === state.current
        : item.version === state.current;
      const isInstalled = state.tab === 'available' && installed.has(item.version);

      li.className = `version-row${isActive ? ' active' : ''}`;

      const meta = document.createElement('div');
      meta.className = 'version-meta';

      const num = document.createElement('div');
      num.className = 'version-num';
      num.appendChild(document.createTextNode(`v${item.version}`));

      if (isActive) {
        const badge = document.createElement('span');
        badge.className = 'badge badge-current';
        badge.textContent = '当前';
        num.appendChild(badge);
      }
      if (item.lts) {
        const badge = document.createElement('span');
        badge.className = 'badge badge-lts';
        badge.textContent = `LTS · ${item.lts}`;
        num.appendChild(badge);
      }
      if (isInstalled) {
        const badge = document.createElement('span');
        badge.className = 'badge badge-current';
        badge.textContent = '已安装';
        num.appendChild(badge);
      }

      meta.appendChild(num);

      if (item.date || item.npm) {
        const sub = document.createElement('div');
        sub.className = 'version-sub';
        const parts = [];
        if (item.date) parts.push(item.date);
        if (item.npm) parts.push(`npm ${item.npm}`);
        sub.textContent = parts.join(' · ');
        meta.appendChild(sub);
      }

      const actions = document.createElement('div');
      actions.className = 'row-actions';

      if (state.tab === 'installed') {
        const useBtn = document.createElement('button');
        useBtn.type = 'button';
        useBtn.className = 'btn btn-use';
        useBtn.textContent = isActive ? '使用中' : '使用';
        useBtn.disabled = isActive || state.busy;
        useBtn.addEventListener('click', () => onUse(item.version));
        actions.appendChild(useBtn);

        const rmBtn = document.createElement('button');
        rmBtn.type = 'button';
        rmBtn.className = 'btn btn-danger';
        rmBtn.textContent = '卸载';
        rmBtn.disabled = state.busy;
        rmBtn.addEventListener('click', () => onUninstall(item.version));
        actions.appendChild(rmBtn);
      } else {
        const instBtn = document.createElement('button');
        instBtn.type = 'button';
        instBtn.className = 'btn btn-install';
        instBtn.textContent = isInstalled ? '重新安装' : '安装';
        instBtn.disabled = state.busy;
        instBtn.addEventListener('click', () => onInstall(item.version));
        actions.appendChild(instBtn);

        if (isInstalled) {
          const useBtn = document.createElement('button');
          useBtn.type = 'button';
          useBtn.className = 'btn btn-use';
          useBtn.textContent = isActive ? '使用中' : '使用';
          useBtn.disabled = isActive || state.busy;
          useBtn.addEventListener('click', () => onUse(item.version));
          actions.appendChild(useBtn);
        }
      }

      li.appendChild(meta);
      li.appendChild(actions);
      els.versionList.appendChild(li);
    }

    if (slice.length < rows.length) {
      const tip = document.createElement('li');
      tip.className = 'version-row';
      tip.innerHTML = `<div class="version-meta"><div class="version-sub">已显示前 ${slice.length} 个，共 ${rows.length} 个。请用搜索缩小范围。</div></div>`;
      els.versionList.appendChild(tip);
    }
  }

  async function refreshAll() {
    setBusy(true, '刷新中…');
    try {
      const check = await window.nvmApi.check();
      if (!check.ok) {
        els.statusPill.className = 'status-pill err';
        els.statusText.textContent = '未安装 nvm';
        setNvmPresence(false, check.message);
        toast(check.message || '未检测到 nvm', 'err');
        return;
      }

      setNvmPresence(true);
      els.statusPill.className = 'status-pill ok';
      els.statusText.textContent = `nvm ${check.version}`;

      const [status, installed] = await Promise.all([
        window.nvmApi.status(),
        window.nvmApi.listInstalled(),
      ]);

      state.current = status.current;
      state.arch = status.arch;
      state.installed = installed.map((v) => ({
        ...v,
        active: v.active || v.version === status.current,
      }));

      els.currentVersion.textContent = status.current ? `v${status.current}` : '未选择';
      els.currentArch.textContent = status.arch || '';

      if (state.tab === 'available') {
        await ensureAvailable();
      }
      renderList();
    } catch (err) {
      toast(err.message || '刷新失败', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function ensureAvailable() {
    if (state.availableLoaded) return;
    els.listEmpty.hidden = false;
    els.listEmpty.textContent = '正在拉取可安装版本…';
    els.versionList.hidden = true;
    const list = await window.nvmApi.listAvailable();
    state.available = list;
    state.availableLoaded = true;
  }

  async function onInstall(version) {
    setBusy(true, `正在安装 ${version}…`);
    try {
      const res = await window.nvmApi.install(version);
      toast(res.message || (res.ok ? '安装完成' : '安装失败'), res.ok ? 'ok' : 'err');
      await softRefresh();
    } catch (err) {
      toast(err.message || '安装失败', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function onUninstall(version) {
    const ok = window.confirm(`确定卸载 Node v${version}？`);
    if (!ok) return;
    setBusy(true, `正在卸载 ${version}…`);
    try {
      const res = await window.nvmApi.uninstall(version);
      toast(res.message || (res.ok ? '卸载完成' : '卸载失败'), res.ok ? 'ok' : 'err');
      await softRefresh();
    } catch (err) {
      toast(err.message || '卸载失败', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function onUse(version) {
    setBusy(true, `切换到 ${version}…`);
    try {
      const res = await window.nvmApi.use(version);
      toast(res.message || (res.ok ? '已切换' : '切换失败'), res.ok ? 'ok' : 'err');
      await softRefresh();
    } catch (err) {
      toast(err.message || '切换失败', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function softRefresh() {
    const [status, installed] = await Promise.all([
      window.nvmApi.status(),
      window.nvmApi.listInstalled(),
    ]);
    state.current = status.current;
    state.arch = status.arch;
    state.installed = installed.map((v) => ({
      ...v,
      active: v.active || v.version === status.current,
    }));
    els.currentVersion.textContent = status.current ? `v${status.current}` : '未选择';
    els.currentArch.textContent = status.arch || '';
    renderList();
  }

  async function onInstallNvm() {
    setBusy(true, '正在下载 nvm-windows…');
    if (offProgress) offProgress();
    offProgress = window.nvmApi.onProgress((p) => {
      if (p && p.text) els.busyText.textContent = p.text;
    });
    try {
      const res = await window.nvmApi.installManager();
      toast(res.message || (res.ok ? '已打开安装程序' : '安装失败'), res.ok ? 'ok' : 'err');
    } catch (err) {
      toast(err.message || '安装失败', 'err');
    } finally {
      if (offProgress) offProgress();
      offProgress = null;
      setBusy(false);
    }
  }

  async function onUpdateNvm() {
    const ok = window.confirm('将尝试更新 nvm-windows 到最新版，是否继续？');
    if (!ok) return;
    setBusy(true, '正在更新 nvm…');
    if (offProgress) offProgress();
    offProgress = window.nvmApi.onProgress((p) => {
      if (p && p.text) els.busyText.textContent = p.text;
    });
    try {
      const res = await window.nvmApi.updateManager();
      toast(res.message || (res.ok ? '更新完成' : '更新失败'), res.ok ? 'ok' : 'err');
      await refreshAll();
    } catch (err) {
      toast(err.message || '更新失败', 'err');
    } finally {
      if (offProgress) offProgress();
      offProgress = null;
      setBusy(false);
    }
  }

  function setTab(tab) {
    state.tab = tab;
    document.querySelectorAll('.tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    els.ltsFilterWrap.hidden = tab !== 'available';
    els.searchInput.placeholder = tab === 'available' ? '搜索版本 / LTS 名称…' : '搜索版本号…';

    (async () => {
      if (!state.nvmOk) {
        renderList();
        return;
      }
      if (tab === 'available') {
        setBusy(true, '加载可安装版本…');
        try {
          await ensureAvailable();
          renderList();
        } catch (err) {
          toast(err.message || '加载失败', 'err');
        } finally {
          setBusy(false);
        }
      } else {
        renderList();
      }
    })();
  }

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => setTab(tab.dataset.tab));
  });

  els.searchInput.addEventListener('input', () => {
    state.search = els.searchInput.value;
    renderList();
  });

  els.ltsOnly.addEventListener('change', () => {
    state.ltsOnly = els.ltsOnly.checked;
    renderList();
  });

  $('btnRefresh').addEventListener('click', () => {
    state.availableLoaded = false;
    refreshAll();
  });

  $('btnInstallLts').addEventListener('click', () => onInstall('lts'));
  $('btnInstallLatest').addEventListener('click', () => onInstall('latest'));
  els.btnInstallNvm.addEventListener('click', onInstallNvm);
  $('btnInstallNvmHero').addEventListener('click', onInstallNvm);
  els.btnUpdateNvm.addEventListener('click', onUpdateNvm);

  $('btnInstallCustom').addEventListener('click', () => {
    const raw = $('customVersion').value.trim();
    if (!raw) {
      toast('请输入版本号', 'err');
      return;
    }
    onInstall(raw);
  });

  $('customVersion').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('btnInstallCustom').click();
  });

  refreshAll();
})();

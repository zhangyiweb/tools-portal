import { fetchAllHdris, fetchHdriCategories, fetchHdriUrl, downloadHdri, DEFAULT_RESOLUTION } from './polyhaven.js';
import { categoryLabel } from './categories.js';
import { HdriScene } from './scene.js';
import { setupGui } from './gui.js';
import { initMaterialEditor } from './materialEditor.js';

const PAGE_SIZE = 20;

const $ = (sel) => document.querySelector(sel);

const gridEl = $('#grid');
const statusEl = $('#status');
const searchEl = $('#search');
const categoryEl = $('#category');
const loadingEl = $('#loading');
const currentNameEl = $('#current-name');
const resolutionSelectEl = $('#resolution-select');
const downloadBtnEl = $('#download-btn');
const modelListEl = $('#model-list');
const fileInputEl = $('#file-input');
const importBtnEl = $('#import-btn');
const exportBtnEl = $('#export-btn');
const toggleEnvironmentEl = $('#toggle-environment');
const toggleBackgroundEl = $('#toggle-background');
const hdriPlaceholderEl = $('#hdri-placeholder');

const hdriScene = new HdriScene($('#canvas'));
setupGui(hdriScene);

const materialEditor = initMaterialEditor(hdriScene, {
  canvas: $('#canvas'),
  panel: $('#material-panel'),
  info: $('#material-panel-info'),
  guiContainer: $('#material-panel-gui'),
  closeBtn: $('#material-panel-close'),
});

let allHdris = [];
let filteredHdris = [];
let activeId = null;
let activeItem = null;
let visibleCount = PAGE_SIZE;
let currentResolution = DEFAULT_RESOLUTION;
let currentHdriUrl = null;
let isLoadingMore = false;

function createCard(item) {
  const card = document.createElement('div');
  card.className = 'hdri-card' + (item.id === activeId ? ' active' : '');
  card.dataset.id = item.id;
  card.title = item.name;

  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'thumb-wrap';

  const skeleton = document.createElement('div');
  skeleton.className = 'thumb-skeleton';

  const img = document.createElement('img');
  img.src = item.thumbnail_url;
  img.alt = item.name;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  img.addEventListener('load', () => {
    skeleton.remove();
    img.classList.add('loaded');
  }, { once: true });
  if (item.fallback_thumbnail) {
    img.addEventListener('error', () => {
      if (img.src !== item.fallback_thumbnail) {
        img.src = item.fallback_thumbnail;
      }
    }, { once: true });
  }

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = item.name;

  thumbWrap.append(skeleton, img, label);
  card.append(thumbWrap);
  card.addEventListener('click', () => selectHdri(item));
  return card;
}

function updateStatus() {
  if (filteredHdris.length === 0) {
    statusEl.textContent = '没有匹配的 HDRI';
    return;
  }
  statusEl.textContent = `已加载 ${Math.min(visibleCount, filteredHdris.length)} / ${filteredHdris.length} 个 · 滚动查看更多`;
}

function renderGrid(reset = false) {
  if (reset) {
    visibleCount = PAGE_SIZE;
    gridEl.innerHTML = '';
    gridEl.scrollTop = 0;
  }

  if (filteredHdris.length === 0) {
    gridEl.innerHTML = '';
    updateStatus();
    return;
  }

  const slice = filteredHdris.slice(0, visibleCount);
  const existingIds = new Set([...gridEl.querySelectorAll('.hdri-card')].map((el) => el.dataset.id));

  const frag = document.createDocumentFragment();
  for (const item of slice) {
    if (existingIds.has(item.id)) continue;
    frag.appendChild(createCard(item));
  }
  gridEl.appendChild(frag);

  document.querySelectorAll('.hdri-card').forEach((el) => {
    el.classList.toggle('active', el.dataset.id === activeId);
  });

  updateStatus();
}

function getFiltered() {
  const q = searchEl.value.trim().toLowerCase();
  const cat = categoryEl.value;

  return allHdris.filter((h) => {
    if (cat && !h.categories.includes(cat)) return false;
    if (!q) return true;
    const haystack = [h.name, ...h.tags, ...h.categories.map(categoryLabel)].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

function refreshGrid() {
  filteredHdris = getFiltered();
  renderGrid(true);
}

function tryLoadMore() {
  if (isLoadingMore || visibleCount >= filteredHdris.length) return;
  isLoadingMore = true;
  visibleCount = Math.min(visibleCount + PAGE_SIZE, filteredHdris.length);
  renderGrid(false);
  isLoadingMore = false;
}

function onGridScroll() {
  const { scrollTop, clientHeight, scrollHeight } = gridEl;
  if (scrollTop + clientHeight >= scrollHeight - 120) {
    tryLoadMore();
  }
}

function updatePlaceholder() {
  setPlaceholderVisible(!hdriScene.hasContent());
}

function setPlaceholderVisible(visible) {
  hdriPlaceholderEl.classList.toggle('hidden', !visible);
}

async function loadHdriEnvironment(item) {
  activeId = item.id;
  activeItem = item;
  currentHdriUrl = null;
  downloadBtnEl.disabled = true;
  setPlaceholderVisible(false);

  document.querySelectorAll('.hdri-card').forEach((el) => {
    el.classList.toggle('active', el.dataset.id === item.id);
  });

  currentNameEl.textContent = item.name;
  loadingEl.classList.remove('hidden');

  try {
    const { url, resolution } = await fetchHdriUrl(item.id, currentResolution);
    currentHdriUrl = url;
    downloadBtnEl.disabled = false;
    await hdriScene.loadEnvironment(url);
    if (resolution !== currentResolution) {
      resolutionSelectEl.value = resolution;
      currentResolution = resolution;
    }
  } catch (err) {
    console.error(err);
    currentNameEl.textContent = `加载失败: ${item.name}`;
    updatePlaceholder();
  } finally {
    loadingEl.classList.add('hidden');
  }
}

async function selectHdri(item) {
  setPlaceholderVisible(false);
  if (activeId === item.id) return;
  await loadHdriEnvironment(item);
}

async function reloadCurrentHdri() {
  if (!activeItem) return;
  await loadHdriEnvironment(activeItem);
}

async function handleDownload() {
  if (!currentHdriUrl || !activeId) return;

  downloadBtnEl.disabled = true;
  const prevText = downloadBtnEl.textContent;
  downloadBtnEl.textContent = '下载中…';

  try {
    const filename = `${activeId}_${currentResolution}.hdr`;
    await downloadHdri(currentHdriUrl, filename);
  } catch (err) {
    console.error(err);
    alert(`下载失败: ${err.message}`);
  } finally {
    downloadBtnEl.disabled = !currentHdriUrl;
    downloadBtnEl.textContent = prevText;
  }
}

function updateExportButton() {
  exportBtnEl.disabled = hdriScene.importedModels.length === 0;
}

function renderModelList() {
  modelListEl.innerHTML = '';

  if (hdriScene.importedModels.length === 0) {
    modelListEl.innerHTML = '<li class="model-empty">尚未导入模型</li>';
    updateExportButton();
    return;
  }

  for (const model of hdriScene.importedModels) {
    const li = document.createElement('li');
    li.className = 'model-item';

    const name = document.createElement('span');
    name.className = 'model-name';
    name.textContent = model.name;
    name.title = model.name;

    const actions = document.createElement('div');
    actions.className = 'model-actions';

    const exportOneBtn = document.createElement('button');
    exportOneBtn.type = 'button';
    exportOneBtn.className = 'model-export';
    exportOneBtn.textContent = '导出';
    exportOneBtn.addEventListener('click', () => handleExportModel(model.id));

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'model-remove';
    removeBtn.textContent = '移除';
    removeBtn.addEventListener('click', () => {
      hdriScene.removeModel(model.id);
      renderModelList();
      updatePlaceholder();
      materialEditor.onModelRemoved();
    });

    actions.append(exportOneBtn, removeBtn);
    li.append(name, actions);
    modelListEl.appendChild(li);
  }

  updateExportButton();
}

async function handleExportModel(id) {
  try {
    await hdriScene.exportModel(id);
  } catch (err) {
    console.error(err);
    alert(`导出失败: ${err.message}`);
  }
}

async function handleExportAll() {
  exportBtnEl.disabled = true;
  const prevText = exportBtnEl.textContent;
  exportBtnEl.textContent = '导出中…';

  try {
    await hdriScene.exportAllModels();
  } catch (err) {
    console.error(err);
    alert(`导出失败: ${err.message}`);
  } finally {
    exportBtnEl.textContent = prevText;
    updateExportButton();
  }
}

async function handleImport(files) {
  const glbFiles = [...files].filter((f) => /\.(glb|gltf)$/i.test(f.name));
  if (glbFiles.length === 0) return;

  importBtnEl.disabled = true;
  importBtnEl.textContent = '导入中…';
  setPlaceholderVisible(false);

  try {
    for (const file of glbFiles) {
      await hdriScene.importModel(file);
    }
    renderModelList();
  } catch (err) {
    console.error(err);
    alert(`模型导入失败: ${err.message}`);
    updatePlaceholder();
  } finally {
    importBtnEl.disabled = false;
    importBtnEl.textContent = '导入 GLB 模型';
    fileInputEl.value = '';
  }
}

async function init() {
  try {
    const [hdris, categories] = await Promise.all([
      fetchAllHdris(),
      fetchHdriCategories(),
    ]);

    allHdris = hdris.sort((a, b) => a.name.localeCompare(b.name));

    for (const { name, count } of categories) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = `${categoryLabel(name)} (${count})`;
      categoryEl.appendChild(opt);
    }

    filteredHdris = allHdris;
    renderGrid(true);
    renderModelList();
    updatePlaceholder();
  } catch (err) {
    console.error(err);
    statusEl.textContent = `加载失败: ${err.message}`;
  }
}

searchEl.addEventListener('input', refreshGrid);
categoryEl.addEventListener('change', refreshGrid);
gridEl.addEventListener('scroll', onGridScroll);

resolutionSelectEl.addEventListener('change', (e) => {
  currentResolution = e.target.value;
  reloadCurrentHdri();
});

downloadBtnEl.addEventListener('click', handleDownload);

toggleEnvironmentEl.addEventListener('change', (e) => {
  hdriScene.setEnvironmentEnabled(e.target.checked);
});

toggleBackgroundEl.addEventListener('change', (e) => {
  hdriScene.setBackgroundEnabled(e.target.checked);
});

importBtnEl.addEventListener('click', () => fileInputEl.click());
exportBtnEl.addEventListener('click', handleExportAll);
fileInputEl.addEventListener('change', (e) => {
  if (e.target.files?.length) handleImport(e.target.files);
});

init();

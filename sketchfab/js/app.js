const API = "https://api.sketchfab.com/v3";
const TOKEN_KEY = "sketchfab_api_token";
const DEFAULT_TOKEN = "2f02690b5add2b268a565f9ba65c972b";

localStorage.setItem(TOKEN_KEY, DEFAULT_TOKEN);

const els = {
  q: document.getElementById("q"),
  searchForm: document.getElementById("searchForm"),
  category: document.getElementById("category"),
  sort: document.getElementById("sort"),
  downloadable: document.getElementById("downloadable"),
  grid: document.getElementById("grid"),
  status: document.getElementById("status"),
  loadHint: document.getElementById("loadHint"),
  sentinel: document.getElementById("sentinel"),
  modal: document.getElementById("modal"),
  modalTitle: document.getElementById("modalTitle"),
  modalAuthor: document.getElementById("modalAuthor"),
  viewer: document.getElementById("viewer"),
  downloadBtn: document.getElementById("downloadBtn"),
  fileLink: document.getElementById("fileLink"),
  openBtn: document.getElementById("openBtn"),
  closeModal: document.getElementById("closeModal"),
  settings: document.getElementById("settings"),
  openSettings: document.getElementById("openSettings"),
  closeSettings: document.getElementById("closeSettings"),
  saveToken: document.getElementById("saveToken"),
  tokenInput: document.getElementById("tokenInput"),
};

const LICENSE_MAP = {
  "CC Attribution": "知识共享署名",
  "CC Attribution-ShareAlike": "知识共享署名-相同方式共享",
  "CC Attribution-NoDerivs": "知识共享署名-禁止演绎",
  "CC Attribution-NonCommercial": "知识共享署名-非商业性使用",
  "CC Attribution-NonCommercial-ShareAlike": "知识共享署名-非商业性使用-相同方式共享",
  "CC Attribution-NonCommercial-NoDerivs": "知识共享署名-非商业性使用-禁止演绎",
  "CC0": "公共领域（CC0）",
  "Standard Digital File License": "标准数字文件许可",
  "Editorial": "仅供编辑使用",
};

const state = {
  next: null,
  models: [],
  loading: false,
  current: null,
  viewerClient: null,
};

function getToken() {
  return (localStorage.getItem(TOKEN_KEY) || DEFAULT_TOKEN).trim();
}

function authHeaders() {
  const token = getToken();
  if (!token) return {};
  const value = token.startsWith("Bearer ") || token.startsWith("Token ")
    ? token
    : `Token ${token}`;
  return { Authorization: value };
}

function pickThumb(model) {
  const images = model.thumbnails?.images || [];
  const sorted = [...images].sort((a, b) => (b.width || 0) - (a.width || 0));
  return sorted.find((img) => img.width >= 320 && img.width <= 1024)?.url
    || sorted.find((img) => img.width >= 256)?.url
    || sorted[0]?.url
    || "";
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function requestJson(url) {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`请求失败（${res.status}）`);
  }
  return res.json();
}

function cardHtml(model) {
  const thumb = pickThumb(model);
  const author = model.user?.displayName || model.user?.username || "未知作者";
  return `
    <article class="card" data-uid="${escapeHtml(model.uid)}">
      <div class="thumb">
        <img src="${escapeHtml(thumb)}" alt="${escapeHtml(model.name)}" loading="lazy">
      </div>
      <div class="meta">
        <h3>${escapeHtml(model.name)}</h3>
        <p>${escapeHtml(author)}</p>
      </div>
    </article>
  `;
}

function appendModels(results) {
  const start = state.models.length;
  state.models.push(...results);
  els.grid.insertAdjacentHTML("beforeend", results.map(cardHtml).join(""));
  const cards = els.grid.querySelectorAll(".card");
  for (let i = start; i < cards.length; i += 1) {
    cards[i].addEventListener("click", () => openModal(state.models[i]));
  }
}

function setHint(text) {
  els.loadHint.textContent = text;
}

function sentinelVisible() {
  const rect = els.sentinel.getBoundingClientRect();
  return rect.top < window.innerHeight + 400;
}

async function loadMore(reset) {
  if (state.loading) return;
  if (!reset && !state.next) return;

  state.loading = true;
  setHint("正在加载更多");

  let ok = false;
  try {
    if (reset) {
      state.models = [];
      state.next = buildSearchUrl();
      els.grid.innerHTML = "";
      els.status.textContent = "正在加载";
    }

    const url = state.next;
    if (!url) {
      setHint("没有更多了");
      return;
    }

    const data = await requestJson(url);
    const results = data.results || [];
    state.next = data.next || null;

    if (reset && !results.length) {
      els.grid.innerHTML = '<div class="empty">没有找到匹配的模型</div>';
      els.status.textContent = "没有结果";
      setHint("");
      return;
    }

    appendModels(results);
    els.status.textContent = `已加载 ${state.models.length} 个模型`;
    setHint(state.next ? "向下滚动加载更多" : "没有更多了");
    ok = true;
  } catch (err) {
    els.status.textContent = "加载失败";
    setHint(err.message || "加载失败");
    if (reset) {
      els.grid.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    }
  } finally {
    state.loading = false;
    if (ok && state.next && sentinelVisible()) {
      loadMore(false);
    }
  }
}

function search() {
  loadMore(true);
}

function buildSearchUrl() {
  const params = new URLSearchParams({
    type: "models",
    count: "24",
    archives_flavours: "false",
  });

  const query = els.q.value.trim();
  if (query) params.set("q", query);

  if (els.category.value) params.set("categories", els.category.value);
  if (els.sort.value) params.set("sort_by", els.sort.value);
  if (els.downloadable.checked) params.set("downloadable", "true");

  return `${API}/search?${params.toString()}`;
}

function resetViewerFrame() {
  if (state.viewerClient && typeof state.viewerClient.stop === "function") {
    try {
      state.viewerClient.stop();
    } catch (_) {
      /* ignore */
    }
  }
  state.viewerClient = null;

  const wrap = els.viewer.parentElement;
  const next = els.viewer.cloneNode(false);
  next.removeAttribute("src");
  wrap.replaceChild(next, els.viewer);
  els.viewer = next;
}

function openModal(model) {
  state.current = model;
  const author = model.user?.displayName || model.user?.username || "未知作者";
  const license = LICENSE_MAP[model.license?.label] || model.license?.label || "查看原站许可";
  els.modalTitle.textContent = model.name || "未命名模型";
  els.modalAuthor.textContent = `${author}  ·  ${license}`;
  els.openBtn.href = model.viewerUrl || `https://sketchfab.com/3d-models/${model.uid}`;
  els.downloadBtn.disabled = !model.isDownloadable;
  els.downloadBtn.textContent = model.isDownloadable ? "下载模型" : "不可下载";
  els.fileLink.hidden = true;
  els.fileLink.removeAttribute("href");
  els.modal.classList.add("show");

  resetViewerFrame();

  const embed = `https://sketchfab.com/models/${model.uid}/embed?autostart=1&ui_theme=dark&ui_infos=0&ui_controls=1&ui_watermark=1`;

  if (window.Sketchfab) {
    const client = new window.Sketchfab("1.12.1", els.viewer);
    client.init(model.uid, {
      success(api) {
        state.viewerClient = api;
        api.start();
      },
      error() {
        els.viewer.src = embed;
      },
      autostart: 1,
      ui_infos: 0,
      ui_controls: 1,
      ui_watermark: 1,
      ui_theme: "dark",
    });
  } else {
    els.viewer.src = embed;
  }
}

function closeModal() {
  els.modal.classList.remove("show");
  resetViewerFrame();
  state.current = null;
}

function pickDownload(data) {
  const order = ["glb", "gltf", "source", "usdz"];
  for (const key of order) {
    const item = data?.[key];
    if (item && typeof item.url === "string" && item.url) {
      return { key, url: item.url };
    }
  }
  return null;
}

function saveByLink(url) {
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = url;
  document.body.appendChild(iframe);
  setTimeout(() => iframe.remove(), 120000);
}

async function downloadCurrent() {
  const model = state.current;
  if (!model) return;

  if (!getToken()) {
    els.settings.classList.add("show");
    return;
  }

  els.downloadBtn.disabled = true;
  els.downloadBtn.textContent = "正在下载";

  try {
    const res = await fetch(`${API}/models/${model.uid}/download`, {
      headers: authHeaders(),
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error("密钥无效或没有下载权限");
    }
    if (!res.ok) {
      throw new Error(`无法获取下载地址（${res.status}）`);
    }

    const data = await res.json();
    const file = pickDownload(data);
    if (!file) {
      throw new Error("该模型没有可用的下载地址");
    }

    saveByLink(file.url);
    els.fileLink.href = file.url;
    els.fileLink.hidden = false;
    els.downloadBtn.textContent = "已开始下载";
  } catch (err) {
    alert(err.message || "下载失败");
  } finally {
    setTimeout(() => {
      els.downloadBtn.disabled = !model.isDownloadable;
      els.downloadBtn.textContent = model.isDownloadable ? "下载模型" : "不可下载";
    }, 1200);
  }
}

els.searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  search();
});
els.category.addEventListener("change", search);
els.sort.addEventListener("change", search);
els.downloadable.addEventListener("change", search);
els.closeModal.addEventListener("click", closeModal);
els.modal.addEventListener("click", (e) => {
  if (e.target === els.modal) closeModal();
});
els.downloadBtn.addEventListener("click", downloadCurrent);
els.openSettings.addEventListener("click", () => {
  els.tokenInput.value = getToken();
  els.settings.classList.add("show");
});
els.closeSettings.addEventListener("click", () => els.settings.classList.remove("show"));
els.saveToken.addEventListener("click", () => {
  const value = els.tokenInput.value.trim() || DEFAULT_TOKEN;
  localStorage.setItem(TOKEN_KEY, value);
  els.settings.classList.remove("show");
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    els.settings.classList.remove("show");
  }
});

const observer = new IntersectionObserver((entries) => {
  if (entries.some((entry) => entry.isIntersecting)) {
    loadMore(false);
  }
}, {
  root: null,
  rootMargin: "400px 0px",
  threshold: 0,
});

observer.observe(els.sentinel);

search();

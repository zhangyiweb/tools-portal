const API_BASE = 'https://api.polyhaven.com';

/** 可选 HDR 分辨率 */
export const HDR_RESOLUTIONS = ['1k', '2k', '4k', '8k', '16k'];

/** 默认预览分辨率 */
export const DEFAULT_RESOLUTION = '2k';

/** 列表缩略图尺寸（CDN 动态裁剪，约 50~90KB） */
export const THUMB_WIDTH = 320;
export const THUMB_HEIGHT = 160;

/** 侧边栏 HDRI 缩略图 */
export function getHdriPreviewUrl(id) {
  return `https://cdn.polyhaven.com/asset_img/thumbs/${encodeURIComponent(id)}.png?width=${THUMB_WIDTH}&height=${THUMB_HEIGHT}`;
}

/**
 * 获取全部 HDRI 资产列表
 */
export async function fetchAllHdris() {
  const res = await fetch(`${API_BASE}/assets?t=hdris`);
  if (!res.ok) throw new Error(`获取 HDRI 列表失败: ${res.status}`);
  const data = await res.json();
  return Object.entries(data).map(([id, meta]) => ({
    id,
    name: meta.name,
    categories: meta.categories ?? [],
    tags: meta.tags ?? [],
    thumbnail_url: getHdriPreviewUrl(id),
    fallback_thumbnail: meta.thumbnail_url,
  }));
}

/**
 * 获取 HDRI 分类及数量
 */
export async function fetchHdriCategories() {
  const res = await fetch(`${API_BASE}/categories/hdris`);
  if (!res.ok) throw new Error(`获取分类失败: ${res.status}`);
  const data = await res.json();
  return Object.entries(data)
    .filter(([key]) => key !== 'all')
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

/**
 * 从 files 接口解析指定分辨率的 .hdr 下载 URL
 */
export async function fetchHdriUrl(id, resolution = DEFAULT_RESOLUTION) {
  const res = await fetch(`${API_BASE}/files/${id}`);
  if (!res.ok) throw new Error(`获取文件信息失败: ${res.status}`);
  const files = await res.json();

  const hdri = files.hdri;
  if (!hdri) throw new Error('该资产没有 HDRI 文件');

  const order = ['16k', '8k', '4k', '2k', '1k'];
  const targetIdx = order.indexOf(resolution);
  const candidates = order.slice(targetIdx >= 0 ? targetIdx : order.indexOf('2k'));

  for (const resKey of candidates) {
    if (hdri[resKey]?.hdr?.url) {
      return { url: hdri[resKey].hdr.url, resolution: resKey };
    }
  }

  for (const resKey of order) {
    if (hdri[resKey]?.hdr?.url) {
      return { url: hdri[resKey].hdr.url, resolution: resKey };
    }
  }

  throw new Error('未找到可用的 HDR 文件');
}

/** 下载 HDR 文件到本地 */
export async function downloadHdri(url, filename) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载失败: ${res.status}`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

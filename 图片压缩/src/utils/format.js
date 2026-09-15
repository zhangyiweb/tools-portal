/** 共用工具函数 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatRatio(original, compressed) {
  if (!original) return { text: "", type: "" };
  const ratio = ((original - compressed) / original) * 100;
  if (ratio >= 0.05) return { text: `压缩 ${ratio.toFixed(1)}%`, type: "ok" };
  if (ratio <= -0.05) return { text: `增大 ${Math.abs(ratio).toFixed(1)}%`, type: "warn" };
  return { text: "体积几乎不变", type: "" };
}

export function withExt(filename, ext) {
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  return `${base}.${ext}`;
}

export function uniqueZipName(name, used) {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let i = 1;
  let candidate;
  do {
    candidate = `${base}(${i})${ext}`;
    i += 1;
  } while (used.has(candidate));
  used.add(candidate);
  return candidate;
}

export function detectFormat(file) {
  const name = file.name || "";
  if (file.type === "image/png" || /\.png$/i.test(name)) return "png";
  if (file.type === "image/webp" || /\.webp$/i.test(name)) return "webp";
  if (file.type === "image/avif" || /\.avif$/i.test(name)) return "avif";
  if (file.type === "image/gif" || /\.gif$/i.test(name)) return "png";
  if (file.type === "image/bmp" || /\.bmp$/i.test(name)) return "png";
  return "jpeg";
}

export function mimeOfFormat(format) {
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  if (format === "avif") return "image/avif";
  return "image/jpeg";
}

export function triggerDownload(blob, filename) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function readImageSize(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(size);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`无法读取尺寸：${file.name}`));
    };
    img.src = url;
  });
}

export function isAllowedImage(file, { allowExtra = false } = {}) {
  if (file.size > MAX_FILE_SIZE) return false;
  const types = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
  const ext = /\.(jpe?g|png|webp|avif)$/i;
  if (allowExtra) {
    types.add("image/gif");
    types.add("image/bmp");
  }
  const extExtra = allowExtra ? /\.(jpe?g|png|webp|avif|gif|bmp)$/i : ext;
  if (types.has(file.type)) return true;
  return extExtra.test(file.name);
}

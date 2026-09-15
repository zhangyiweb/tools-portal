/**
 * 图片处理 Worker：压缩 / 格式转换 / 改尺寸
 * 参考 PixelSwift + jSquash WASM
 */

import UPNG from "upng-js";

let jpegEncode = null;
let webpEncode = null;
let avifEncode = null;
let avifDecode = null;
let oxipngOptimise = null;

async function ensureJpeg() {
  if (!jpegEncode) jpegEncode = (await import("@jsquash/jpeg")).encode;
}
async function ensureWebp() {
  if (!webpEncode) webpEncode = (await import("@jsquash/webp")).encode;
}
async function ensureAvif() {
  if (!avifEncode) {
    const mod = await import("@jsquash/avif");
    avifEncode = mod.encode;
    avifDecode = mod.decode;
  }
}
async function ensureOxipng() {
  if (!oxipngOptimise) oxipngOptimise = (await import("@jsquash/oxipng")).optimise;
}

function mimeOf(format) {
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  if (format === "avif") return "image/avif";
  return "image/jpeg";
}

function extOf(format) {
  if (format === "png") return "png";
  if (format === "webp") return "webp";
  if (format === "avif") return "avif";
  return "jpg";
}

function normalizeFormat(format) {
  if (!format) return "jpeg";
  const f = String(format).toLowerCase();
  if (f === "jpg" || f === "jpeg") return "jpeg";
  if (f === "png" || f === "webp" || f === "avif") return f;
  return "jpeg";
}

function qualityToColors(quality) {
  if (quality >= 95) return 0;
  if (quality >= 90) return 256;
  if (quality >= 85) return 192;
  if (quality >= 80) return 128;
  if (quality >= 70) return 96;
  if (quality >= 60) return 64;
  if (quality >= 45) return 48;
  if (quality >= 30) return 32;
  return 24;
}

function qualityToPngLevel(quality) {
  if (quality >= 90) return 2;
  if (quality >= 75) return 3;
  if (quality >= 50) return 4;
  return 5;
}

function pickSmallest(candidates) {
  let best = null;
  for (const c of candidates) {
    if (!c?.buffer) continue;
    if (!best || c.buffer.byteLength < best.buffer.byteLength) best = c;
  }
  return best;
}

async function decodeToImageData(buffer, mime, flattenForJpeg) {
  try {
    const blob = new Blob([buffer], { type: mime });
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      throw new Error("无法创建 OffscreenCanvas");
    }
    if (flattenForJpeg) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    bitmap.close();
    return imageData;
  } catch (nativeErr) {
    if (mime === "image/avif" || mime?.includes("avif")) {
      await ensureAvif();
      const imageData = await avifDecode(buffer);
      if (!flattenForJpeg) return imageData;
      const canvas = new OffscreenCanvas(imageData.width, imageData.height);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.putImageData(imageData, 0, 0);
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
    throw nativeErr;
  }
}

async function encodePngSmart(imageData, quality) {
  await ensureOxipng();
  const candidates = [];
  const colors = qualityToColors(quality);
  const level = qualityToPngLevel(quality);

  try {
    const rgba = imageData.data.buffer.slice(
      imageData.data.byteOffset,
      imageData.data.byteOffset + imageData.data.byteLength
    );
    const upngBuf = UPNG.encode([rgba], imageData.width, imageData.height, colors);
    candidates.push({ buffer: upngBuf, mime: "image/png", ext: "png" });
    try {
      const optimized = await oxipngOptimise(upngBuf, {
        level,
        interlace: false,
        optimiseAlpha: true,
      });
      candidates.push({ buffer: optimized, mime: "image/png", ext: "png" });
    } catch { /* ignore */ }
  } catch (err) {
    console.warn("UPNG encode failed", err);
  }

  try {
    const oxiBuf = await oxipngOptimise(imageData, {
      level,
      interlace: false,
      optimiseAlpha: true,
    });
    candidates.push({ buffer: oxiBuf, mime: "image/png", ext: "png" });
  } catch { /* ignore */ }

  const best = pickSmallest(candidates);
  if (!best) throw new Error("PNG 编码失败");
  return best;
}

/** 转换/改尺寸用：尽量保真的 PNG */
async function encodePngLossless(imageData) {
  await ensureOxipng();
  try {
    const rgba = imageData.data.buffer.slice(
      imageData.data.byteOffset,
      imageData.data.byteOffset + imageData.data.byteLength
    );
    const upngBuf = UPNG.encode([rgba], imageData.width, imageData.height, 0);
    try {
      const optimized = await oxipngOptimise(upngBuf, {
        level: 2,
        interlace: false,
        optimiseAlpha: true,
      });
      return { buffer: optimized, mime: "image/png", ext: "png" };
    } catch {
      return { buffer: upngBuf, mime: "image/png", ext: "png" };
    }
  } catch {
    const oxiBuf = await oxipngOptimise(imageData, {
      level: 2,
      interlace: false,
      optimiseAlpha: true,
    });
    return { buffer: oxiBuf, mime: "image/png", ext: "png" };
  }
}

async function encodeJpeg(imageData, quality) {
  await ensureJpeg();
  const buffer = await jpegEncode(imageData, {
    quality,
    progressive: true,
    optimize_coding: true,
  });
  return { buffer, mime: "image/jpeg", ext: "jpg" };
}

async function encodeWebp(imageData, quality) {
  await ensureWebp();
  const buffer = await webpEncode(imageData, { quality });
  return { buffer, mime: "image/webp", ext: "webp" };
}

async function encodeAvif(imageData, quality) {
  await ensureAvif();
  const buffer = await avifEncode(imageData, {
    quality,
    qualityAlpha: -1,
    speed: quality >= 85 ? 4 : 6,
    subsample: quality >= 90 ? 3 : 1,
  });
  return { buffer, mime: "image/avif", ext: "avif" };
}

async function encodeByFormat(imageData, format, quality, { lossyPng = false } = {}) {
  const f = normalizeFormat(format);
  if (f === "png") {
    return lossyPng ? encodePngSmart(imageData, quality) : encodePngLossless(imageData);
  }
  if (f === "webp") return encodeWebp(imageData, quality);
  if (f === "avif") return encodeAvif(imageData, quality);
  return encodeJpeg(imageData, quality);
}

/**
 * 旋转/翻转后再缩放到目标尺寸
 * rotate: 0 | 90 | 180 | 270
 */
async function resizeTransform(buffer, mime, options) {
  const {
    width: targetWidth,
    height: targetHeight,
    rotate = 0,
    flipH = false,
    flipV = false,
    format,
    quality = 90,
  } = options;

  if (!targetWidth || !targetHeight) throw new Error("请指定目标宽高");

  const blob = new Blob([buffer], { type: mime });
  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch (err) {
    // AVIF 回退：先解码成 ImageData 再转 bitmap
    if (mime === "image/avif") {
      await ensureAvif();
      const imageData = await avifDecode(buffer);
      const c = new OffscreenCanvas(imageData.width, imageData.height);
      c.getContext("2d").putImageData(imageData, 0, 0);
      bitmap = await createImageBitmap(c);
    } else {
      throw err;
    }
  }

  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const rot = ((rotate % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;
  const midW = swap ? srcH : srcW;
  const midH = swap ? srcW : srcH;

  const mid = new OffscreenCanvas(midW, midH);
  const mctx = mid.getContext("2d");
  mctx.imageSmoothingEnabled = true;
  mctx.imageSmoothingQuality = "high";
  mctx.translate(midW / 2, midH / 2);
  mctx.rotate((rot * Math.PI) / 180);
  mctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  mctx.drawImage(bitmap, -srcW / 2, -srcH / 2);
  bitmap.close();

  const outFormat = normalizeFormat(format);
  const out = new OffscreenCanvas(targetWidth, targetHeight);
  const octx = out.getContext("2d");
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  if (outFormat === "jpeg") {
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, targetWidth, targetHeight);
  }
  octx.drawImage(mid, 0, 0, targetWidth, targetHeight);
  const imageData = octx.getImageData(0, 0, targetWidth, targetHeight);

  const result = await encodeByFormat(imageData, outFormat, quality, { lossyPng: false });
  return {
    ...result,
    width: targetWidth,
    height: targetHeight,
  };
}

self.addEventListener("message", async (event) => {
  const { id, action = "compress", buffer, mime, format, options = {} } = event.data || {};

  try {
    if (!buffer) throw new Error("缺少图片数据");

    let result;

    if (action === "convert") {
      const target = normalizeFormat(options.targetFormat || format);
      const quality = Math.round(options.quality ?? 90);
      const imageData = await decodeToImageData(
        buffer,
        mime || mimeOf(format),
        target === "jpeg"
      );
      result = await encodeByFormat(imageData, target, quality, { lossyPng: false });
      result.width = imageData.width;
      result.height = imageData.height;
    } else if (action === "resize") {
      const outFormat = normalizeFormat(options.format || format);
      result = await resizeTransform(buffer, mime || mimeOf(format), {
        ...options,
        format: outFormat,
        quality: Math.round(options.quality ?? 90),
      });
    } else {
      // compress：保持原格式
      const srcFormat = normalizeFormat(format);
      const quality = Math.round(options.quality ?? 75);
      const imageData = await decodeToImageData(
        buffer,
        mime || mimeOf(srcFormat),
        srcFormat === "jpeg"
      );
      result = await encodeByFormat(imageData, srcFormat, quality, {
        lossyPng: srcFormat === "png",
      });
      result.width = imageData.width;
      result.height = imageData.height;
    }

    self.postMessage(
      {
        id,
        ok: true,
        buffer: result.buffer,
        mime: result.mime,
        ext: result.ext || extOf(normalizeFormat(format)),
        width: result.width,
        height: result.height,
      },
      [result.buffer]
    );
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: err?.message || String(err),
    });
  }
});

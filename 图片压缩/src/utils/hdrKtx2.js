/** 与参考项目一致的 UASTC HDR 质量档位 */
export const HDR_ENCODE_OPTIONS = [
  { value: "uastc-hdr-4x4", label: "UASTC HDR 4×4（推荐，高质量）", level: 1 },
  { value: "uastc-hdr-6x6i", label: "UASTC HDR 6×6i（更高压缩率）", level: 3 },
];

const QUALITY_MAP = Object.fromEntries(
  HDR_ENCODE_OPTIONS.map((o) => [o.value, o.level])
);

/**
 * 浏览器端将 HDR / EXR 转为 KTX2（Basis Universal WASM）
 * @param {File|Blob} file
 * @param {{ encode?: string, mipmap?: boolean, zstd?: boolean }} [options]
 * @returns {Promise<{ blob: Blob, bytes: Uint8Array, imageType: 'hdr'|'exr', encode: string }>}
 */
export async function convertHdrToKtx2(file, options = {}) {
  const {
    encode = "uastc-hdr-4x4",
    mipmap = true,
    zstd = true,
  } = options;

  const { encodeToKTX2 } = await import("ktx2-encoder");

  const name = (file.name || "").toLowerCase();
  const isExr = name.endsWith(".exr") || file.type === "image/x-exr";
  const imageType = isExr ? "exr" : "hdr";
  const buffer = new Uint8Array(await file.arrayBuffer());

  const bytes = await encodeToKTX2(buffer, {
    isHDR: true,
    imageType,
    isUASTC: true,
    isKTX2File: true,
    generateMipmap: mipmap,
    needSupercompression: zstd,
    hdrQualityLevel: QUALITY_MAP[encode] ?? 1,
    // HDR 自上而下；KTX2 无法运行时 flipY，编码时翻转
    isYFlip: true,
    enableDebug: false,
  });

  return {
    bytes,
    blob: new Blob([bytes], { type: "application/octet-stream" }),
    imageType,
    encode,
  };
}

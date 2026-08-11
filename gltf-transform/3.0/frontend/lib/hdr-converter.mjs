import { encodeToKTX2 } from 'ktx2-encoder';

const HDR_QUALITY_MAP = {
    'uastc-hdr-4x4': 1,
    'uastc-hdr-6x6i': 3
};

/**
 * 使用 ktx2-encoder (Basis Universal WASM) 将 HDR/EXR 转为 KTX2
 * @param {Buffer|Uint8Array} buffer - 原始 HDR/EXR 文件数据
 * @param {object} options
 * @param {'hdr'|'exr'} options.imageType
 * @param {string} [options.encode]
 * @param {boolean} [options.mipmap]
 * @param {boolean} [options.zstd]
 * @returns {Promise<Buffer>}
 */
export async function convertHdrToKtx2(buffer, options = {}) {
    const {
        imageType,
        encode = 'uastc-hdr-4x4',
        mipmap = true,
        zstd = true
    } = options;

    const input = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

    const result = await encodeToKTX2(input, {
        isHDR: true,
        imageType,
        isUASTC: true,
        isKTX2File: true,
        generateMipmap: mipmap,
        needSupercompression: zstd,
        hdrQualityLevel: HDR_QUALITY_MAP[encode] ?? 1,
        // HDR 文件自上而下存储，WebGL/Three.js 纹理自下而上采样；
        // KTX2 压缩纹理无法在运行时 flipY，须在编码时翻转
        isYFlip: true,
        enableDebug: false,
        // Node.js 入口要求提供 imageDecoder，HDR 模式下不会实际调用
        imageDecoder: async () => ({ width: 0, height: 0, data: new Uint8Array() })
    });

    return Buffer.from(result);
}

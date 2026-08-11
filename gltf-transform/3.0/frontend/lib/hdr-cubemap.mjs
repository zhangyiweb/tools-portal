import { readHdr, readExr, hdrToLdr, writeHdr } from 'hdrify';
import sharp from 'sharp';
import { ZipArchive } from 'archiver';
import { PassThrough } from 'stream';

export const FACE_NAMES = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
export const FACE_LABELS = ['+X 右', '-X 左', '+Y 上', '-Y 下', '+Z 前', '-Z 后'];

function loadHdrImage(buffer, ext) {
    const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (ext === '.hdr') return readHdr(data);
    if (ext === '.exr') return readExr(data);
    throw new Error('仅支持 .hdr 和 .exr 格式');
}

function directionForFacePixel(face, x, y, size) {
    const u = ((x + 0.5) / size) * 2 - 1;
    const v = ((y + 0.5) / size) * 2 - 1;
    let dx, dy, dz;

    switch (face) {
        case 0: dx = 1; dy = -v; dz = -u; break;
        case 1: dx = -1; dy = -v; dz = u; break;
        case 2: dx = u; dy = 1; dz = v; break;
        case 3: dx = u; dy = -1; dz = -v; break;
        case 4: dx = u; dy = -v; dz = 1; break;
        case 5: dx = -u; dy = -v; dz = -1; break;
        default: throw new Error(`无效面索引: ${face}`);
    }

    const len = Math.hypot(dx, dy, dz);
    return [dx / len, dy / len, dz / len];
}

function directionToUV(x, y, z) {
    const theta = Math.atan2(x, z);
    const phi = Math.asin(Math.max(-1, Math.min(1, y)));
    const u = theta / (2 * Math.PI) + 0.5;
    const v = 0.5 - phi / Math.PI;
    return [u, v];
}

function sampleBilinear(imageData, width, height, u, v) {
    u = ((u % 1) + 1) % 1;
    const fx = u * width - 0.5;
    const fy = Math.max(0, Math.min(height - 1, v * (height - 1)));
    const x0 = ((Math.floor(fx) % width) + width) % width;
    const x1 = (x0 + 1) % width;
    const y0 = Math.floor(fy);
    const y1 = Math.min(y0 + 1, height - 1);
    const t = fx - Math.floor(fx);
    const s = fy - y0;

    const at = (ix, iy) => {
        const idx = (iy * width + ix) * 4;
        return [
            imageData[idx],
            imageData[idx + 1],
            imageData[idx + 2]
        ];
    };

    const c00 = at(x0, y0);
    const c10 = at(x1, y0);
    const c01 = at(x0, y1);
    const c11 = at(x1, y1);
    const w00 = (1 - t) * (1 - s);
    const w10 = t * (1 - s);
    const w01 = (1 - t) * s;
    const w11 = t * s;

    return [
        c00[0] * w00 + c10[0] * w10 + c01[0] * w01 + c11[0] * w11,
        c00[1] * w00 + c10[1] * w10 + c01[1] * w01 + c11[1] * w11,
        c00[2] * w00 + c10[2] * w10 + c01[2] * w01 + c11[2] * w11
    ];
}

function renderCubemapFace(image, face, size) {
    const { width, height, data, linearColorSpace } = image;
    const faceData = new Float32Array(size * size * 4);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const [dx, dy, dz] = directionForFacePixel(face, x, y, size);
            const [u, v] = directionToUV(dx, dy, dz);
            const [r, g, b] = sampleBilinear(data, width, height, u, v);
            const idx = (y * size + x) * 4;
            faceData[idx] = r;
            faceData[idx + 1] = g;
            faceData[idx + 2] = b;
            faceData[idx + 3] = 1;
        }
    }

    return { width: size, height: size, data: faceData, linearColorSpace };
}

async function encodeFace(faceImage, format, toneOptions) {
    const { width, height } = faceImage;

    if (format === 'hdr') {
        return {
            buffer: Buffer.from(writeHdr(faceImage)),
            ext: 'hdr',
            mime: 'application/octet-stream'
        };
    }

    const ldr = hdrToLdr(faceImage.data, width, height, toneOptions);
    const raw = { width, height, channels: 3 };

    if (format === 'jpeg') {
        return {
            buffer: await sharp(Buffer.from(ldr), { raw }).jpeg({ quality: 92 }).toBuffer(),
            ext: 'jpg',
            mime: 'image/jpeg'
        };
    }

    return {
        buffer: await sharp(Buffer.from(ldr), { raw }).png().toBuffer(),
        ext: 'png',
        mime: 'image/png'
    };
}

/**
 * 将 HDR/EXR 全景图转为 6 张天空盒贴图并打包为 ZIP
 */
export async function convertHdrToCubemapZip(buffer, options = {}) {
    const {
        ext,
        faceSize = 1024,
        format = 'png',
        toneMapping = 'aces',
        exposure = 1
    } = options;

    const image = loadHdrImage(buffer, ext);
    const size = Math.max(64, Math.min(4096, parseInt(faceSize, 10) || 1024));
    const toneOptions = { toneMapping, exposure: parseFloat(exposure) || 1 };

    const archive = new ZipArchive({ zlib: { level: 6 } });
    const stream = new PassThrough();
    const chunks = [];

    const zipBuffer = new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
        archive.on('error', reject);
    });

    archive.pipe(stream);

    const faceStats = [];
    for (let face = 0; face < 6; face++) {
        const faceImage = renderCubemapFace(image, face, size);
        const encoded = await encodeFace(faceImage, format, toneOptions);
        const filename = `${FACE_NAMES[face]}.${encoded.ext}`;
        archive.append(encoded.buffer, { name: filename });
        faceStats.push({
            name: FACE_NAMES[face],
            label: FACE_LABELS[face],
            filename,
            size: encoded.buffer.length
        });
    }

    await archive.finalize();
    const zip = await zipBuffer;

    return {
        zip,
        faceSize: size,
        format,
        faceStats,
        sourceWidth: image.width,
        sourceHeight: image.height
    };
}

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, execSync } = require('child_process');
const cors = require('cors');

const app = express();
const PORT = 3000;
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.static('public'));

// ── 工具检测 ──────────────────────────────────────────────

function commandExists(cmd) {
    try {
        const check = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`;
        execSync(check, { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
}

const availableTools = {
    gltfTransform: commandExists('gltf-transform'),
    hdrConversion: true,
    skyboxConversion: true
};

console.log('可用工具:', availableTools);

// ── 通用辅助 ──────────────────────────────────────────────

function createTempDir(prefix) {
    const dir = path.join(os.tmpdir(), `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function cleanupTempDir(dirPath) {
    try {
        if (!fs.existsSync(dirPath)) return;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                fs.rmSync(dirPath, { recursive: true, force: true });
                console.log(`临时目录已清理：${dirPath}`);
                return;
            } catch (err) {
                if (attempt >= 2) {
                    console.warn(`清理临时目录失败：${dirPath}`, err.message);
                    return;
                }
                Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500 * (attempt + 1));
            }
        }
    } catch (error) {
        console.warn(`清理临时目录时发生错误：${error.message}`);
    }
}

function runCommand(command, cwd) {
    return new Promise((resolve, reject) => {
        console.log(`执行命令: ${command}`);
        exec(command, { maxBuffer: 1024 * 1024 * 20, cwd }, (error, stdout, stderr) => {
            if (error) {
                console.error(`命令失败: ${error.message}`);
                if (stderr) console.error(`stderr: ${stderr}`);
                return reject(new Error(stderr || error.message));
            }
            if (stdout) console.log(`stdout: ${stdout}`);
            if (stderr) console.warn(`stderr: ${stderr}`);
            resolve(stdout);
        });
    });
}

function runCommands(commands, cwd) {
    return commands.reduce(
        (chain, cmd) => chain.then(() => runCommand(cmd, cwd)),
        Promise.resolve()
    );
}

function sendFileResponse(res, file, outputPath, originalStats, convertedStats, extraHeaders = {}) {
    fs.readFile(outputPath, (err, data) => {
        if (err) {
            return res.status(500).json({ error: '读取输出文件失败', details: err.message });
        }
        res.set({
            'X-Original-Name': file.originalname,
            'X-Original-Size': originalStats.size,
            'Content-Type': 'application/octet-stream',
            ...extraHeaders
        });
        if (convertedStats) {
            res.set('X-Converted-Size', convertedStats.size);
            res.set('X-Compressed-Size', convertedStats.size);
        }
        res.set('Content-Disposition', `attachment; filename="${path.basename(outputPath)}"`);
        res.send(data);
    });
}

// ── 工具状态接口 ──────────────────────────────────────────

app.get('/api/tools-status', (req, res) => {
    res.json({
        gltfTransform: availableTools.gltfTransform,
        hdrConversion: availableTools.hdrConversion,
        skyboxConversion: availableTools.skyboxConversion,
        hdrEngine: 'ktx2-encoder',
        skyboxEngine: 'hdrify + sharp'
    });
});

// ── 模型压缩接口 ──────────────────────────────────────────

app.post('/api/compress', upload.single('model'), (req, res) => {
    const file = req.file;
    const { ktx2, draco, optimize } = req.body;

    if (!file) return res.status(400).json({ error: '没有上传文件' });

    const tempDir = createTempDir('gltf');
    const inputPath = path.join(tempDir, file.originalname);
    fs.writeFileSync(inputPath, file.buffer);

    const fileName = path.parse(file.originalname).name || 'model';
    const commands = [];
    let currentStep = inputPath;
    let stepCounter = 0;

    if (ktx2 === 'true') {
        stepCounter++;
        const outputPath = path.join(tempDir, `${fileName}-webp.glb`);
        commands.push(`gltf-transform webp "${path.normalize(currentStep)}" "${path.normalize(outputPath)}" --quality 85`);
        currentStep = outputPath;
    }

    if (draco === 'true') {
        stepCounter++;
        let outputPath = path.join(tempDir, `${fileName}-ktx2-draco.glb`);
        if (stepCounter === 1) outputPath = path.join(tempDir, `${fileName}-draco.glb`);
        commands.push(`gltf-transform draco "${path.normalize(currentStep)}" "${path.normalize(outputPath)}"`);
        currentStep = outputPath;
    }

    if (optimize === 'true' && !(ktx2 === 'true' && draco === 'true')) {
        stepCounter++;
        let outputPath;
        if (stepCounter === 1) {
            outputPath = path.join(tempDir, `${fileName}-optimized.glb`);
        } else if (stepCounter === 2) {
            outputPath = path.join(tempDir, ktx2 === 'true' ? `${fileName}-ktx2-optimized.glb` : `${fileName}-draco-optimized.glb`);
        } else {
            outputPath = path.join(tempDir, `${fileName}-final.glb`);
        }
        commands.push(`gltf-transform optimize "${path.normalize(currentStep)}" "${path.normalize(outputPath)}"`);
        currentStep = outputPath;
    }

    if (commands.length === 0) {
        const outputPath = path.join(tempDir, `${fileName}-original.glb`);
        fs.copyFileSync(inputPath, outputPath);
        currentStep = outputPath;
    }

    runCommands(commands, tempDir)
        .then(() => {
            const originalStats = fs.statSync(inputPath);
            const compressedStats = fs.statSync(currentStep);
            sendFileResponse(res, file, currentStep, originalStats, compressedStats);
            setTimeout(() => cleanupTempDir(tempDir), 2000);
        })
        .catch(err => {
            cleanupTempDir(tempDir);
            res.status(500).json({ error: '压缩失败', details: err.message });
        });
});

// ── HDR 转 KTX2 接口（npm: ktx2-encoder）──────────────────

let hdrConverterModule = null;

async function getHdrConverter() {
    if (!hdrConverterModule) {
        hdrConverterModule = await import('./lib/hdr-converter.mjs');
    }
    return hdrConverterModule.convertHdrToKtx2;
}

app.post('/api/convert-hdr', upload.single('hdr'), async (req, res) => {
    const file = req.file;
    const encode = req.body.encode || 'uastc-hdr-4x4';
    const mipmap = req.body.mipmap !== 'false';
    const zstd = req.body.zstd !== 'false';

    if (!file) return res.status(400).json({ error: '没有上传文件' });

    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.hdr', '.exr'].includes(ext)) {
        return res.status(400).json({ error: '仅支持 .hdr 和 .exr 格式' });
    }

    try {
        const convertHdrToKtx2 = await getHdrConverter();
        const ktx2Buffer = await convertHdrToKtx2(file.buffer, {
            imageType: ext === '.hdr' ? 'hdr' : 'exr',
            encode,
            mipmap,
            zstd
        });

        res.set({
            'X-Original-Name': file.originalname,
            'X-Original-Size': file.size,
            'X-Converted-Size': ktx2Buffer.length,
            'X-Encode-Format': encode,
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${path.parse(file.originalname).name}.ktx2"`
        });
        res.send(ktx2Buffer);
    } catch (err) {
        console.error('HDR 转换失败:', err);
        res.status(500).json({ error: 'HDR 转换失败', details: err.message });
    }
});

// ── HDR 转天空盒接口（npm: hdrify + sharp）────────────────

let hdrCubemapModule = null;

async function getHdrCubemapConverter() {
    if (!hdrCubemapModule) {
        hdrCubemapModule = await import('./lib/hdr-cubemap.mjs');
    }
    return hdrCubemapModule.convertHdrToCubemapZip;
}

app.post('/api/convert-hdr-cubemap', upload.single('hdr'), async (req, res) => {
    const file = req.file;
    const faceSize = req.body.faceSize || '1024';
    const format = req.body.format || 'png';
    const toneMapping = req.body.toneMapping || 'aces';
    const exposure = req.body.exposure || '1';

    if (!file) return res.status(400).json({ error: '没有上传文件' });

    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.hdr', '.exr'].includes(ext)) {
        return res.status(400).json({ error: '仅支持 .hdr 和 .exr 格式' });
    }

    if (!['png', 'hdr', 'jpeg'].includes(format)) {
        return res.status(400).json({ error: '不支持的输出格式' });
    }

    try {
        const convertHdrToCubemapZip = await getHdrCubemapConverter();
        const result = await convertHdrToCubemapZip(file.buffer, {
            ext,
            faceSize,
            format,
            toneMapping,
            exposure
        });

        const zipName = `${path.parse(file.originalname).name}-skybox.zip`;
        res.set({
            'X-Original-Name': file.originalname,
            'X-Original-Size': file.size,
            'X-Converted-Size': result.zip.length,
            'X-Face-Size': result.faceSize,
            'X-Output-Format': format,
            'X-Source-Width': result.sourceWidth,
            'X-Source-Height': result.sourceHeight,
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${zipName}"`
        });
        res.send(result.zip);
    } catch (err) {
        console.error('天空盒转换失败:', err);
        res.status(500).json({ error: '天空盒转换失败', details: err.message });
    }
});

// ── 启动 ──────────────────────────────────────────────────

app.get('/api/download/:filename', (req, res) => {
    res.status(404).json({ error: '文件已清理，请重新转换后下载' });
});

if (!availableTools.gltfTransform) {
    console.warn('警告：gltf-transform 未找到，模型压缩功能不可用');
    console.warn('请运行: npm install -g @gltf-transform/cli');
}

app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});

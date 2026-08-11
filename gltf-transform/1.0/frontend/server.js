const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const cors = require('cors');

const app = express();
const PORT = 3000;

// 配置文件上传
const upload = multer({ dest: 'uploads/' });

// 启用CORS
app.use(cors());

// 静态文件服务
app.use(express.static('public'));

// 创建uploads目录
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// 创建outputs目录
if (!fs.existsSync('outputs')) {
    fs.mkdirSync('outputs');
}

// 模型压缩接口
app.post('/api/compress', upload.single('model'), (req, res) => {
    const file = req.file;
    const { ktx2, draco, optimize } = req.body;

    if (!file) {
        return res.status(400).json({ error: '没有上传文件' });
    }

    const inputPath = file.path;
    const fileName = path.parse(file.originalname).name;
    const outputDir = 'outputs';

    // 构建压缩命令序列
    const commands = [];
    let currentStep = inputPath;
    let stepCounter = 0;

    // 步骤1: KTX2压缩（如果启用）
    if (ktx2 === 'true') {
        stepCounter++;
        const outputPath = path.join(outputDir, `${fileName}-ktx2.glb`);
        commands.push(`npx gltf-transform etc1s "${currentStep}" "${outputPath}"`);
        currentStep = outputPath;
    }

    // 步骤2: Draco压缩（如果启用）
    if (draco === 'true') {
        stepCounter++;
        const outputPath = path.join(outputDir, `${fileName}-ktx2-draco.glb`);
        if(stepCounter === 1) { // 如果前面没有执行KTX2步骤
            outputPath = path.join(outputDir, `${fileName}-draco.glb`);
        }
        commands.push(`npx gltf-transform draco "${currentStep}" "${outputPath}"`);
        currentStep = outputPath;
    }

    // 步骤3: 优化（如果启用）
    if (optimize === 'true') {
        stepCounter++;
        let outputPath;
        if(stepCounter === 1) { // 只有优化
            outputPath = path.join(outputDir, `${fileName}-optimized.glb`);
        } else if(stepCounter === 2) { // KTX2+优化 或 Draco+优化
            if(ktx2 === 'true') {
                outputPath = path.join(outputDir, `${fileName}-ktx2-optimized.glb`);
            } else {
                outputPath = path.join(outputDir, `${fileName}-draco-optimized.glb`);
            }
        } else { // KTX2+Draco+优化
            outputPath = path.join(outputDir, `${fileName}-final.glb`);
        }
        commands.push(`npx gltf-transform optimize "${currentStep}" "${outputPath}"`);
        currentStep = outputPath;
    }

    // 如果没有选择任何选项，则复制原文件
    if (commands.length === 0) {
        const outputPath = path.join(outputDir, `${fileName}-original.glb`);
        fs.copyFileSync(inputPath, outputPath);
        currentStep = outputPath;
    }

    // 执行命令序列
    executeCommands(commands, currentStep, (err, outputPath) => {
        if (err) {
            console.error('压缩失败:', err);
            return res.status(500).json({ error: '压缩失败', details: err.message });
        }

        // 返回结果
        fs.stat(inputPath, (err, originalStats) => {
            if (err) {
                return res.status(500).json({ error: '获取原始文件统计信息失败' });
            }

            fs.stat(outputPath, (err, compressedStats) => {
                if (err) {
                    return res.status(500).json({ error: '获取压缩文件统计信息失败' });
                }

                res.json({
                    success: true,
                    original: {
                        name: file.originalname,
                        size: originalStats.size,
                        path: inputPath
                    },
                    compressed: {
                        name: path.basename(outputPath),
                        size: compressedStats.size,
                        path: outputPath
                    },
                    reduction: {
                        bytes: originalStats.size - compressedStats.size,
                        percentage: ((originalStats.size - compressedStats.size) / originalStats.size * 100).toFixed(2)
                    }
                });
            });
        });
    });
});

function executeCommands(commands, finalOutputPath, callback) {
    if (commands.length === 0) {
        return callback(null, finalOutputPath);
    }

    let index = 0;

    function runNextCommand() {
        if (index >= commands.length) {
            return callback(null, finalOutputPath);
        }

        const command = commands[index];
        console.log(`执行命令: ${command}`);
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`命令执行失败: ${command}`, error);
                return callback(error);
            }

            console.log(`命令成功: ${command}`);
            console.log(`输出: ${stdout}`);
            if (stderr) {
                console.error(`错误输出: ${stderr}`);
            }

            index++;
            runNextCommand();
        });
    }

    runNextCommand();
}

// 提供压缩后的文件下载
app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'outputs', filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: '文件不存在' });
    }

    res.download(filePath, filename, (err) => {
        if (err) {
            console.error('下载失败:', err);
            res.status(500).json({ error: '下载失败' });
        }
    });
});

app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});
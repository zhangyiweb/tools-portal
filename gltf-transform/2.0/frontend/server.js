const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const cors = require('cors');

const app = express();
const PORT = 3000;

// 使用内存存储而非磁盘存储
const upload = multer({ storage: multer.memoryStorage() });

// 启用CORS
app.use(cors());

// 静态文件服务
app.use(express.static('public'));



// 模型压缩接口
app.post('/api/compress', upload.single('model'), (req, res) => {
    const file = req.file;
    const { ktx2, draco, optimize } = req.body;

    if (!file) {
        return res.status(400).json({ error: '没有上传文件' });
    }

    // 创建临时目录来处理文件
    const tempDir = path.join(os.tmpdir(), `gltf_transform_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    fs.mkdirSync(tempDir, { recursive: true });
    
    // 将上传的缓冲区数据写入临时文件
    const inputPath = path.join(tempDir, file.originalname);
    fs.writeFileSync(inputPath, file.buffer);
    
    const fileName = path.parse(file.originalname).name;
    const outputDir = tempDir;

    // 构建压缩命令序列
    const commands = [];
    let currentStep = inputPath;
    let stepCounter = 0;

    // 步骤1: KTX2压缩（如果启用）
    if (ktx2 === 'true') {
        stepCounter++;
        const outputPath = path.join(outputDir, `${fileName}-ktx2.glb`);
        // 使用规范化路径
        commands.push(`npx gltf-transform etc1s "${path.normalize(currentStep)}" "${path.normalize(outputPath)}"`);
        currentStep = outputPath;
    }

    // 步骤2: Draco压缩（如果启用）
    if (draco === 'true') {
        stepCounter++;
        const outputPath = path.join(outputDir, `${fileName}-ktx2-draco.glb`);
        if(stepCounter === 1) { // 如果前面没有执行KTX2步骤
            outputPath = path.join(outputDir, `${fileName}-draco.glb`);
        }
        // 使用规范化路径
        commands.push(`npx gltf-transform draco "${path.normalize(currentStep)}" "${path.normalize(outputPath)}"`);
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
        // 使用规范化路径
        commands.push(`npx gltf-transform optimize "${path.normalize(currentStep)}" "${path.normalize(outputPath)}"`);
        currentStep = outputPath;
    }

    // 如果没有选择任何选项，则复制原文件
    if (commands.length === 0) {
        const outputPath = path.join(outputDir, `${fileName}-original.glb`);
        fs.copyFileSync(inputPath, outputPath);
        currentStep = outputPath;
    }

    // 定义内部函数来执行命令序列
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
            
            console.log(`准备执行命令: ${command}`);
            // 在Windows上可能需要使用cmd /c来执行命令
            const execOptions = { maxBuffer: 1024 * 1024 * 10, cwd: tempDir };
            exec(command, execOptions, (error, stdout, stderr) => {
                if (error) {
                    console.error(`命令执行失败: ${command}`);
                    console.error(`错误代码: ${error.code}`);
                    console.error(`错误信号: ${error.signal}`);
                    console.error(`错误信息: ${error.message}`);
                    return callback(error);
                }

                console.log(`命令成功: ${command}`);
                console.log(`输出: ${stdout}`);
                if (stderr) {
                    console.warn(`警告输出: ${stderr}`);
                }

                index++;
                runNextCommand();
            });
        }

        runNextCommand();
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

                // 读取压缩后的文件内容并发送
                fs.readFile(outputPath, (err, data) => {
                    if (err) {
                        console.error('读取压缩文件时出错:', err);
                        return res.status(500).json({ error: '读取压缩文件失败', details: err.message });
                    }
                    
                    // 设置响应头包含压缩信息
                    res.set({
                        'X-Original-Name': file.originalname,
                        'X-Original-Size': originalStats.size,
                        'X-Compressed-Size': compressedStats.size,
                        'Content-Type': 'application/octet-stream',
                        'Content-Disposition': `attachment; filename="${path.basename(outputPath)}"`
                    });
                    
                    // 发送文件内容作为响应
                    res.send(data);
                });
            });
        });
    });
    
    
    // 处理完成后清理临时目录
    setTimeout(() => {
        try {
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        } catch (cleanupError) {
            console.warn('清理临时目录时出错:', cleanupError.message);
        }
    }, 100); // 给一点时间确保响应已发送
});



// 注意：由于使用临时目录，下载功能需要从前端提供完整路径或通过其他方式实现
// 这里暂时保留接口但返回错误提示
app.get('/api/download/:filename', (req, res) => {
    return res.status(404).json({ error: '由于使用临时目录，文件已清理，无法下载' });
});

const { execSync } = require('child_process');

// 检查 gltf-transform 是否可用
try {
    execSync('npx gltf-transform --version', { stdio: 'pipe' });
    console.log('gltf-transform 已找到，版本信息正常');
} catch (error) {
    console.error('错误：gltf-transform 未找到或不可用，请确保已全局安装或项目中包含此包');
    console.error('请运行: npm install -g @gltf-transform/cli 或在项目中安装');
}

app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});
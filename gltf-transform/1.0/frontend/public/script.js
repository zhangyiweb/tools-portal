document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const modelInfo = document.getElementById('modelInfo');
    const originalModelDetails = document.getElementById('originalModelDetails');
    const compressionOptions = document.getElementById('compressionOptions');
    const compressBtn = document.getElementById('compressBtn');
    const resultSection = document.getElementById('resultSection');
    const resultTableBody = document.getElementById('resultTableBody');
    const downloadLink = document.getElementById('downloadLink');
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    let originalFile = null;
    let originalFileName = '';
    let compressedFileUrl = null;

    // 拖拽事件处理
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        dropZone.classList.add('drag-over');
    }

    function unhighlight() {
        dropZone.classList.remove('drag-over');
    }

    // 处理文件拖放
    dropZone.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length) {
            handleFiles(files);
        }
    }

    // 文件输入事件
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFiles(e.target.files);
        }
    });

    // 处理文件函数
    function handleFiles(files) {
        const file = files[0];
        if (file && file.name.toLowerCase().endsWith('.glb')) {
            originalFile = file;
            originalFileName = file.name.replace('.glb', '');
            
            // 显示原始模型信息
            showOriginalFileInfo(file);
            
            // 显示压缩选项
            compressionOptions.classList.remove('hidden');
        } else {
            alert('请选择一个有效的GLB文件');
        }
    }

    // 显示原始文件信息
    function showOriginalFileInfo(file) {
        const fileSize = formatFileSize(file.size);
        
        // 创建简单的模型信息显示
        originalModelDetails.innerHTML = `
            <div class="info-item">
                <strong>文件名:</strong> ${file.name}
            </div>
            <div class="info-item">
                <strong>文件大小:</strong> ${fileSize}
            </div>
            <div class="info-item">
                <strong>类型:</strong> ${file.type || 'application/octet-stream'}
            </div>
            <div class="info-item">
                <strong>最后修改:</strong> ${new Date(file.lastModified).toLocaleString()}
            </div>
        `;
        
        modelInfo.classList.remove('hidden');
    }

    // 格式化文件大小
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 压缩按钮点击事件
    compressBtn.addEventListener('click', startCompression);

    async function startCompression() {
        if (!originalFile) {
            alert('请先上传一个GLB文件');
            return;
        }

        // 显示加载指示器
        loadingIndicator.classList.remove('hidden');
        compressBtn.disabled = true;

        try {
            // 获取用户选择的压缩选项
            const useKtx2 = document.getElementById('ktx2Option').checked;
            const useDraco = document.getElementById('dracoOption').checked;
            const useOptimize = document.getElementById('optimizeOption').checked;

            // 调用后端API进行实际压缩
            await compressWithAPI(originalFile, useKtx2, useDraco, useOptimize);
            
            // 隐藏加载指示器
            loadingIndicator.classList.add('hidden');
            compressBtn.disabled = false;
        } catch (error) {
            console.error('压缩过程中发生错误:', error);
            alert('压缩过程中发生错误，请重试');
            loadingIndicator.classList.add('hidden');
            compressBtn.disabled = false;
        }
    }

    // 调用后端API进行实际压缩
    async function compressWithAPI(file, useKtx2, useDraco, useOptimize) {
        const formData = new FormData();
        formData.append('model', file, file.name);
        formData.append('ktx2', useKtx2);
        formData.append('draco', useDraco);
        formData.append('optimize', useOptimize);

        try {
            const response = await fetch('/api/compress', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                // 创建下载链接
                const downloadUrl = `/api/download/${encodeURIComponent(result.compressed.name)}`;
                
                if (compressedFileUrl) {
                    URL.revokeObjectURL(compressedFileUrl); // 清理旧URL
                }
                
                downloadLink.href = downloadUrl;
                downloadLink.download = result.compressed.name;
                downloadLink.classList.remove('hidden');
                
                // 显示结果对比
                showRealCompressionResults(file, result);
            } else {
                throw new Error(result.error || '压缩失败');
            }
        } catch (error) {
            console.error('压缩请求失败:', error);
            alert(`压缩过程中发生错误: ${error.message}`);
            throw error;
        }
    }

    // 显示真实压缩结果对比
    function showRealCompressionResults(originalFile, result) {
        const originalSize = result.original.size;
        const compressedSize = result.compressed.size;
        const sizeReduction = result.reduction.bytes;
        const reductionPercentage = result.reduction.percentage;
        
        resultTableBody.innerHTML = `
            <tr>
                <td>文件名</td>
                <td>${result.original.name}</td>
                <td>${result.compressed.name}</td>
                <td>-</td>
            </tr>
            <tr>
                <td>文件大小</td>
                <td>${formatFileSize(originalSize)}</td>
                <td>${formatFileSize(compressedSize)}</td>
                <td>${formatFileSize(sizeReduction)} (${reductionPercentage}%)</td>
            </tr>
            <tr>
                <td>类型</td>
                <td>${originalFile.type || 'application/octet-stream'}</td>
                <td>application/octet-stream</td>
                <td>-</td>
            </tr>
        `;
        
        resultSection.classList.remove('hidden');
    }
});
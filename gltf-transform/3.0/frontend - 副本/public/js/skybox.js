TabManager.register('skybox', { showSidebar: false });

document.addEventListener('DOMContentLoaded', () => {
    const skyboxDropZone = document.getElementById('skyboxDropZone');
    const skyboxFileInput = document.getElementById('skyboxFileInput');
    const skyboxFileInfo = document.getElementById('skyboxFileInfo');
    const skyboxFileDetails = document.getElementById('skyboxFileDetails');
    const skyboxConvertOptions = document.getElementById('skyboxConvertOptions');
    const skyboxConvertBtn = document.getElementById('skyboxConvertBtn');
    const skyboxResultSection = document.getElementById('skyboxResultSection');
    const skyboxResultTableBody = document.getElementById('skyboxResultTableBody');
    const skyboxDownloadLink = document.getElementById('skyboxDownloadLink');
    const skyboxLoadingIndicator = document.getElementById('skyboxLoadingIndicator');
    const skyboxFacePreview = document.getElementById('skyboxFacePreview');

    const VALID_EXTENSIONS = ['.hdr', '.exr'];
    let skyboxFile = null;
    let skyboxFileBaseName = '';
    let zipFileUrl = null;

    AppUtils.setupDropZone(skyboxDropZone, skyboxFileInput, handleSkyboxFiles);

    function isValidFile(file) {
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        return VALID_EXTENSIONS.includes(ext);
    }

    function handleSkyboxFiles(files) {
        const file = files[0];
        if (file && isValidFile(file)) {
            skyboxFile = file;
            skyboxFileBaseName = file.name.replace(/\.[^.]+$/, '');
            showFileInfo(file);
            skyboxConvertOptions.classList.remove('hidden');
            skyboxResultSection.classList.add('hidden');
        } else {
            alert('请选择有效的 HDR 或 EXR 文件');
        }
    }

    function showFileInfo(file) {
        const ext = file.name.substring(file.name.lastIndexOf('.')).toUpperCase();
        skyboxFileDetails.innerHTML = `
            <div class="info-row">
                <div class="info-item"><strong>文件名</strong>${file.name}</div>
                <div class="info-item"><strong>文件大小</strong>${AppUtils.formatFileSize(file.size)}</div>
                <div class="info-item"><strong>格式</strong>${ext}</div>
                <div class="info-item"><strong>输出</strong>6 张天空盒贴图 (ZIP)</div>
            </div>
        `;
        skyboxFileInfo.classList.remove('hidden');
    }

    skyboxConvertBtn.addEventListener('click', startConversion);

    async function startConversion() {
        if (!skyboxFile) {
            alert('请先上传 HDR 文件');
            return;
        }

        skyboxLoadingIndicator.classList.remove('hidden');
        skyboxConvertBtn.disabled = true;

        try {
            await convertWithAPI(skyboxFile);
        } catch (error) {
            console.error('天空盒转换失败:', error);
            alert(`转换失败: ${error.message}`);
        } finally {
            skyboxLoadingIndicator.classList.add('hidden');
            skyboxConvertBtn.disabled = false;
        }
    }

    async function convertWithAPI(file) {
        const formData = new FormData();
        formData.append('hdr', file, file.name);
        formData.append('faceSize', document.getElementById('skyboxFaceSizeOption').value);
        formData.append('format', document.getElementById('skyboxFormatOption').value);
        formData.append('toneMapping', document.getElementById('skyboxToneOption').value);
        formData.append('exposure', document.getElementById('skyboxExposureOption').value);

        const response = await fetch('/api/convert-hdr-cubemap', { method: 'POST', body: formData });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || err.details || `HTTP ${response.status}`);
        }

        const originalSize = parseInt(response.headers.get('X-Original-Size'));
        const convertedSize = parseInt(response.headers.get('X-Converted-Size'));
        const originalName = response.headers.get('X-Original-Name');
        const faceSize = response.headers.get('X-Face-Size');
        const format = response.headers.get('X-Output-Format');
        const blob = await response.blob();

        if (zipFileUrl) URL.revokeObjectURL(zipFileUrl);
        zipFileUrl = URL.createObjectURL(blob);

        const downloadFileName = `${skyboxFileBaseName}-skybox.zip`;
        skyboxDownloadLink.href = zipFileUrl;
        skyboxDownloadLink.download = downloadFileName;
        skyboxDownloadLink.classList.remove('hidden');

        const faceNames = ['px (+X 右)', 'nx (-X 左)', 'py (+Y 上)', 'ny (-Y 下)', 'pz (+Z 前)', 'nz (-Z 后)'];
        skyboxFacePreview.innerHTML = faceNames.map(name => `
            <div class="face-card">
                <span class="face-card-name">${name}</span>
                <span class="face-card-ext">.${format === 'jpeg' ? 'jpg' : format}</span>
            </div>
        `).join('');

        AppUtils.buildResultTable(skyboxResultTableBody, [
            { label: '文件名', original: originalName, result: downloadFileName, change: '-' },
            { label: '文件大小', original: AppUtils.formatFileSize(originalSize), result: AppUtils.formatFileSize(convertedSize), change: '-' },
            { label: '单面分辨率', original: '-', result: `${faceSize} × ${faceSize}`, change: '-' },
            { label: '输出格式', original: file.name.split('.').pop().toUpperCase(), result: format.toUpperCase(), change: '6 面' }
        ]);

        skyboxResultSection.classList.remove('hidden');
    }
});

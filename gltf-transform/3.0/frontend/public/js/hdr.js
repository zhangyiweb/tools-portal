TabManager.register('hdr', { showSidebar: false });

document.addEventListener('DOMContentLoaded', () => {
    checkToolAvailability();

    const hdrDropZone = document.getElementById('hdrDropZone');
    const hdrFileInput = document.getElementById('hdrFileInput');
    const hdrFileInfo = document.getElementById('hdrFileInfo');
    const hdrFileDetails = document.getElementById('hdrFileDetails');
    const hdrConvertOptions = document.getElementById('hdrConvertOptions');
    const hdrConvertBtn = document.getElementById('hdrConvertBtn');
    const hdrResultSection = document.getElementById('hdrResultSection');
    const hdrResultTableBody = document.getElementById('hdrResultTableBody');
    const hdrDownloadLink = document.getElementById('hdrDownloadLink');
    const hdrLoadingIndicator = document.getElementById('hdrLoadingIndicator');

    const VALID_EXTENSIONS = ['.hdr', '.exr'];
    let hdrFile = null;
    let hdrFileBaseName = '';
    let ktx2FileUrl = null;

    AppUtils.setupDropZone(hdrDropZone, hdrFileInput, handleHdrFiles);

    async function checkToolAvailability() {
        try {
            const res = await fetch('/api/tools-status');
            const status = await res.json();
            const banner = document.querySelector('#panel-hdr .info-banner span');
            if (status.hdrConversion && banner) {
                banner.innerHTML = `基于 <code>${status.hdrEngine || 'ktx2-encoder'}</code> npm 包（Basis Universal WASM）在服务端完成转换，无需额外安装系统工具。`;
            }
        } catch (_) { /* 忽略 */ }
    }

    function isValidHdrFile(file) {
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        return VALID_EXTENSIONS.includes(ext);
    }

    function handleHdrFiles(files) {
        const file = files[0];
        if (file && isValidHdrFile(file)) {
            hdrFile = file;
            hdrFileBaseName = file.name.replace(/\.[^.]+$/, '');
            showHdrFileInfo(file);
            hdrConvertOptions.classList.remove('hidden');
            hdrResultSection.classList.add('hidden');
        } else {
            alert('请选择有效的 HDR 或 EXR 文件');
        }
    }

    function showHdrFileInfo(file) {
        const ext = file.name.substring(file.name.lastIndexOf('.')).toUpperCase();
        hdrFileDetails.innerHTML = `
            <div class="info-row">
                <div class="info-item"><strong>文件名</strong>${file.name}</div>
                <div class="info-item"><strong>文件大小</strong>${AppUtils.formatFileSize(file.size)}</div>
                <div class="info-item"><strong>格式</strong>${ext}</div>
                <div class="info-item"><strong>目标格式</strong>KTX2</div>
            </div>
        `;
        hdrFileInfo.classList.remove('hidden');
    }

    hdrConvertBtn.addEventListener('click', startHdrConversion);

    async function startHdrConversion() {
        if (!hdrFile) {
            alert('请先上传 HDR 文件');
            return;
        }

        hdrLoadingIndicator.classList.remove('hidden');
        hdrConvertBtn.disabled = true;

        try {
            await convertHdrWithAPI(hdrFile);
        } catch (error) {
            console.error('HDR 转换失败:', error);
            alert(`转换失败: ${error.message}`);
        } finally {
            hdrLoadingIndicator.classList.add('hidden');
            hdrConvertBtn.disabled = false;
        }
    }

    async function convertHdrWithAPI(file) {
        const formData = new FormData();
        formData.append('hdr', file, file.name);
        formData.append('encode', document.getElementById('hdrEncodeOption').value);
        formData.append('mipmap', document.getElementById('hdrMipmapOption').checked);
        formData.append('zstd', document.getElementById('hdrZstdOption').checked);

        const response = await fetch('/api/convert-hdr', { method: 'POST', body: formData });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || err.details || `HTTP ${response.status}`);
        }

        const originalSize = parseInt(response.headers.get('X-Original-Size'));
        const convertedSize = parseInt(response.headers.get('X-Converted-Size'));
        const originalName = response.headers.get('X-Original-Name');
        const blob = await response.blob();

        if (ktx2FileUrl) URL.revokeObjectURL(ktx2FileUrl);
        ktx2FileUrl = URL.createObjectURL(blob);

        const downloadFileName = `${hdrFileBaseName}.ktx2`;
        hdrDownloadLink.href = ktx2FileUrl;
        hdrDownloadLink.download = downloadFileName;
        hdrDownloadLink.classList.remove('hidden');

        const sizeDiff = convertedSize - originalSize;
        const changeText = sizeDiff <= 0
            ? `${AppUtils.formatFileSize(Math.abs(sizeDiff))} 减小`
            : `${AppUtils.formatFileSize(sizeDiff)} 增大`;

        AppUtils.buildResultTable(hdrResultTableBody, [
            { label: '文件名', original: originalName, result: downloadFileName, change: '-' },
            { label: '文件大小', original: AppUtils.formatFileSize(originalSize), result: AppUtils.formatFileSize(convertedSize), change: changeText },
            { label: '编码格式', original: file.name.split('.').pop().toUpperCase(), result: document.getElementById('hdrEncodeOption').value, change: '-' }
        ]);

        hdrResultSection.classList.remove('hidden');
    }
});

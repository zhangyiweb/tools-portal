TabManager.register('compress', { showSidebar: true });

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

    AppUtils.setupDropZone(dropZone, fileInput, handleFiles);

    function handleFiles(files) {
        const file = files[0];
        if (file && file.name.toLowerCase().endsWith('.glb')) {
            originalFile = file;
            originalFileName = file.name.replace(/\.glb$/i, '');
            parseGlbInfo(file);
            compressionOptions.classList.remove('hidden');
        } else {
            alert('请选择一个有效的 GLB 文件');
        }
    }

    async function parseGlbInfo(file) {
        const fileSize = AppUtils.formatFileSize(file.size);
        let infoHtml = `
            <div class="info-row">
                <div class="info-item"><strong>文件名</strong>${file.name}</div>
                <div class="info-item"><strong>文件大小</strong>${fileSize}</div>
            </div>
        `;

        try {
            const buffer = await AppUtils.readFileAsArrayBuffer(file);
            const glbInfo = await analyzeGlbModel(buffer);
            displayModelTree(glbInfo);

            if (glbInfo) {
                infoHtml += `
                    <div class="info-row">
                        <div class="info-item"><strong>三角面数</strong>${glbInfo.triangles || '未知'}</div>
                        <div class="info-item"><strong>顶点数</strong>${glbInfo.vertices || '未知'}</div>
                        <div class="info-item"><strong>网格数</strong>${glbInfo.meshes || '未知'}</div>
                        <div class="info-item"><strong>节点数</strong>${glbInfo.nodes || '未知'}</div>
                        <div class="info-item"><strong>材质数</strong>${glbInfo.materials || '未知'}</div>
                        <div class="info-item"><strong>贴图数</strong>${glbInfo.textures || '未知'}</div>
                    </div>
                `;
            }
        } catch (error) {
            console.warn('无法解析 GLB 模型详细信息:', error);
            infoHtml += `<div class="info-item"><strong>模型详情</strong>无法解析模型详细信息</div>`;
        }

        originalModelDetails.innerHTML = infoHtml;
        modelInfo.classList.remove('hidden');
    }

    async function analyzeGlbModel(buffer) {
        try {
            const view = new DataView(buffer, 0, 12);
            if (view.getUint32(0, true) !== 0x46546C67) throw new Error('不是有效的 GLB 文件');
            if (view.getUint32(4, true) !== 2) throw new Error('仅支持 GLB 2.0 版本');

            const chunkLength = new DataView(buffer, 12, 4).getUint32(0, true);
            const chunkType = new DataView(buffer, 16, 4).getUint32(0, true);
            if (chunkType !== 0x4E4F534A) throw new Error('GLB 缺少 JSON 块');

            const json = JSON.parse(new TextDecoder().decode(buffer.slice(20, 20 + chunkLength)));
            const info = {};

            if (json.meshes) {
                info.meshes = json.meshes.length;
                info.triangles = 0;
                info.vertices = 0;

                for (const mesh of json.meshes) {
                    if (!mesh.primitives) continue;
                    for (const primitive of mesh.primitives) {
                        if (primitive.attributes.POSITION !== undefined && json.accessors) {
                            info.vertices += json.accessors[primitive.attributes.POSITION].count;
                        }
                        if (primitive.indices !== undefined && json.accessors) {
                            info.triangles += Math.floor(json.accessors[primitive.indices].count / 3);
                        } else if (primitive.mode === 4 && primitive.attributes.POSITION !== undefined && json.accessors) {
                            info.triangles += Math.floor(json.accessors[primitive.attributes.POSITION].count / 3);
                        }
                    }
                }
            }

            info.nodes = json.nodes ? json.nodes.length : 0;
            info.materials = json.materials ? json.materials.length : 0;
            info.textures = json.textures ? json.textures.length : 0;
            info.fullJson = json;
            return info;
        } catch (error) {
            console.error('解析 GLB 模型失败:', error);
            return null;
        }
    }

    function buildModelTree(glbInfo) {
        if (!glbInfo || !glbInfo.fullJson) return [];
        const json = glbInfo.fullJson;
        const treeData = [];

        if (json.scenes) {
            json.scenes.forEach((scene, sceneIndex) => {
                const sceneNode = {
                    title: `🏠 ${scene.name || `场景 ${sceneIndex}`}`,
                    id: `scene-${sceneIndex}`,
                    spread: false,
                    children: []
                };
                if (scene.nodes) {
                    scene.nodes.forEach(nodeIndex => {
                        const child = buildLayuiNode(json, nodeIndex);
                        if (child) sceneNode.children.push(child);
                    });
                }
                treeData.push(sceneNode);
            });
        }

        if (json.nodes) {
            const referenced = new Set();
            if (json.scenes) {
                json.scenes.forEach(scene => {
                    if (scene.nodes) scene.nodes.forEach(idx => {
                        referenced.add(idx);
                        collectChildNodes(json, idx, referenced);
                    });
                });
            }
            json.nodes.forEach((node, nodeIndex) => {
                if (!referenced.has(nodeIndex)) {
                    const child = buildLayuiNode(json, nodeIndex);
                    if (child) treeData.push(child);
                }
            });
        }

        return treeData;
    }

    function buildLayuiNode(json, nodeIndex) {
        if (!json.nodes || nodeIndex >= json.nodes.length) return null;
        const node = json.nodes[nodeIndex];
        let icon = '📦';
        if (node.mesh !== undefined) icon = '🔺';
        else if (node.camera !== undefined) icon = '📷';
        else if (node.skin !== undefined) icon = '🎭';

        const layuiNode = {
            title: `${icon} ${node.name || `节点 ${nodeIndex}`}`,
            id: `node-${nodeIndex}`,
            spread: false,
            children: []
        };

        if (node.children) {
            node.children.forEach(childIndex => {
                const child = buildLayuiNode(json, childIndex);
                if (child) layuiNode.children.push(child);
            });
        }
        return layuiNode;
    }

    function collectChildNodes(json, nodeIndex, referenced) {
        const node = json.nodes && json.nodes[nodeIndex];
        if (!node || !node.children) return;
        node.children.forEach(childIndex => {
            if (!referenced.has(childIndex)) {
                referenced.add(childIndex);
                collectChildNodes(json, childIndex, referenced);
            }
        });
    }

    function displayModelTree(glbInfo) {
        const modelTreeContainer = document.getElementById('modelTree');
        const placeholder = document.getElementById('sidebarPlaceholder');

        if (typeof layui !== 'undefined') {
            layui.use(['tree'], () => {
                layui.tree.render({
                    elem: '#modelTree',
                    data: buildModelTree(glbInfo),
                    showCheckbox: false,
                    onlyIconControl: true,
                    accordion: false,
                    isJump: false
                });
                modelTreeContainer.classList.remove('hidden');
                if (placeholder) placeholder.style.display = 'none';
            });
        } else {
            modelTreeContainer.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Layui 库加载失败</p>';
            modelTreeContainer.classList.remove('hidden');
        }
    }

    compressBtn.addEventListener('click', startCompression);

    async function startCompression() {
        if (!originalFile) {
            alert('请先上传一个 GLB 文件');
            return;
        }

        loadingIndicator.classList.remove('hidden');
        compressBtn.disabled = true;

        try {
            await compressWithAPI(
                originalFile,
                document.getElementById('ktx2Option').checked,
                document.getElementById('dracoOption').checked,
                document.getElementById('optimizeOption').checked
            );
        } catch (error) {
            console.error('压缩过程中发生错误:', error);
            alert('压缩过程中发生错误，请重试');
        } finally {
            loadingIndicator.classList.add('hidden');
            compressBtn.disabled = false;
        }
    }

    async function compressWithAPI(file, useKtx2, useDraco, useOptimize) {
        const formData = new FormData();
        formData.append('model', file, file.name);
        formData.append('ktx2', useKtx2);
        formData.append('draco', useDraco);
        formData.append('optimize', useOptimize);

        const response = await fetch('/api/compress', { method: 'POST', body: formData });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${response.status}`);
        }

        const originalSize = parseInt(response.headers.get('X-Original-Size'));
        const compressedSize = parseInt(response.headers.get('X-Compressed-Size'));
        const originalName = response.headers.get('X-Original-Name');
        const blob = await response.blob();

        if (compressedFileUrl) URL.revokeObjectURL(compressedFileUrl);
        compressedFileUrl = URL.createObjectURL(blob);
        downloadLink.href = compressedFileUrl;

        let suffix = '';
        if (useKtx2) suffix += '-webp';
        if (useDraco) suffix += '-draco';
        if (useOptimize) suffix += '-optimized';
        const downloadFileName = suffix ? `${originalFileName}${suffix}.glb` : `${originalFileName}.glb`;
        downloadLink.download = downloadFileName;
        downloadLink.classList.remove('hidden');

        const reduction = originalSize - compressedSize;
        const percentage = ((reduction / originalSize) * 100).toFixed(2);

        AppUtils.buildResultTable(resultTableBody, [
            { label: '文件名', original: originalName, result: downloadFileName, change: '-' },
            { label: '文件大小', original: AppUtils.formatFileSize(originalSize), result: AppUtils.formatFileSize(compressedSize), change: `${AppUtils.formatFileSize(reduction)} (${percentage}%)` },
            { label: '类型', original: file.type || 'application/octet-stream', result: 'application/octet-stream', change: '-' }
        ]);

        resultSection.classList.remove('hidden');
    }
});

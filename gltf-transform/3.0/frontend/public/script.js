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
    let treeInstance = null; // 存储树实例

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
            parseGlbInfo(file);
            
            // 显示压缩选项
            compressionOptions.classList.remove('hidden');
        } else {
            alert('请选择一个有效的GLB文件');
        }
    }

    // 解析GLB模型信息
    async function parseGlbInfo(file) {
        const fileSize = formatFileSize(file.size);
        
        // 首先显示基本文件信息
        let infoHtml = `
            <div class="info-row">
                <div class="info-item">
                    <strong>文件名:</strong> ${file.name}
                </div>
                <div class="info-item">
                    <strong>文件大小:</strong> ${fileSize}
                </div>
            </div>
        `;
        
        try {
            // 读取文件内容
            const buffer = await readFileAsArrayBuffer(file);
            
            // 尝试解析GLB头部信息
            const glbInfo = await analyzeGlbModel(buffer);
            
            // 显示模型树
            displayModelTree(glbInfo);
            
            // 添加模型详细信息
            if (glbInfo) {
                infoHtml += `
                    <div class="info-row">
                        <div class="info-item">
                            <strong>三角面数:</strong> ${glbInfo.triangles || '未知'}
                        </div>
                        <div class="info-item">
                            <strong>顶点数:</strong> ${glbInfo.vertices || '未知'}
                        </div>
                        <div class="info-item">
                            <strong>网格数:</strong> ${glbInfo.meshes || '未知'}
                        </div>
                        <div class="info-item">
                            <strong>节点数:</strong> ${glbInfo.nodes || '未知'}
                        </div>
                        <div class="info-item">
                            <strong>材质数:</strong> ${glbInfo.materials || '未知'}
                        </div>
                        <div class="info-item">
                            <strong>贴图数:</strong> ${glbInfo.textures || '未知'}
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            console.warn('无法解析GLB模型详细信息:', error);
            infoHtml += `
                <div class="info-item">
                    <strong>模型详情:</strong> 无法解析模型详细信息
                </div>
            `;
        }
        
        originalModelDetails.innerHTML = infoHtml;
        modelInfo.classList.remove('hidden');
    }
    
    // 读取文件为ArrayBuffer
    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }
    
    // 分析GLB模型数据
    async function analyzeGlbModel(buffer) {
        try {
            // 检查GLB魔数
            const view = new DataView(buffer, 0, 12);
            const magic = view.getUint32(0, true); // 小端字节序
            if (magic !== 0x46546C67) { // 'glTF'
                throw new Error('不是有效的GLB文件');
            }
            
            // GLB版本
            const version = view.getUint32(4, true);
            if (version !== 2) {
                throw new Error('仅支持GLB 2.0版本');
            }
            
            // 解析JSON部分
            const length = view.getUint32(8, true);
            const chunkLength = new DataView(buffer, 12, 4).getUint32(0, true);
            const chunkType = new DataView(buffer, 16, 4).getUint32(0, true);
            
            if (chunkType !== 0x4E4F534A) { // 'JSON'
                throw new Error('GLB缺少JSON块');
            }
            
            const jsonString = new TextDecoder().decode(buffer.slice(20, 20 + chunkLength));
            const json = JSON.parse(jsonString);
            
            // 提取模型信息
            const info = {};
            
            // 计算三角面数和顶点数
            if (json.meshes) {
                info.meshes = json.meshes.length;
                info.triangles = 0;
                info.vertices = 0;
                
                for (const mesh of json.meshes) {
                    if (mesh.primitives) {
                        for (const primitive of mesh.primitives) {
                            // 获取顶点数量（通过POSITION属性）
                            if (primitive.attributes.POSITION && json.accessors && json.accessors[primitive.attributes.POSITION]) {
                                const accessor = json.accessors[primitive.attributes.POSITION];
                                info.vertices += accessor.count;
                            }
                            
                            // 计算三角面数（通过INDICES）
                            if (primitive.indices && json.accessors && json.accessors[primitive.indices]) {
                                const accessor = json.accessors[primitive.indices];
                                // 通常每3个索引组成一个三角形
                                info.triangles += Math.floor(accessor.count / 3);
                            } else if (primitive.mode === 4) { // TRIANGLES模式
                                // 如果没有indices，使用POSITION的count计算
                                if (primitive.attributes.POSITION && json.accessors && json.accessors[primitive.attributes.POSITION]) {
                                    const accessor = json.accessors[primitive.attributes.POSITION];
                                    info.triangles += Math.floor(accessor.count / 3);
                                }
                            }
                        }
                    }
                }
            }
            
            // 计算节点数
            info.nodes = json.nodes ? json.nodes.length : 0;
            
            // 计算材质数
            info.materials = json.materials ? json.materials.length : 0;
            
            // 计算贴图数
            info.textures = json.textures ? json.textures.length : 0;
            
            // 保存完整的JSON数据用于构建树
            info.fullJson = json;
            
            return info;
        } catch (error) {
            console.error('解析GLB模型失败:', error);
            return null;
        }
    }
    
    // 使用Layui构建模型树形结构
    function buildModelTree(glbInfo) {
        if (!glbInfo || !glbInfo.fullJson) {
            return [];
        }
        
        const json = glbInfo.fullJson;
        let treeData = [];
        
        // 添加场景节点
        if (json.scenes && json.scenes.length > 0) {
            json.scenes.forEach((scene, sceneIndex) => {
                const sceneName = scene.name || `场景 ${sceneIndex}`;
                
                let sceneNode = {
                    title: `🏠 ${sceneName}`,
                    id: `scene-${sceneIndex}`,
                    spread: false,
                    children: []
                };
                
                if (scene.nodes && scene.nodes.length > 0) {
                    scene.nodes.forEach(nodeIndex => {
                        const childNode = buildLayuiNode(json, nodeIndex, 1);
                        if (childNode) sceneNode.children.push(childNode);
                    });
                }
                
                treeData.push(sceneNode);
            });
        }
        
        // 添加单独的节点（不在任何场景中的）
        if (json.nodes) {
            const referencedNodes = new Set();
            if (json.scenes) {
                json.scenes.forEach(scene => {
                    if (scene.nodes) {
                        scene.nodes.forEach(nodeIdx => {
                            referencedNodes.add(nodeIdx);
                            // 检查子节点
                            collectChildNodes(json, nodeIdx, referencedNodes);
                        });
                    }
                });
            }
            
            // 添加未被引用的节点
            json.nodes.forEach((node, nodeIndex) => {
                if (!referencedNodes.has(nodeIndex)) {
                    const childNode = buildLayuiNode(json, nodeIndex, 0);
                    if (childNode) treeData.push(childNode);
                }
            });
        }
        
        return treeData;
    }
    
    // 递归构建Layui节点
    function buildLayuiNode(json, nodeIndex, depth) {
        if (!json.nodes || nodeIndex >= json.nodes.length) return null;
        
        const node = json.nodes[nodeIndex];
        const nodeName = node.name || `节点 ${nodeIndex}`;
        
        let icon = '📦'; // 默认图标
        if (node.mesh !== undefined) {
            icon = '🔺'; // 网格节点
        } else if (node.camera !== undefined) {
            icon = '📷'; // 相机节点
        } else if (node.skin !== undefined) {
            icon = '🎭'; // 蒙皮节点
        }
        
        let layuiNode = {
            title: `${icon} ${nodeName}`,
            id: `node-${nodeIndex}`,
            spread: false,
            children: []
        };
        
        // 如果有子节点，递归添加
        if (node.children && node.children.length > 0) {
            node.children.forEach(childIndex => {
                const childNode = buildLayuiNode(json, childIndex, depth + 1);
                if (childNode) layuiNode.children.push(childNode);
            });
        }
        
        return layuiNode;
    }
    
    // 递归收集子节点
    function collectChildNodes(json, nodeIndex, referencedNodes) {
        if (json.nodes && json.nodes[nodeIndex] && json.nodes[nodeIndex].children) {
            json.nodes[nodeIndex].children.forEach(childIndex => {
                if (!referencedNodes.has(childIndex)) {
                    referencedNodes.add(childIndex);
                    collectChildNodes(json, childIndex, referencedNodes);
                }
            });
        }
    }
    
    // 显示模型树
    function displayModelTree(glbInfo) {
        const modelTreeContainer = document.getElementById('modelTree');
        
        // 确保Layui已加载
        if (typeof layui !== 'undefined') {
            layui.use(['tree'], function(){
                var tree = layui.tree;
                
                var treeData = buildModelTree(glbInfo);
                
                // 渲染树形组件
                treeInstance = tree.render({
                    elem: '#modelTree',
                    data: treeData,
                    showCheckbox: false,  // 不显示复选框
                    onlyIconControl: true,  // 仅允许图标控制展开收缩
                    accordion: false,  // 不开启手风琴模式
                    isJump: false,  // 点击节点不跳转
                    click: function(obj){
                        console.log(obj);  // 点击节点回调
                    }
                });
                
                modelTreeContainer.classList.remove('hidden');
            });
        } else {
            // 如果Layui未加载，显示错误信息
            modelTreeContainer.innerHTML = '<p>Layui库加载失败</p>';
            modelTreeContainer.classList.remove('hidden');
        }
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

            // 获取响应头中的压缩信息
            const originalSize = response.headers.get('X-Original-Size');
            const compressedSize = response.headers.get('X-Compressed-Size');
            const originalName = response.headers.get('X-Original-Name');
            
            // 从响应中获取二进制数据
            const blob = await response.blob();
            
            if (compressedFileUrl) {
                URL.revokeObjectURL(compressedFileUrl); // 清理旧URL
            }
            
            // 创建Blob URL用于下载
            compressedFileUrl = URL.createObjectURL(blob);
            
            downloadLink.href = compressedFileUrl;
            
            // 根据用户选择的选项生成下载文件名
            const useKtx2 = document.getElementById('ktx2Option').checked;
            const useDraco = document.getElementById('dracoOption').checked;
            const useOptimize = document.getElementById('optimizeOption').checked;
            
            let downloadFileName = originalFileName;
            
            // 根据用户选择构建文件名后缀
            let suffix = '';
            if (useKtx2) suffix += '-ktx2';
            if (useDraco) suffix += '-draco';
            if (useOptimize) suffix += '-optimized';
            
            if (suffix) {
                downloadFileName += suffix + '.glb';
            } else {
                // 如果没有选择任何选项，使用原始文件名
                downloadFileName += '.glb';
            }
            
            downloadLink.download = downloadFileName;
            downloadLink.classList.remove('hidden');
            
            // 创建模拟的结果对象用于显示
            const result = {
                original: {
                    name: originalName,
                    size: parseInt(originalSize)
                },
                compressed: {
                    name: downloadFileName,
                    size: parseInt(compressedSize)
                },
                reduction: {
                    bytes: parseInt(originalSize) - parseInt(compressedSize),
                    percentage: (((parseInt(originalSize) - parseInt(compressedSize)) / parseInt(originalSize)) * 100).toFixed(2)
                }
            };
            
            // 显示结果对比
            showRealCompressionResults(file, result);
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
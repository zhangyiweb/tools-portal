import * as THREE from 'three';
import GUI from 'lil-gui';

const SIDE_OPTIONS = { 正面: THREE.FrontSide, 背面: THREE.BackSide, 双面: THREE.DoubleSide };

const TEXTURE_SLOTS = {
  MeshBasicMaterial: [
    ['map', '颜色贴图'],
    ['alphaMap', '透明贴图'],
    ['aoMap', 'AO 贴图'],
    ['lightMap', '光照贴图'],
    ['envMap', '环境贴图'],
  ],
  MeshStandardMaterial: [
    ['map', '颜色贴图'],
    ['normalMap', '法线贴图'],
    ['roughnessMap', '粗糙度贴图'],
    ['metalnessMap', '金属度贴图'],
    ['emissiveMap', '自发光贴图'],
    ['aoMap', 'AO 贴图'],
    ['alphaMap', '透明贴图'],
    ['bumpMap', '凹凸贴图'],
    ['displacementMap', '位移贴图'],
    ['envMap', '环境贴图'],
  ],
  MeshPhysicalMaterial: [
    ['map', '颜色贴图'],
    ['normalMap', '法线贴图'],
    ['roughnessMap', '粗糙度贴图'],
    ['metalnessMap', '金属度贴图'],
    ['emissiveMap', '自发光贴图'],
    ['aoMap', 'AO 贴图'],
    ['alphaMap', '透明贴图'],
    ['clearcoatMap', '清漆贴图'],
    ['clearcoatNormalMap', '清漆法线贴图'],
    ['clearcoatRoughnessMap', '清漆粗糙度贴图'],
    ['envMap', '环境贴图'],
  ],
  MeshLambertMaterial: [
    ['map', '颜色贴图'],
    ['alphaMap', '透明贴图'],
    ['aoMap', 'AO 贴图'],
    ['emissiveMap', '自发光贴图'],
    ['envMap', '环境贴图'],
  ],
  MeshPhongMaterial: [
    ['map', '颜色贴图'],
    ['normalMap', '法线贴图'],
    ['alphaMap', '透明贴图'],
    ['bumpMap', '凹凸贴图'],
    ['emissiveMap', '自发光贴图'],
    ['envMap', '环境贴图'],
  ],
};

/** 贴图槽对应的强度属性（key → 材质字段或自定义读写） */
const TEXTURE_INTENSITY = {
  map: {
    label: '贴图强度',
    min: 0,
    max: 2,
    step: 0.01,
    get(material) {
      return material.userData.__mapIntensity ?? 1;
    },
    set(material, v) {
      ensureMapBaseColor(material);
      material.userData.__mapIntensity = v;
      material.color.copy(material.userData.__mapBaseColor).multiplyScalar(v);
    },
  },
  aoMap: { prop: 'aoMapIntensity', label: '强度', min: 0, max: 1, step: 0.01 },
  bumpMap: { prop: 'bumpScale', label: '强度', min: 0, max: 2, step: 0.01 },
  displacementMap: { prop: 'displacementScale', label: '强度', min: 0, max: 1, step: 0.001 },
  normalMap: { prop: 'normalScale', label: '法线强度', type: 'vector2', min: 0, max: 2, step: 0.01 },
  lightMap: { prop: 'lightMapIntensity', label: '强度', min: 0, max: 1, step: 0.01 },
  envMap: { prop: 'envMapIntensity', label: '反射强度', min: 0, max: 5, step: 0.01 },
  emissiveMap: { prop: 'emissiveIntensity', label: '强度', min: 0, max: 5, step: 0.01 },
  clearcoatNormalMap: { prop: 'clearcoatNormalScale', label: '法线强度', type: 'vector2', min: 0, max: 2, step: 0.01 },
  clearcoatMap: { prop: 'clearcoat', label: '清漆强度', min: 0, max: 1, step: 0.01 },
  clearcoatRoughnessMap: { prop: 'clearcoatRoughness', label: '粗糙度', min: 0, max: 1, step: 0.01 },
};

const SRGB_TEXTURE_KEYS = new Set(['map', 'emissiveMap']);
/** 不参与 UV 平铺的贴图（如环境贴图） */
const NON_TILING_TEXTURE_KEYS = new Set(['envMap']);
const textureLoader = new THREE.TextureLoader();

let activeGui = null;
let selectedMesh = null;
let selectedMaterial = null;
let pendingTextureTarget = null;
let textureFileInput = null;
let currentTexturesContainer = null;
let currentGuiContainer = null;

const _uvPos = new THREE.Vector3();
const _uvNormal = new THREE.Vector3();
const _uvSize = new THREE.Vector3();

/** 按顶点法线方向做立方体投影，为无 UV 的几何体生成 UV */
function generateBoxUvs(geometry) {
  if (!geometry?.attributes?.position) return false;

  geometry.computeBoundingBox();
  if (!geometry.attributes.normal) {
    geometry.computeVertexNormals();
  }

  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const bbox = geometry.boundingBox;
  bbox.getSize(_uvSize);
  _uvSize.x = Math.max(_uvSize.x, 1e-6);
  _uvSize.y = Math.max(_uvSize.y, 1e-6);
  _uvSize.z = Math.max(_uvSize.z, 1e-6);

  const uvs = new Float32Array(position.count * 2);

  for (let i = 0; i < position.count; i++) {
    _uvPos.fromBufferAttribute(position, i);
    _uvNormal.fromBufferAttribute(normal, i);

    const ax = Math.abs(_uvNormal.x);
    const ay = Math.abs(_uvNormal.y);
    const az = Math.abs(_uvNormal.z);

    let u;
    let v;
    if (ax >= ay && ax >= az) {
      u = (_uvPos.z - bbox.min.z) / _uvSize.z;
      v = (_uvPos.y - bbox.min.y) / _uvSize.y;
    } else if (ay >= ax && ay >= az) {
      u = (_uvPos.x - bbox.min.x) / _uvSize.x;
      v = (_uvPos.z - bbox.min.z) / _uvSize.z;
    } else {
      u = (_uvPos.x - bbox.min.x) / _uvSize.x;
      v = (_uvPos.y - bbox.min.y) / _uvSize.y;
    }

    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  delete geometry.userData.__uvBase;
  delete geometry.userData.__uvTransform;
  return true;
}

/** 若 mesh 无 UV 则自动生成，返回是否本次新建 */
export function ensureMeshUvs(mesh) {
  const geometry = mesh?.geometry;
  if (!geometry?.attributes?.position) {
    return { hadUv: false, generated: false };
  }
  if (geometry.attributes.uv) {
    return { hadUv: true, generated: false };
  }
  return { hadUv: false, generated: generateBoxUvs(geometry) };
}

function ensureBaseUvs(geometry) {
  const uv = geometry?.attributes?.uv;
  if (!uv || geometry.userData.__uvBase) return;
  geometry.userData.__uvBase = new Float32Array(uv.array);
}

function getUvParams(geometry) {
  if (!geometry.userData.__uvTransform) {
    geometry.userData.__uvTransform = {
      scaleU: 1,
      scaleV: 1,
      offsetU: 0,
      offsetV: 0,
      rotation: 0,
    };
  }
  return geometry.userData.__uvTransform;
}

function applyUvTransform(mesh) {
  const geometry = mesh?.geometry;
  const uv = geometry?.attributes?.uv;
  const base = geometry?.userData?.__uvBase;
  if (!uv || !base) return;

  const { scaleU, scaleV, offsetU, offsetV, rotation } = getUvParams(geometry);
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = 0.5;
  const cy = 0.5;

  for (let i = 0; i < uv.count; i++) {
    let u = base[i * 2];
    let v = base[i * 2 + 1];

    u = (u - cx) * scaleU + cx;
    v = (v - cy) * scaleV + cy;

    const du = u - cx;
    const dv = v - cy;
    u = du * cos - dv * sin + cx;
    v = du * sin + dv * cos + cy;

    u += offsetU;
    v += offsetV;

    uv.setXY(i, u, v);
  }

  uv.needsUpdate = true;
}

function resetUvTransform(mesh) {
  const geometry = mesh?.geometry;
  const uv = geometry?.attributes?.uv;
  const base = geometry?.userData?.__uvBase;
  if (!uv || !base) return;

  geometry.userData.__uvTransform = {
    scaleU: 1,
    scaleV: 1,
    offsetU: 0,
    offsetV: 0,
    rotation: 0,
  };
  uv.array.set(base);
  uv.needsUpdate = true;

  if (activeGui) {
    buildMaterialGui(selectedMaterial, currentGuiContainer, mesh);
  }
}

function addUvControls(gui, mesh) {
  const geometry = mesh?.geometry;
  if (!geometry?.attributes?.position) return;

  ensureMeshUvs(mesh);
  if (!geometry.attributes.uv) return;

  ensureBaseUvs(geometry);
  const params = getUvParams(geometry);

  const folder = gui.addFolder('UV 坐标');
  const onUvChange = () => applyUvTransform(mesh);

  folder.add(params, 'scaleU', 0.01, 10, 0.01).name('U 缩放').onChange(onUvChange);
  folder.add(params, 'scaleV', 0.01, 10, 0.01).name('V 缩放').onChange(onUvChange);
  folder.add(params, 'offsetU', -2, 2, 0.01).name('U 偏移').onChange(onUvChange);
  folder.add(params, 'offsetV', -2, 2, 0.01).name('V 偏移').onChange(onUvChange);
  folder.add(params, 'rotation', -180, 180, 1).name('旋转 (°)').onChange(onUvChange);

  const actions = {
    重置() {
      resetUvTransform(mesh);
    },
    重新生成() {
      generateBoxUvs(geometry);
      geometry.userData.__uvTransform = {
        scaleU: 1,
        scaleV: 1,
        offsetU: 0,
        offsetV: 0,
        rotation: 0,
      };
      ensureBaseUvs(geometry);
      if (activeGui) {
        buildMaterialGui(selectedMaterial, currentGuiContainer, mesh);
      }
    },
  };
  folder.add(actions, '重置');
  folder.add(actions, '重新生成');
  folder.open();
}

function iterateMaterialTextures(material) {
  const textures = [];
  if (!material) return textures;
  for (const key of Object.keys(material)) {
    if (NON_TILING_TEXTURE_KEYS.has(key)) continue;
    const texture = material[key];
    if (texture?.isTexture) textures.push(texture);
  }
  return textures;
}

function applyTextureTiling(texture) {
  if (!texture?.isTexture) return;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
}

export function applyAllTextureTiling(material) {
  if (!material) return;
  for (const texture of iterateMaterialTextures(material)) {
    applyTextureTiling(texture);
  }
  refreshMaterial(material);
}

/** 打开面板时通用属性的默认值 */
function applyCommonDefaults(material) {
  material.transparent = false;
  material.opacity = 1;
  material.depthTest = true;
  material.depthWrite = true;
  material.alphaTest = 0;
  material.visible = true;
  material.side = THREE.FrontSide;
  if ('alphaHash' in material) material.alphaHash = false;
  refreshMaterial(material);
}

function destroyGui() {
  if (activeGui) {
    activeGui.destroy();
    activeGui = null;
  }
}

function getMaterial(mesh, materialIndex) {
  if (!mesh?.material) return null;
  if (Array.isArray(mesh.material)) {
    return mesh.material[materialIndex ?? 0] ?? mesh.material[0];
  }
  return mesh.material;
}

function refreshMaterial(material) {
  material.needsUpdate = true;
}

/** map 无原生强度，用 color 作为乘数；缓存未缩放的基础色 */
function ensureMapBaseColor(material) {
  if (!material.userData.__mapBaseColor) {
    material.userData.__mapBaseColor = material.color.clone();
  }
  if (material.userData.__mapIntensity === undefined) {
    material.userData.__mapIntensity = 1;
  }
}

function syncMapBaseColorFromPicker(material) {
  if (!material.map) return;
  ensureMapBaseColor(material);
  const intensity = material.userData.__mapIntensity || 1;
  material.userData.__mapBaseColor.copy(material.color).multiplyScalar(1 / intensity);
}

function onMaterialColorChange(material) {
  syncMapBaseColorFromPicker(material);
  refreshMaterial(material);
}

function getTextureSlots(material) {
  const slots = TEXTURE_SLOTS[material.type] ?? TEXTURE_SLOTS.MeshStandardMaterial;
  const keys = new Set(slots.map(([key]) => key));
  for (const key of Object.keys(material)) {
    if (material[key]?.isTexture && !keys.has(key)) {
      slots.push([key, key]);
    }
  }
  return slots;
}

function applyTextureColorSpace(texture, key) {
  texture.colorSpace = SRGB_TEXTURE_KEYS.has(key)
    ? THREE.SRGBColorSpace
    : THREE.NoColorSpace;
  texture.flipY = false;
  texture.needsUpdate = true;
}

function configureTexture(texture) {
  applyTextureTiling(texture);
}

async function loadTextureFromFile(material, key, file) {
  const url = URL.createObjectURL(file);
  try {
    const texture = await textureLoader.loadAsync(url);
    texture.name = file.name;
    applyTextureColorSpace(texture, key);
    configureTexture(texture);
    if (material[key]) material[key].dispose();
    material[key] = texture;
    if (key === 'map') {
      ensureMapBaseColor(material);
      material.color.copy(material.userData.__mapBaseColor).multiplyScalar(material.userData.__mapIntensity);
    }
    refreshMaterial(material);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function removeTexture(material, key) {
  if (material[key]) {
    material[key].dispose();
    material[key] = null;
    if (key === 'map' && material.userData.__mapBaseColor) {
      material.color.copy(material.userData.__mapBaseColor);
      delete material.userData.__mapIntensity;
      delete material.userData.__mapBaseColor;
    }
    refreshMaterial(material);
  }
}

function ensureTextureFileInput() {
  if (textureFileInput) return textureFileInput;
  textureFileInput = document.createElement('input');
  textureFileInput.type = 'file';
  textureFileInput.accept = 'image/*';
  textureFileInput.hidden = true;
  document.body.appendChild(textureFileInput);
  textureFileInput.addEventListener('change', async () => {
    const file = textureFileInput.files?.[0];
    if (!file || !pendingTextureTarget) return;
    const { material, key } = pendingTextureTarget;
    try {
      await loadTextureFromFile(material, key, file);
      if (currentTexturesContainer) {
        renderTextureSlots(material, currentTexturesContainer, currentGuiContainer);
      }
    } catch (err) {
      console.error(err);
      alert(`贴图加载失败: ${err.message}`);
    } finally {
      textureFileInput.value = '';
      pendingTextureTarget = null;
    }
  });
  return textureFileInput;
}

function shouldShowTextureIntensity(material, key, texture, config) {
  if (!config || !texture) return false;
  if (typeof config.get === 'function') return true;
  return config.prop in material;
}

function formatIntensityValue(value, step) {
  const decimals = step < 0.01 ? 3 : 2;
  return Number(value).toFixed(decimals);
}

function createIntensitySlider(material, config, axis) {
  const { label, min, max, step, type, prop } = config;
  const isVec2 = type === 'vector2';
  const useProxy = typeof config.get === 'function';

  const readValue = () => {
    if (useProxy) return config.get(material, axis);
    return isVec2 ? material[prop][axis] : material[prop];
  };

  const writeValue = (v) => {
    if (useProxy) {
      config.set(material, v, axis);
    } else if (isVec2) {
      material[prop][axis] = v;
    } else {
      material[prop] = v;
    }
    refreshMaterial(material);
  };

  const row = document.createElement('div');
  row.className = 'tex-intensity-row';

  const labelEl = document.createElement('span');
  labelEl.className = 'tex-intensity-label';
  labelEl.textContent = isVec2 ? (axis === 'x' ? 'X' : 'Y') : label;

  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'tex-intensity-input';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(readValue());

  const valueEl = document.createElement('span');
  valueEl.className = 'tex-intensity-value';
  valueEl.textContent = formatIntensityValue(input.value, step);

  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    writeValue(v);
    valueEl.textContent = formatIntensityValue(v, step);
  });

  row.append(labelEl, input, valueEl);
  return row;
}

function appendTextureIntensityControls(row, material, key, texture) {
  const config = TEXTURE_INTENSITY[key];
  if (!shouldShowTextureIntensity(material, key, texture, config)) return;

  const block = document.createElement('div');
  block.className = 'tex-intensity';

  if (config.type === 'vector2') {
    block.append(
      createIntensitySlider(material, config, 'x'),
      createIntensitySlider(material, config, 'y'),
    );
  } else {
    block.append(createIntensitySlider(material, config));
  }

  row.appendChild(block);
}

function renderTextureSlots(material, container, guiContainer) {
  if (!container) return;
  currentTexturesContainer = container;
  currentGuiContainer = guiContainer;
  container.innerHTML = '';

  const slots = getTextureSlots(material);
  for (const [key, label] of slots) {
    const texture = material[key];
    if (key === 'map' && texture) ensureMapBaseColor(material);
    const row = document.createElement('div');
    row.className = `tex-row ${texture ? 'tex-row--bound' : 'tex-row--empty'}`;

    const head = document.createElement('div');
    head.className = 'tex-head';
    head.innerHTML = `
      <div class="tex-head-left">
        <span class="tex-label">${label}</span>
        <span class="tex-key">${key}</span>
      </div>
      <span class="tex-status ${texture ? 'tex-status--bound' : 'tex-status--empty'}">${texture ? '已添加' : '未添加'}</span>
    `;

    const actions = document.createElement('div');
    actions.className = 'tex-actions';

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'tex-btn';
    addBtn.textContent = texture ? '替换' : '添加';
    addBtn.addEventListener('click', () => {
      pendingTextureTarget = { material, key };
      ensureTextureFileInput().click();
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'tex-btn tex-btn-danger';
    removeBtn.textContent = '删除';
    removeBtn.disabled = !texture;
    removeBtn.addEventListener('click', () => {
      removeTexture(material, key);
      renderTextureSlots(material, container, guiContainer);
    });

    actions.append(addBtn, removeBtn);
    row.append(head, actions);
    appendTextureIntensityControls(row, material, key, texture);
    container.appendChild(row);
  }
}

function attachTextureSlots(folder, material, guiContainer) {
  const container = document.createElement('div');
  container.className = 'tex-slots';
  folder.domElement.appendChild(container);
  renderTextureSlots(material, container, guiContainer);
}

function addCommonMaterialControls(folder, material) {
  folder.add(material, 'transparent').name('透明').onChange(() => refreshMaterial(material));
  folder.add(material, 'opacity', 0, 1, 0.01).name('透明度').onChange((v) => {
    if (v < 1) material.transparent = true;
    refreshMaterial(material);
  });
  folder.add(material, 'depthTest').name('深度测试');
  folder.add(material, 'depthWrite').name('深度写入');
  folder.add(material, 'alphaTest', 0, 1, 0.01).name('Alpha 裁切').onChange(() => refreshMaterial(material));
  if ('alphaHash' in material) {
    folder.add(material, 'alphaHash').name('Alpha 哈希').onChange(() => refreshMaterial(material));
  }
  folder.add(material, 'visible').name('可见');
  folder.add(material, 'side', SIDE_OPTIONS).name('渲染面');
}

function addBasicMaterialControls(folder, material) {
  folder.addColor(material, 'color').name('颜色').onChange(() => onMaterialColorChange(material));
  folder.add(material, 'wireframe').name('线框');
  if ('vertexColors' in material) {
    folder.add(material, 'vertexColors').name('顶点色');
  }
  if ('fog' in material) {
    folder.add(material, 'fog').name('雾效');
  }
}

function addStandardMaterialControls(folder, material) {
  folder.addColor(material, 'color').name('颜色').onChange(() => onMaterialColorChange(material));
  folder.add(material, 'roughness', 0, 1, 0.01).name('粗糙度');
  folder.add(material, 'metalness', 0, 1, 0.01).name('金属度');
  folder.addColor(material, 'emissive').name('自发光色').onChange(() => refreshMaterial(material));
  folder.add(material, 'emissiveIntensity', 0, 5, 0.01).name('自发光强度');
  if ('envMapIntensity' in material) {
    folder.add(material, 'envMapIntensity', 0, 5, 0.01).name('环境反射强度');
  }
  folder.add(material, 'wireframe').name('线框');
  if ('flatShading' in material) {
    folder.add(material, 'flatShading').name('平面着色');
  }
}

function addPhysicalMaterialControls(folder, material) {
  addStandardMaterialControls(folder, material);
  if ('clearcoat' in material) {
    const coat = folder.addFolder('清漆层');
    coat.add(material, 'clearcoat', 0, 1, 0.01).name('清漆');
    coat.add(material, 'clearcoatRoughness', 0, 1, 0.01).name('清漆粗糙度');
  }
}

function addLambertPhongControls(folder, material) {
  folder.addColor(material, 'color').name('颜色').onChange(() => onMaterialColorChange(material));
  if ('emissive' in material) {
    folder.addColor(material, 'emissive').name('自发光色').onChange(() => refreshMaterial(material));
  }
  if ('emissiveIntensity' in material) {
    folder.add(material, 'emissiveIntensity', 0, 5, 0.01).name('自发光强度');
  }
  if ('shininess' in material) {
    folder.add(material, 'shininess', 0, 200, 1).name('高光度');
  }
  if ('specular' in material) {
    folder.addColor(material, 'specular').name('高光色').onChange(() => refreshMaterial(material));
  }
  folder.add(material, 'wireframe').name('线框');
}

function buildMaterialGui(material, container, mesh) {
  destroyGui();
  currentTexturesContainer = null;
  currentGuiContainer = container;

  const gui = new GUI({ container, title: material.type });
  activeGui = gui;

  if (mesh) addUvControls(gui, mesh);

  const common = gui.addFolder('THREE.Material');
  addCommonMaterialControls(common, material);
  common.open();

  let specific;
  if (material.isMeshBasicMaterial) {
    specific = gui.addFolder('THREE.MeshBasicMaterial');
    addBasicMaterialControls(specific, material);
    specific.open();
  } else if (material.isMeshStandardMaterial) {
    specific = gui.addFolder('THREE.MeshStandardMaterial');
    addStandardMaterialControls(specific, material);
    specific.open();
  } else if (material.isMeshPhysicalMaterial) {
    specific = gui.addFolder('THREE.MeshPhysicalMaterial');
    addPhysicalMaterialControls(specific, material);
    specific.open();
  } else if (material.isMeshLambertMaterial) {
    specific = gui.addFolder('THREE.MeshLambertMaterial');
    addLambertPhongControls(specific, material);
    specific.open();
  } else if (material.isMeshPhongMaterial) {
    specific = gui.addFolder('THREE.MeshPhongMaterial');
    addLambertPhongControls(specific, material);
    specific.open();
  } else {
    specific = gui.addFolder(material.type);
    if ('color' in material) specific.addColor(material, 'color').name('颜色');
    if ('roughness' in material) specific.add(material, 'roughness', 0, 1, 0.01).name('粗糙度');
    if ('metalness' in material) specific.add(material, 'metalness', 0, 1, 0.01).name('金属度');
    if ('wireframe' in material) specific.add(material, 'wireframe').name('线框');
    specific.open();
  }

  attachTextureSlots(specific, material, container);
  return gui;
}

export function closeMaterialPanel(panelEl, infoEl) {
  destroyGui();
  selectedMesh = null;
  selectedMaterial = null;
  currentTexturesContainer = null;
  panelEl.classList.add('hidden');
  if (infoEl) infoEl.textContent = '';
}

function openMaterialPanel(mesh, material, panelEl, infoEl, guiContainer) {
  if (!material) return;

  applyCommonDefaults(material);

  const uvStatus = ensureMeshUvs(mesh);

  selectedMesh = mesh;
  selectedMaterial = material;

  panelEl.classList.remove('hidden');
  infoEl.innerHTML = `
    <div><strong>网格：</strong>${mesh.name || '未命名'}</div>
    <div><strong>材质：</strong>${material.name || material.type}</div>
    ${uvStatus.generated ? '<div class="material-panel-note">该模型原本无 UV，已自动生成立方体投影 UV</div>' : ''}
  `;

  buildMaterialGui(material, guiContainer, mesh);
}

function pickMesh(scene, camera, canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  const meshes = [];
  scene.modelsGroup.traverse((child) => {
    if (child.isMesh) meshes.push(child);
  });

  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length === 0) return null;

  const hit = hits[0];
  const mesh = hit.object;
  const material = getMaterial(mesh, hit.face?.materialIndex);
  return { mesh, material };
}

export function initMaterialEditor(scene, elements) {
  const { canvas, panel, info, guiContainer, closeBtn } = elements;
  let pointerDown = { x: 0, y: 0 };

  const close = () => closeMaterialPanel(panel, info);

  closeBtn.addEventListener('click', close);

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    pointerDown = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('pointerup', (e) => {
    if (e.button !== 0) return;

    const dx = e.clientX - pointerDown.x;
    const dy = e.clientY - pointerDown.y;
    if (dx * dx + dy * dy > 36) return;

    const picked = pickMesh(scene, scene.camera, canvas, e.clientX, e.clientY);

    if (!picked) {
      close();
      return;
    }

    const { mesh, material } = picked;

    if (selectedMesh === mesh && selectedMaterial === material) {
      return;
    }

    openMaterialPanel(mesh, material, panel, info, guiContainer);
  });

  return {
    close,
    onModelRemoved: close,
  };
}

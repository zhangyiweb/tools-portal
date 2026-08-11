import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { applyAllTextureTiling, ensureMeshUvs } from './materialEditor.js';

const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export class HdriScene {
  constructor(canvas) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.4;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f1117);

    this.camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
    this.camera.position.set(0, 200, 400);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0.5, 0);
    this.controls.update();

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.pmrem.compileEquirectangularShader();
    this.rgbeLoader = new RGBELoader();

    this.gltfLoader = new GLTFLoader();
    this._setupCompressedGlbSupport();

    this._setupLights();

    this.modelsGroup = new THREE.Group();
    this.scene.add(this.modelsGroup);
    this.importedModels = [];

    this.currentEnvMap = null;
    this.loadToken = 0;
    this.environmentEnabled = true;
    this.backgroundEnabled = true;

    this.params = {
      toneMappingExposure: 0.4,
      sunColor: '#fff3df',
      sunIntensity: 3.0,
      sunX: 120,
      sunY: 200,
      sunZ: 80,
      shadowMapSize: 2048,
      shadowBias: -0.0002,
      shadowNear: 1,
      shadowFar: 600,
      shadowLeft: -160,
      shadowRight: 160,
      shadowTop: 160,
      shadowBottom: -160,
      hemiSkyColor: '#bcd6ff',
      hemiGroundColor: '#5a4a36',
      hemiIntensity: 0.5,
    };

    this._onResize();
    window.addEventListener('resize', () => this._onResize());
    this._animate();
  }

  _setupLights() {
    this.sunLight = new THREE.DirectionalLight(0xfff3df, 3.0);
    this.sunLight.position.set(120, 200, 80);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 600;
    this.sunLight.shadow.camera.left = -160;
    this.sunLight.shadow.camera.right = 160;
    this.sunLight.shadow.camera.top = 160;
    this.sunLight.shadow.camera.bottom = -160;
    this.sunLight.shadow.bias = -0.0002;
    this.scene.add(this.sunLight);

    this.hemiLight = new THREE.HemisphereLight(0xbcd6ff, 0x5a4a36, 0.5);
    this.scene.add(this.hemiLight);
  }

  _setupCompressedGlbSupport() {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
    this.gltfLoader.setDRACOLoader(dracoLoader);
    this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  }

  _applyShadowToObject(object) {
    object.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  _applyTextureTilingToObject(object) {
    object.traverse((child) => {
      if (!child.isMesh?.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) applyAllTextureTiling(m);
    });
  }

  _ensureMeshUvsOnObject(object) {
    object.traverse((child) => {
      if (child.isMesh) ensureMeshUvs(child);
    });
  }

  applyRenderParams() {
    const p = this.params;
    this.renderer.toneMappingExposure = p.toneMappingExposure;
    this.sunLight.color.set(p.sunColor);
    this.sunLight.intensity = p.sunIntensity;
    this.sunLight.position.set(p.sunX, p.sunY, p.sunZ);
    this.sunLight.shadow.mapSize.set(p.shadowMapSize, p.shadowMapSize);
    this.sunLight.shadow.bias = p.shadowBias;
    this.sunLight.shadow.camera.near = p.shadowNear;
    this.sunLight.shadow.camera.far = p.shadowFar;
    this.sunLight.shadow.camera.left = p.shadowLeft;
    this.sunLight.shadow.camera.right = p.shadowRight;
    this.sunLight.shadow.camera.top = p.shadowTop;
    this.sunLight.shadow.camera.bottom = p.shadowBottom;
    this.sunLight.shadow.camera.updateProjectionMatrix();
    this.hemiLight.color.set(p.hemiSkyColor);
    this.hemiLight.groundColor.set(p.hemiGroundColor);
    this.hemiLight.intensity = p.hemiIntensity;
  }

  async importModel(file) {
    const url = URL.createObjectURL(file);
    try {
      const gltf = await this.gltfLoader.loadAsync(url);
      const model = gltf.scene;
      model.name = file.name;
      this._applyShadowToObject(model);
      this._ensureMeshUvsOnObject(model);
      this._applyTextureTilingToObject(model);

      this.modelsGroup.add(model);
      this.importedModels.push({ id: generateId(), name: file.name, object: model });

      return this.importedModels[this.importedModels.length - 1];
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  removeModel(id) {
    const idx = this.importedModels.findIndex((m) => m.id === id);
    if (idx === -1) return;

    const entry = this.importedModels[idx];
    this.modelsGroup.remove(entry.object);
    entry.object.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => m?.dispose());
      }
    });
    this.importedModels.splice(idx, 1);
  }

  _exportFilename(name) {
    return name.replace(/\.(glb|gltf)$/i, '') + '_export.glb';
  }

  /** 导出前统一材质通用配置 */
  _applyExportMaterialDefaults(object) {
    object.traverse((child) => {
      if (!child.isMesh?.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        if (!m) continue;
        m.depthTest = true;
        m.depthWrite = true;
        m.needsUpdate = true;
      }
    });
  }

  async _exportGlb(object, filename) {
    this._applyExportMaterialDefaults(object);

    const exporter = new GLTFExporter();
    const buffer = await new Promise((resolve, reject) => {
      exporter.parse(
        object,
        (result) => resolve(result),
        (error) => reject(error),
        { binary: true },
      );
    });

    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /** 导出单个模型（含已修改的材质） */
  async exportModel(id) {
    const entry = this.importedModels.find((m) => m.id === id);
    if (!entry) throw new Error('模型不存在');
    await this._exportGlb(entry.object, this._exportFilename(entry.name));
  }

  /** 导出全部模型 */
  async exportAllModels() {
    if (this.importedModels.length === 0) throw new Error('没有可导出的模型');
    if (this.importedModels.length === 1) {
      const entry = this.importedModels[0];
      await this._exportGlb(entry.object, this._exportFilename(entry.name));
      return;
    }
    await this._exportGlb(this.modelsGroup, 'models_export.glb');
  }

  hasEnvironment() {
    return this.currentEnvMap !== null;
  }

  hasContent() {
    return this.hasEnvironment() || this.importedModels.length > 0;
  }

  async loadEnvironment(url) {
    const token = ++this.loadToken;

    const texture = await this.rgbeLoader.loadAsync(url);
    if (token !== this.loadToken) {
      texture.dispose();
      return;
    }

    texture.mapping = THREE.EquirectangularReflectionMapping;

    const envMap = this.pmrem.fromEquirectangular(texture).texture;
    texture.dispose();

    if (this.currentEnvMap) {
      this.currentEnvMap.dispose();
    }
    this.currentEnvMap = envMap;
    this._applyEnvMap();
  }

  setEnvironmentEnabled(enabled) {
    this.environmentEnabled = enabled;
    this._applyEnvMap();
  }

  setBackgroundEnabled(enabled) {
    this.backgroundEnabled = enabled;
    this._applyEnvMap();
  }

  _applyEnvMap() {
    const map = this.currentEnvMap;
    this.scene.environment = this.environmentEnabled && map ? map : null;
    if (this.backgroundEnabled && map) {
      this.scene.background = map;
    } else {
      this.scene.background = new THREE.Color(0x0f1117);
    }
  }

  _onResize() {
    const parent = this.canvas.parentElement;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.pmrem.dispose();
    if (this.currentEnvMap) this.currentEnvMap.dispose();
    this.renderer.dispose();
  }
}

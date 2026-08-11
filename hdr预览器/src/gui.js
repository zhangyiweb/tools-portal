import GUI from 'lil-gui';

export function setupGui(scene) {
  const gui = new GUI({ title: '渲染调试' });
  gui.domElement.style.zIndex = '20';

  const renderFolder = gui.addFolder('渲染器');
  renderFolder.add(scene.params, 'toneMappingExposure', 0.1, 1.5, 0.01)
    .name('曝光')
    .onChange(() => scene.applyRenderParams());

  const sunFolder = gui.addFolder('平行光');
  sunFolder.addColor(scene.params, 'sunColor').name('颜色').onChange(() => scene.applyRenderParams());
  sunFolder.add(scene.params, 'sunIntensity', 0, 8, 0.1).name('强度').onChange(() => scene.applyRenderParams());
  sunFolder.add(scene.params, 'sunX', -500, 500, 1).name('位置 X').onChange(() => scene.applyRenderParams());
  sunFolder.add(scene.params, 'sunY', -500, 500, 1).name('位置 Y').onChange(() => scene.applyRenderParams());
  sunFolder.add(scene.params, 'sunZ', -500, 500, 1).name('位置 Z').onChange(() => scene.applyRenderParams());

  const shadowFolder = gui.addFolder('阴影');
  shadowFolder.add(scene.params, 'shadowMapSize', [512, 1024, 2048, 4096]).name('贴图尺寸')
    .onChange(() => scene.applyRenderParams());
  shadowFolder.add(scene.params, 'shadowBias', -0.01, 0.01, 0.0001).name('偏移')
    .onChange(() => scene.applyRenderParams());
  shadowFolder.add(scene.params, 'shadowNear', 0.1, 50, 0.1).name('近平面')
    .onChange(() => scene.applyRenderParams());
  shadowFolder.add(scene.params, 'shadowFar', 100, 2000, 10).name('远平面')
    .onChange(() => scene.applyRenderParams());
  shadowFolder.add(scene.params, 'shadowLeft', -500, 0, 1).name('左')
    .onChange(() => scene.applyRenderParams());
  shadowFolder.add(scene.params, 'shadowRight', 0, 500, 1).name('右')
    .onChange(() => scene.applyRenderParams());
  shadowFolder.add(scene.params, 'shadowTop', 0, 500, 1).name('上')
    .onChange(() => scene.applyRenderParams());
  shadowFolder.add(scene.params, 'shadowBottom', -500, 0, 1).name('下')
    .onChange(() => scene.applyRenderParams());

  const hemiFolder = gui.addFolder('半球光');
  hemiFolder.addColor(scene.params, 'hemiSkyColor').name('天空色').onChange(() => scene.applyRenderParams());
  hemiFolder.addColor(scene.params, 'hemiGroundColor').name('地面色').onChange(() => scene.applyRenderParams());
  hemiFolder.add(scene.params, 'hemiIntensity', 0, 2, 0.01).name('强度').onChange(() => scene.applyRenderParams());

  gui.close();

  return gui;
}

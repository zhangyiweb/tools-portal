# ShadowMapViewer

这是用于可视化给定光源阴影贴图的辅助工具。适用于投射阴影的光源：DirectionalLight 和 SpotLight。它会渲染阴影贴图并在 HUD 上显示。

此模块只能与 [WebGLRenderer](WebGLRenderer.html) 配合使用。使用 [WebGPURenderer](WebGPURenderer.html) 时，请从 `ShadowMapViewerGPU.js` 导入该类。

## 代码示例

```js
const lightShadowMapViewer = new ShadowMapViewer( light );
lightShadowMapViewer.position.x = 10;
lightShadowMapViewer.position.y = SCREEN_HEIGHT - ( SHADOW_MAP_HEIGHT / 4 ) - 10;
lightShadowMapViewer.size.width = SHADOW_MAP_WIDTH / 4;
lightShadowMapViewer.size.height = SHADOW_MAP_HEIGHT / 4;
lightShadowMapViewer.update();
```

## 导入

ShadowMapViewer 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { ShadowMapViewer } from 'three/addons/utils/ShadowMapViewer.js';
```

## 构造函数

### new ShadowMapViewer( light : Light )

构造一个新的阴影贴图查看器。

**light**

投射阴影的光源。

## 属性

### .enabled : boolean

是否显示阴影贴图查看器。

默认值为 `true`。

### .position : Object

查看器的位置。更改此属性时，请确保调用 [ShadowMapViewer#update](ShadowMapViewer.html#update)。

默认值为 `true`。

### .size : Object

查看器的大小。更改此属性时，请确保调用 [ShadowMapViewer#update](ShadowMapViewer.html#update)。

默认值为 `true`。

## 方法

### .render( renderer : WebGLRenderer )

渲染查看器。必须在应用的动画循环中调用此方法。

**renderer**

渲染器。

### .update()

更新查看器。

### .updateForWindowResize()

调整查看器大小。每当应用窗口大小改变时都应调用此方法。

## 源码

[examples/jsm/utils/ShadowMapViewer.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/utils/ShadowMapViewer.js)
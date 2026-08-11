# UVsDebug

## 导入

UVsDebug 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { UVsDebug } from 'three/addons/utils/UVsDebug.js';
```

## 方法

### .UVsDebug( geometry : BufferGeometry, size : number ) : HTMLCanvasElement (inner)

用于「展开」和调试 three.js 几何体 UV 映射的函数。

```js
document.body.appendChild( UVsDebug( new THREE.SphereGeometry() ) );
```

**geometry**

需要检查 uv 坐标的几何体。

**size**

调试画布的尺寸。

默认值为 `1024`。

**返回值：** 带有可视化 uv 坐标的 canvas 元素。

## 源码

[examples/jsm/utils/UVsDebug.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/utils/UVsDebug.js)

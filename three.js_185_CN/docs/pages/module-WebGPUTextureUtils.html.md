# WebGPUTextureUtils

## 导入

WebGPUTextureUtils 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import * as WebGPUTextureUtils from 'three/addons/utils/WebGPUTextureUtils.js';
```

## 静态方法

### .decompress( blitTexture : CompressedTexture, maxTextureSize : number, renderer : WebGPURenderer ) : Promise.<CanvasTexture> (async)

返回给定压缩纹理的未压缩版本。

此模块只能与 [WebGPURenderer](WebGPURenderer.html) 一起使用。使用 [WebGLRenderer](WebGLRenderer.html) 时，请从 [WebGLTextureUtils](WebGLTextureUtils.html) 导入该函数。

**blitTexture**

压缩纹理。

**maxTextureSize**

未压缩纹理的最大尺寸。

默认值为 `Infinity`。

**renderer**

渲染器的引用。

默认值为 `null`。

**返回值：** 解析为未压缩纹理的 Promise。

## 源码

[examples/jsm/utils/WebGPUTextureUtils.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/utils/WebGPUTextureUtils.js)

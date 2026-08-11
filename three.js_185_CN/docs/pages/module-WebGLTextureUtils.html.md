# WebGLTextureUtils

## 导入

WebGLTextureUtils 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import * as WebGLTextureUtils from 'three/addons/utils/WebGLTextureUtils.js';
```

## 静态方法

### .decompress( texture : CompressedTexture, maxTextureSize : number, renderer : WebGLRenderer ) : CanvasTexture

返回给定压缩纹理的未压缩版本。

此模块只能与 [WebGLRenderer](WebGLRenderer.html) 一起使用。使用 [WebGPURenderer](WebGPURenderer.html) 时，请从 [WebGPUTextureUtils](WebGPUTextureUtils.html) 导入该函数。

**texture**

压缩纹理。

**maxTextureSize**

未压缩纹理的最大尺寸。

默认值为 `Infinity`。

**renderer**

渲染器的引用。

默认值为 `null`。

**返回值：** 未压缩的纹理。

## 源码

[examples/jsm/utils/WebGLTextureUtils.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/utils/WebGLTextureUtils.js)

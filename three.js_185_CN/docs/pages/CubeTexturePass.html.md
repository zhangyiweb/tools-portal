*Inheritance: Pass →*

# CubeTexturePass

此通道可用于在整个屏幕上渲染立方体贴图。

## 代码示例

```js
const cubeMap = new THREE.CubeTextureLoader().load( urls );
const cubeTexturePass = new CubeTexturePass( camera, cubemap );
composer.addPass( cubeTexturePass );
```

## 导入

CubeTexturePass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { CubeTexturePass } from 'three/addons/postprocessing/CubeTexturePass.js';
```

## 构造函数

### new CubeTexturePass( camera : PerspectiveCamera, tCube : CubeTexture, opacity : number )

构造一个新的立方体贴图通道。

**camera**

相机。

**tCube**

要渲染的立方体贴图。

**opacity**

不透明度。

默认值为 `1`。

## 属性

### .camera : PerspectiveCamera

相机。

### .needsSwap : boolean

重写以禁用交换。

默认值为 `false`。

**重写：** [Pass#needsSwap](Pass.html#needsSwap)

### .opacity : number

不透明度。

默认值为 `1`。

### .tCube : CubeTexture

要渲染的立方体贴图。

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

**重写：** [Pass#dispose](Pass.html#dispose)

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行立方体贴图通道渲染。

**renderer**

渲染器。

**writeBuffer**

写入缓冲区。该缓冲区作为通道的渲染目标。

**readBuffer**

读取缓冲区。通道可从此缓冲区获取上一通道的渲染结果。

**deltaTime**

时间增量（秒）。

**maskActive**

遮罩是否处于激活状态。

**重写：** [Pass#render](Pass.html#render)

## 源码

[examples/jsm/postprocessing/CubeTexturePass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/CubeTexturePass.js)

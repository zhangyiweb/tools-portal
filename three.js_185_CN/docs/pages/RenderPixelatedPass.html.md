*Inheritance: Pass →*

# RenderPixelatedPass

一种特殊的渲染通道，用于生成像素化的最终画面（beauty pass）。

## 代码示例

```js
const renderPixelatedPass = new RenderPixelatedPass( 6, scene, camera );
composer.addPass( renderPixelatedPass );
```

## 导入

RenderPixelatedPass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';
```

## 构造函数

### new RenderPixelatedPass( pixelSize : number, scene : Scene, camera : Camera, options : Object )

构造一个新的像素化渲染通道。

**pixelSize**

效果的像素大小。

**scene**

要渲染的场景。

**camera**

相机。

**options**

通道选项。

## 属性

### .camera : Camera

相机。

### .depthEdgeStrength : number

深度边缘强度。

默认值为 `0.4`。

### .normalEdgeStrength : number

法线边缘强度。

默认值为 `0.3`。

### .pixelSize : number

效果的像素大小。

### .pixelatedMaterial : ShaderMaterial

像素化材质。

### .scene : Scene

要渲染的场景。

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

**重写：** [Pass#dispose](Pass.html#dispose)

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行像素化通道。

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

### .setPixelSize( pixelSize : number )

设置效果的像素大小。

**pixelSize**

要设置的像素大小。

### .setSize( width : number, height : number )

设置通道的尺寸。

**width**

要设置的宽度。

**height**

要设置的高度。

**重写：** [Pass#setSize](Pass.html#setSize)

## 源码

[examples/jsm/postprocessing/RenderPixelatedPass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/RenderPixelatedPass.js)

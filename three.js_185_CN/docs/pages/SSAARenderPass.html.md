*Inheritance: Pass →*

# SSAARenderPass

超采样抗锯齿（SSAA）渲染通道。

这种手动 SSAA 方法会对每个采样点在相机抖动下重新渲染一次场景，并累积结果。

## 代码示例

```js
const ssaaRenderPass = new SSAARenderPass( scene, camera );
ssaaRenderPass.sampleLevel = 3;
composer.addPass( ssaaRenderPass );
```

## 导入

SSAARenderPass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { SSAARenderPass } from 'three/addons/postprocessing/SSAARenderPass.js';
```

## 构造函数

### new SSAARenderPass( scene : Scene, camera : Camera, clearColor : number | Color | string, clearAlpha : number )

构造一个新的 SSAA 渲染通道。

**scene**

要渲染的场景。

**camera**

相机。

**clearColor**

渲染通道的清除颜色。

默认值为 `0x000000`。

**clearAlpha**

渲染通道的清除透明度。

默认值为 `0`。

## 属性

### .camera : Camera

相机。

### .clearAlpha : number

渲染通道的清除透明度。

默认值为 `0`。

### .clearColor : number | Color | string

渲染通道的清除颜色。

默认值为 `0x000000`。

### .sampleLevel : number

采样级别。以 n 表示，采样数为 2^n，因此 sampleLevel = 4 表示 2^4 = 16 个采样。

默认值为 `4`。

### .scene : Scene

要渲染的场景。

### .stencilBuffer : boolean

是否使用模板缓冲区。此属性在首次渲染后无法更改。

默认值为 `false`。

### .unbiased : boolean

通道是否应无偏。在渲染到 RGBA8 缓冲区时，此属性的视觉效果最明显，因为它可减轻舍入误差。默认使用 RGBA16F。

默认值为 `true`。

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

**重写：** [Pass#dispose](Pass.html#dispose)

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行 SSAA 渲染通道。

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

### .setSize( width : number, height : number )

设置通道的尺寸。

**width**

要设置的宽度。

**height**

要设置的高度。

**重写：** [Pass#setSize](Pass.html#setSize)

## 源码

[examples/jsm/postprocessing/SSAARenderPass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/SSAARenderPass.js)

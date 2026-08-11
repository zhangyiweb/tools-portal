*Inheritance: Pass → SSAARenderPass →*

# TAARenderPass

时间抗锯齿渲染通道。

当场景中没有运动时，TAA 渲染通道会跨帧累积经抖动的相机采样，以生成高质量的抗锯齿结果。

注意：此效果未使用重投影，因此并非 TRAA 实现。

## 代码示例

```js
const taaRenderPass = new TAARenderPass( scene, camera );
taaRenderPass.unbiased = false;
composer.addPass( taaRenderPass );
```

## 导入

TAARenderPass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { TAARenderPass } from 'three/addons/postprocessing/TAARenderPass.js';
```

## 构造函数

### new TAARenderPass( scene : Scene, camera : Camera, clearColor : number | Color | string, clearAlpha : number )

构造一个新的 TAA 渲染通道。

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

### .accumulate : boolean

是否累积帧。启用后即开启 TAA。

默认值为 `false`。

### .accumulateIndex : number

累积索引。

默认值为 `-1`。

### .sampleLevel : number

被重写，默认设置为 0。

默认值为 `0`。

**重写：** [SSAARenderPass#sampleLevel](SSAARenderPass.html#sampleLevel)

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

**重写：** [SSAARenderPass#dispose](SSAARenderPass.html#dispose)

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行 TAA 渲染通道。

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

**重写：** [SSAARenderPass#render](SSAARenderPass.html#render)

## 源码

[examples/jsm/postprocessing/TAARenderPass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/TAARenderPass.js)

*Inheritance: Pass →*

# SSAOPass

用于实现基础 SSAO 效果的通道。

[SAOPass](SAOPass.html) 和 GTAPass 可产生更高级的 AO，但开销也更大。

## 代码示例

```js
const ssaoPass = new SSAOPass( scene, camera, width, height );
composer.addPass( ssaoPass );
```

## 导入

SSAOPass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
```

## 构造函数

### new SSAOPass( scene : Scene, camera : Camera, width : number, height : number, kernelSize : number )

构造一个新的 SSAO 通道。

**scene**

要计算 AO 的场景。

**camera**

相机。

**width**

效果的宽度。

默认值为 `512`。

**height**

效果的高度。

默认值为 `512`。

**kernelSize**

核大小。

默认值为 `32`。

## 属性

### .camera : Camera

相机。

### .clear : boolean

被重写为默认执行清除操作。

默认值为 `true`。

**重写：** [Pass#clear](Pass.html#clear)

### .height : number

效果的高度。

默认值为 `512`。

### .kernelRadius : number

核半径控制 AO 的扩散范围。

默认值为 `8`。

### .maxDistance : number

定义应受 AO 影响的最大距离。

默认值为 `0.1`。

### .minDistance : number

定义应受 AO 影响的最小距离。

默认值为 `0.005`。

### .needsSwap : boolean

被重写为禁用交换。

默认值为 `false`。

**重写：** [Pass#needsSwap](Pass.html#needsSwap)

### .output : number

输出配置。

默认值为 `0`。

### .scene : Scene

要渲染 AO 的场景。

### .width : number

效果的宽度。

默认值为 `512`。

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

**重写：** [Pass#dispose](Pass.html#dispose)

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行 SSAO 通道。

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

[examples/jsm/postprocessing/SSAOPass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/SSAOPass.js)

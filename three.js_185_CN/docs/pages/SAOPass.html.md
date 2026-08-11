*Inheritance: Pass →*

# SAOPass

受 @bhouston 先前 SAO 工作启发的 SAO 实现。

`SAOPass` 比 [SSAOPass](SSAOPass.html) 质量更好，但开销也更大。

## 代码示例

```js
const saoPass = new SAOPass( scene, camera );
composer.addPass( saoPass );
```

## 导入

SAOPass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { SAOPass } from 'three/addons/postprocessing/SAOPass.js';
```

## 构造函数

### new SAOPass( scene : Scene, camera : Camera, resolution : Vector2 )

构造一个新的 SAO 通道。

**scene**

要计算 AO 的场景。

**camera**

相机。

**resolution**

效果的分辨率。

## 属性

### .camera : Camera

相机。

### .clear : boolean

被重写为默认执行清除操作。

默认值为 `true`。

**重写：** [Pass#clear](Pass.html#clear)

### .needsSwap : boolean

被重写为禁用交换。

默认值为 `false`。

**重写：** [Pass#needsSwap](Pass.html#needsSwap)

### .params : Object

SAO 参数。

### .resolution : Vector2

效果的分辨率。

默认值为 `(256,256)`。

### .scene : Scene

要渲染 AO 的场景。

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

**重写：** [Pass#dispose](Pass.html#dispose)

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行 SAO 通道。

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

[examples/jsm/postprocessing/SAOPass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/SAOPass.js)

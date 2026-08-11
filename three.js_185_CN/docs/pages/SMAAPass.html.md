*Inheritance: Pass →*

# SMAAPass

用于应用 SMAA 的通道。与 [FXAAPass](FXAAPass.html) 不同，`SMAAPass` 在 `linear-srgb` 颜色空间中运行，因此必须在 [OutputPass](OutputPass.html) 之前执行。

## 代码示例

```js
const smaaPass = new SMAAPass();
composer.addPass( smaaPass );
```

## 导入

SMAAPass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
```

## 构造函数

### new SMAAPass()

构造一个新的 SMAA 通道。

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

**重写：** [Pass#dispose](Pass.html#dispose)

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行 SMAA 通道。

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

[examples/jsm/postprocessing/SMAAPass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/SMAAPass.js)

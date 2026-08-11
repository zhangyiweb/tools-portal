*Inheritance: Pass →*

# MaskPass

此通道可用于在后处理过程中定义遮罩。这意味着后续后处理仅会影响位于本通道遮罩区域内的部分。内部通过模板缓冲区实现遮罩。

## 代码示例

```js
const maskPass = new MaskPass( scene, camera );
composer.addPass( maskPass );
```

## 导入

MaskPass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { MaskPass } from 'three/addons/postprocessing/MaskPass.js';
```

## 构造函数

### new MaskPass( scene : Scene, camera : Camera )

构造一个新的遮罩通道。

**scene**

该场景中的 3D 对象将定义遮罩。

**camera**

相机。

## 属性

### .camera : Camera

相机。

### .clear : boolean

已重写，默认执行清除操作。

默认值为 `true`。

**重写：** [Pass#clear](Pass.html#clear)

### .inverse : boolean

是否反转遮罩。

默认值为 `false`。

### .needsSwap : boolean

已重写，以禁用交换。

默认值为 `false`。

**重写：** [Pass#needsSwap](Pass.html#needsSwap)

### .scene : Scene

定义遮罩的场景。

## 方法

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

使用已配置的场景和相机执行遮罩通道。

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

[examples/jsm/postprocessing/MaskPass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/MaskPass.js)

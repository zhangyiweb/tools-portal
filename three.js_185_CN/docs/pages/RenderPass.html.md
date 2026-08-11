*Inheritance: Pass →*

# RenderPass

此类表示一个渲染通道。它接收相机和场景，并为后续后处理效果生成美化通道。

## 代码示例

```js
const renderPass = new RenderPass( scene, camera );
composer.addPass( renderPass );
```

## 导入

RenderPass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
```

## 构造函数

### new RenderPass( scene : Scene, camera : Camera, overrideMaterial : Material, clearColor : number | Color | string, clearAlpha : number )

构造一个新的渲染通道。

**scene**

要渲染的场景。

**camera**

相机。

**overrideMaterial**

覆盖材质。若设置，场景中的所有对象都将使用该材质。

默认值为 `null`。

**clearColor**

渲染通道的清除颜色。

默认值为 `null`。

**clearAlpha**

渲染通道的清除透明度。

默认值为 `null`。

## 属性

### .camera : Camera

相机。

### .clear : boolean

已重写，默认执行清除操作。

默认值为 `true`。

**重写：** [Pass#clear](Pass.html#clear)

### .clearAlpha : number

渲染通道的清除透明度。

默认值为 `null`。

### .clearColor : number | Color | string

渲染通道的清除颜色。

默认值为 `null`。

### .clearDepth : boolean

若设为 `true`，则在 `clear` 为 `false` 时仅清除深度。

默认值为 `false`。

### .isRenderPass : boolean (readonly)

此标志表示该通道会渲染场景本身。

默认值为 `true`。

### .needsSwap : boolean

已重写，以禁用交换。

默认值为 `false`。

**重写：** [Pass#needsSwap](Pass.html#needsSwap)

### .overrideMaterial : Material

覆盖材质。若设置，场景中的所有对象都将使用该材质。

默认值为 `null`。

### .scene : Scene

要渲染的场景。

## 方法

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

使用已配置的场景和相机执行美化通道。

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

[examples/jsm/postprocessing/RenderPass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/RenderPass.js)

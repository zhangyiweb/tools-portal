# EffectComposer

用于在 three.js 中实现后期处理效果。该类管理一系列后期处理通道，以生成最终的视觉结果。后期处理通道按其添加/插入的顺序执行。最后一个通道会自动渲染到屏幕。

此模块只能与 [WebGLRenderer](WebGLRenderer.html) 一起使用。

## 代码示例

```js
const composer = new EffectComposer( renderer );
// adding some passes
const renderPass = new RenderPass( scene, camera );
composer.addPass( renderPass );
const glitchPass = new GlitchPass();
composer.addPass( glitchPass );
const outputPass = new OutputPass()
composer.addPass( outputPass );
function animate() {
	composer.render(); // instead of renderer.render()
}
```

## 导入

EffectComposer 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
```

## 构造函数

### new EffectComposer( renderer : WebGLRenderer, renderTarget : WebGLRenderTarget )

构造一个新的效果合成器。

**renderer**

渲染器。

**renderTarget**

此渲染目标及其克隆将用作内部的读取和写入缓冲区。若未提供，合成器会自动创建这些缓冲区。

## 属性

### .passes : Array.<Pass>

表示（有序）后期处理通道链的数组。

### .readBuffer : WebGLRenderTarget

内部读取缓冲区的引用。通道通常从此缓冲区读取上一通道的渲染结果。

### .renderToScreen : boolean

最终通道是否渲染到屏幕（默认帧缓冲）。

默认值为 `true`。

### .renderer : WebGLRenderer

渲染器。

### .writeBuffer : WebGLRenderTarget

内部写入缓冲区的引用。通道通常将其结果写入此缓冲区。

## 方法

### .addPass( pass : Pass )

将给定通道添加到通道链中。

**pass**

要添加的通道。

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此合成器时，应调用此方法。

### .insertPass( pass : Pass, index : number )

在给定索引处插入通道。

**pass**

要插入的通道。

**index**

通道链中的索引。

### .isLastEnabledPass( passIndex : number ) : boolean

若给定索引处的通道是通道链中最后一个启用的通道，则返回 `true`。

**passIndex**

通道索引。

**返回值：** 给定索引处的通道是否为通道链中的最后一个通道。

### .removePass( pass : Pass )

从通道链中移除给定通道。

**pass**

要移除的通道。

### .render( deltaTime : number )

按顺序执行所有启用的后期处理通道，以生成最终帧。

**deltaTime**

时间增量（秒）。若未提供，合成器将自行计算时间增量。

### .reset( renderTarget : WebGLRenderTarget )

重置 EffectComposer 的内部状态。

**renderTarget**

此渲染目标的用途与构造函数中的相同。若已设置，则用于配置读取和写入缓冲区。

### .setPixelRatio( pixelRatio : number )

设置设备像素比。通常用于 HiDPI 设备，以避免输出模糊。设置像素比会自动调整合成器的尺寸。

**pixelRatio**

要设置的像素比。

### .setSize( width : number, height : number )

调整内部读取、写入缓冲区以及所有通道的尺寸。与 [WebGLRenderer#setSize](WebGLRenderer.html#setSize) 类似，此方法会遵循当前的像素比。

**width**

逻辑像素宽度。

**height**

逻辑像素高度。

### .swapBuffers()

交换内部的读取/写入缓冲区。

## 源码

[examples/jsm/postprocessing/EffectComposer.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/EffectComposer.js)

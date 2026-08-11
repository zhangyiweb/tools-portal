# Pass

所有后处理通道的抽象基类。

此模块仅与使用 [WebGLRenderer](WebGLRenderer.html) 的后处理相关。

## 导入

Pass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { Pass } from 'three/addons/postprocessing/Pass.js';
```

## 构造函数

### new Pass() (abstract)

构造一个新的通道。

## 属性

### .clear : boolean

若设为 `true`，通道在渲染前会清除其缓冲区。

默认值为 `false`。

### .enabled : boolean

若设为 `true`，合成器会处理该通道。

默认值为 `true`。

### .isPass : boolean (readonly)

此标志可用于类型检测。

默认值为 `true`。

### .needsSwap : boolean

若设为 `true`，表示通道在渲染后需要交换读写缓冲区。

默认值为 `true`。

### .renderToScreen : boolean

若设为 `true`，通道结果会渲染到屏幕。合成器通道链中的最后一个通道会自动渲染到屏幕，与此属性如何配置无关。

默认值为 `false`。

## 方法

### .dispose() (abstract)

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean ) (abstract)

此方法包含通道的渲染逻辑。所有派生类都必须实现该方法。

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

### .setSize( width : number, height : number ) (abstract)

设置通道的尺寸。

**width**

要设置的宽度。

**height**

要设置的高度。

## 源码

[examples/jsm/postprocessing/Pass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/Pass.js)

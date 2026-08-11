*Inheritance: Pass →*

# ClearPass

此类可用于强制对当前读取缓冲或默认帧缓冲（渲染到屏幕时）执行清除操作。

## 代码示例

```js
const clearPass = new ClearPass();
composer.addPass( clearPass );
```

## 导入

ClearPass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { ClearPass } from 'three/addons/postprocessing/ClearPass.js';
```

## 构造函数

### new ClearPass( clearColor : number | Color | string, clearAlpha : number )

构造一个新的清除通道。

**clearColor**

清除颜色。

默认值为 `0x000000`。

**clearAlpha**

清除的透明度。

默认值为 `0`。

## 属性

### .clearAlpha : number

清除的透明度。

默认值为 `0`。

### .clearColor : number | Color | string

清除颜色。

默认值为 `0x000000`。

### .needsSwap : boolean

重写以禁用交换。

默认值为 `false`。

**重写：** [Pass#needsSwap](Pass.html#needsSwap)

## 方法

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行清除操作。这会影响当前读取缓冲或默认帧缓冲。

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

[examples/jsm/postprocessing/ClearPass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/ClearPass.js)

*Inheritance: Pass →*

# ClearMaskPass

此通道可用于清除先前由 [MaskPass](MaskPass.html) 定义的遮罩。

## 代码示例

```js
const clearPass = new ClearMaskPass();
composer.addPass( clearPass );
```

## 构造函数

### new ClearMaskPass()

构造一个新的清除遮罩通道。

## 属性

### .needsSwap : boolean

重写以禁用交换。

默认值为 `false`。

**重写：** [Pass#needsSwap](Pass.html#needsSwap)

## 方法

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

清除当前已定义的遮罩。

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

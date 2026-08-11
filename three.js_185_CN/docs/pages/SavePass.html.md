*Inheritance: Pass →*

# SavePass

将当前读取缓冲区的内容保存到渲染目标中的通道。

## 代码示例

```js
const savePass = new SavePass( customRenderTarget );
composer.addPass( savePass );
```

## 导入

SavePass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { SavePass } from 'three/addons/postprocessing/SavePass.js';
```

## 构造函数

### new SavePass( renderTarget : WebGLRenderTarget )

构造一个新的保存通道。

**renderTarget**

用于保存读取缓冲区的渲染目标。若未提供，通道会自动创建一个渲染目标。

## 属性

### .material : ShaderMaterial

通道材质。

### .needsSwap : boolean

被重写以禁用交换。

默认值为 `false`。

**重写：** [Pass#needsSwap](Pass.html#needsSwap)

### .renderTarget : WebGLRenderTarget

用于保存读取缓冲区的渲染目标。

### .uniforms : Object

通道的 uniform。

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

**重写：** [Pass#dispose](Pass.html#dispose)

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行保存通道。

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

[examples/jsm/postprocessing/SavePass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/SavePass.js)

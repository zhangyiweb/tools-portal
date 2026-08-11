*Inheritance: Pass →*

# GlitchPass

用于创建故障（glitch）效果的通道。

## 代码示例

```js
const glitchPass = new GlitchPass();
composer.addPass( glitchPass );
```

## 导入

GlitchPass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js';
```

## 构造函数

### new GlitchPass( dt_size : number )

构造一个新的故障通道。

**dt\_size**

用于数字故障方块的位移纹理尺寸。

默认值为 `64`。

## 属性

### .goWild : boolean

是否显著增强效果强度。

默认值为 `false`。

### .material : ShaderMaterial

通道材质。

### .uniforms : Object

通道的 uniform 对象。

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

**重写：** [Pass#dispose](Pass.html#dispose)

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行故障通道渲染。

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

[examples/jsm/postprocessing/GlitchPass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/GlitchPass.js)

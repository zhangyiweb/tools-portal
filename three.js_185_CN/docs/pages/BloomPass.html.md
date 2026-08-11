*Inheritance: Pass →*

# BloomPass

用于实现基础泛光（Bloom）效果的通道。

[UnrealBloomPass](UnrealBloomPass.html) 可产生更高级的泛光效果，但开销也更大。

## 代码示例

```js
const effectBloom = new BloomPass( 0.75 );
composer.addPass( effectBloom );
```

## 导入

BloomPass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { BloomPass } from 'three/addons/postprocessing/BloomPass.js';
```

## 构造函数

### new BloomPass( strength : number, kernelSize : number, sigma : number )

构造一个新的 Bloom 通道。

**strength**

泛光强度。

默认值为 `1`。

**kernelSize**

卷积核大小。

默认值为 `25`。

**sigma**

标准差（sigma）。

默认值为 `4`。

## 属性

### .combineUniforms : Object

合成通道的 uniform 对象。

### .convolutionUniforms : Object

卷积通道的 uniform 对象。

### .materialCombine : ShaderMaterial

合成通道的材质。

### .materialConvolution : ShaderMaterial

卷积通道的材质。

### .needsSwap : boolean

重写以禁用交换。

默认值为 `false`。

**重写：** [Pass#needsSwap](Pass.html#needsSwap)

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

**重写：** [Pass#dispose](Pass.html#dispose)

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行 Bloom 通道渲染。

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

[examples/jsm/postprocessing/BloomPass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/BloomPass.js)

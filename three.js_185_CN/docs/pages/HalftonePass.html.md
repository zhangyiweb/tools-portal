*Inheritance: Pass →*

# HalftonePass

用于创建 RGB 半色调效果的通道。

## 代码示例

```js
const params = {
	shape: 1,
	radius: 4,
	rotateR: Math.PI / 12,
	rotateB: Math.PI / 12 * 2,
	rotateG: Math.PI / 12 * 3,
	scatter: 0,
	blending: 1,
	blendingMode: 1,
	greyscale: false,
	disable: false
};
const halftonePass = new HalftonePass( params );
composer.addPass( halftonePass );
```

## 导入

HalftonePass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { HalftonePass } from 'three/addons/postprocessing/HalftonePass.js';
```

## 构造函数

### new HalftonePass( params : Object )

构造一个新的半色调通道。

**params**

半色调着色器参数。

## 属性

### .material : ShaderMaterial

通道材质。

### .uniforms : Object

通道的 uniform 对象。

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

**重写：** [Pass#dispose](Pass.html#dispose)

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行半色调通道渲染。

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

[examples/jsm/postprocessing/HalftonePass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/HalftonePass.js)

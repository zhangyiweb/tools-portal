*Inheritance: Pass →*

# AfterimagePass

用于实现基础残影效果的通道（Pass）。

## 代码示例

```js
const afterimagePass = new AfterimagePass( 0.9 );
composer.addPass( afterimagePass );
```

## 导入

AfterimagePass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
```

## 构造函数

### new AfterimagePass( damp : number )

构造一个新的残影通道。

**damp**

阻尼强度。数值越高，残影效果越强。

默认值为 `0.96`。

## 属性

### .compFsMaterial : ShaderMaterial

合成材质。

### .copyFsMaterial : ShaderMaterial

复制材质。

### .damp : number

阻尼强度，取值范围为 0.0 到 1.0。数值越高，残影效果越强。

### .uniforms : Object

通道的 uniform 对象。如需在运行时更新 `damp` 值，可使用此对象。

```js
pass.uniforms.damp.value = 0.9;
```

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

**重写：** [Pass#dispose](Pass.html#dispose)

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行残影通道渲染。

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

[examples/jsm/postprocessing/AfterimagePass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/AfterimagePass.js)

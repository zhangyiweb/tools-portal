*Inheritance: Pass →*

# ShaderPass

此通道可用于使用原始 GLSL 着色器对象创建后期处理效果。适用于实现自定义效果。

## 代码示例

```js
const fxaaPass = new ShaderPass( FXAAShader );
composer.addPass( fxaaPass );
```

## 导入

ShaderPass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
```

## 构造函数

### new ShaderPass( shader : Object | ShaderMaterial, textureID : string )

构造一个新的着色器通道。

**shader**

包含顶点着色器、片元着色器以及 defines 和 uniforms 的着色器对象。也可以传入自定义着色器材质。

**textureID**

用于采样读取缓冲区的纹理 uniform 名称。

默认值为 `'tDiffuse'`。

## 属性

### .material : ShaderMaterial

通道材质。

### .textureID : string

用于采样读取缓冲区的纹理 uniform 名称。

默认值为 `'tDiffuse'`。

### .uniforms : Object

通道的 uniform。

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

**重写：** [Pass#dispose](Pass.html#dispose)

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行着色器通道。

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

[examples/jsm/postprocessing/ShaderPass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/ShaderPass.js)

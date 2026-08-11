*Inheritance: Pass →*

# TexturePass

此通道可用于在整个屏幕上渲染纹理。

## 代码示例

```js
const texture = new THREE.TextureLoader().load( 'textures/2294472375_24a3b8ef46_o.jpg' );
texture.colorSpace = THREE.SRGBColorSpace;
const texturePass = new TexturePass( texture );
composer.addPass( texturePass );
```

## 导入

TexturePass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { TexturePass } from 'three/addons/postprocessing/TexturePass.js';
```

## 构造函数

### new TexturePass( map : Texture, opacity : number )

构造一个新的纹理通道。

**map**

要渲染的纹理。

**opacity**

不透明度。

默认值为 `1`。

## 属性

### .map : Texture

要渲染的纹理。

### .material : ShaderMaterial

通道材质。

### .needsSwap : boolean

被重写以禁用交换。

默认值为 `false`。

**重写：** [Pass#needsSwap](Pass.html#needsSwap)

### .opacity : number

不透明度。

默认值为 `1`。

### .uniforms : Object

通道的 uniform。

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

**重写：** [Pass#dispose](Pass.html#dispose)

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行纹理通道。

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

[examples/jsm/postprocessing/TexturePass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/TexturePass.js)

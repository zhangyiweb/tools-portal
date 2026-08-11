*Inheritance: Pass →*

# UnrealBloomPass

此通道受虚幻引擎 Bloom 通道启发。它会创建 Bloom 纹理的 mipmap 链，并以不同半径对其进行模糊。由于对各 mip 进行加权合成，且更大的模糊在更高层 mip 上完成，该效果在画质与性能方面表现良好。

使用此通道时，必须在渲染器设置中启用色调映射。

参考：

*   [Bloom in Unreal Engine](https://docs.unrealengine.com/latest/INT/Engine/Rendering/PostProcessEffects/Bloom/)

## 代码示例

```js
const resolution = new THREE.Vector2( window.innerWidth, window.innerHeight );
const bloomPass = new UnrealBloomPass( resolution, 1.5, 0.4, 0.85 );
composer.addPass( bloomPass );
```

## 导入

UnrealBloomPass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
```

## 构造函数

### new UnrealBloomPass( resolution : Vector2, strength : number, radius : number, threshold : number )

构造一个新的 Unreal Bloom 通道。

**resolution**

效果的分辨率。

**strength**

Bloom 强度。

默认值为 `1`。

**radius**

Bloom 半径。

**threshold**

亮度阈值，用于限制哪些明亮区域会对 Bloom 效果产生贡献。

## 属性

### .clearColor : Color

效果的清除颜色。

默认值为 `(0,0,0)`。

### .needsSwap : boolean

被重写以禁用交换。

默认值为 `false`。

**重写：** [Pass#needsSwap](Pass.html#needsSwap)

### .radius : number

Bloom 半径。必须在 `[0,1]` 范围内。

### .resolution : Vector2

效果的分辨率。

默认值为 `(256,256)`。

### .strength : number

Bloom 强度。

默认值为 `1`。

### .threshold : number

亮度阈值，用于限制哪些明亮区域会对 Bloom 效果产生贡献。

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

**重写：** [Pass#dispose](Pass.html#dispose)

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行 Bloom 通道。

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

[examples/jsm/postprocessing/UnrealBloomPass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/UnrealBloomPass.js)

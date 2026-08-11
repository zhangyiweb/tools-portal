*Inheritance: Pass →*

# GTAOPass

用于实现 GTAO 效果的通道。

`GTAOPass` 比 [SSAOPass](SSAOPass.html) 质量更高，但开销也更大。

## 代码示例

```js
const gtaoPass = new GTAOPass( scene, camera, width, height );
gtaoPass.output = GTAOPass.OUTPUT.Denoise;
composer.addPass( gtaoPass );
```

## 导入

GTAOPass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
```

## 构造函数

### new GTAOPass( scene : Scene, camera : Camera, width : number, height : number, parameters : Object, aoParameters : Object, pdParameters : Object )

构造一个新的 GTAO 通道。

**scene**

要计算 AO 的场景。

**camera**

相机。

**width**

效果的宽度。

默认值为 `512`。

**height**

效果的高度。

默认值为 `512`。

**parameters**

通道参数。

**aoParameters**

AO 参数。

**pdParameters**

降噪参数。

## 属性

### .blendIntensity : number

AO 混合强度。

默认值为 `1`。

### .camera : Camera

相机。

### .clear : boolean

已覆盖，默认执行清除操作。

默认值为 `true`。

**重写：** [Pass#clear](Pass.html#clear)

### .gtaoMap : Texture (readonly)

保存已计算 AO 的纹理。

### .height : number

效果的高度。

默认值为 `512`。

### .output : number

输出配置。

默认值为 `0`。

### .pdRadiusExponent : number

泊松降噪半径指数。

默认值为 `2`。

### .pdRings : number

泊松降噪环数。

默认值为 `2`。

### .pdSamples : number

泊松降噪采样数。

默认值为 `16`。

### .scene : Scene

要渲染 AO 的场景。

### .width : number

效果的宽度。

默认值为 `512`。

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

**重写：** [Pass#dispose](Pass.html#dispose)

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行 GTAO 通道渲染。

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

### .setGBuffer( depthTexture : DepthTexture, normalTexture : DepthTexture )

配置此通道的 GBuffer。若未传入参数，通道将创建内部渲染目标以保存深度和法线数据。

**depthTexture**

深度纹理。

**normalTexture**

法线纹理。

### .setSceneClipBox( box : Box3 )

使用给定的 AABB 配置 GTAO 着色器的裁剪盒。

**box**

包围应接收 AO 的场景的 AABB。传入 `null` 时不使用裁剪盒。

### .setSize( width : number, height : number )

设置通道的尺寸。

**width**

要设置的宽度。

**height**

要设置的高度。

**重写：** [Pass#setSize](Pass.html#setSize)

### .updateGtaoMaterial( parameters : Object )

根据给定的参数对象更新 GTAO 材质。

**parameters**

GTAO 材质参数。

### .updatePdMaterial( parameters : Object )

根据给定的参数对象更新降噪材质。

**parameters**

降噪参数。

## 源码

[examples/jsm/postprocessing/GTAOPass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/GTAOPass.js)

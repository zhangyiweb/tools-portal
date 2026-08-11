*Inheritance: Pass →*

# SSRPass

用于实现基础 SSR 效果的通道。

## 代码示例

```js
const ssrPass = new SSRPass( {
	renderer,
	scene,
	camera,
	width: innerWidth,
	height: innerHeight
} );
composer.addPass( ssrPass );
```

## 导入

SSRPass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { SSRPass } from 'three/addons/postprocessing/SSRPass.js';
```

## 构造函数

### new SSRPass( options : SSRPass~Options )

构造一个新的 SSR 通道。

**options**

通道选项。

## 属性

### .blur : boolean

是否对反射进行模糊。

默认值为 `true`。

### .bouncing : boolean

是否启用弹跳反射。

默认值为 `false`。

### .camera : Camera

相机。

### .clear : boolean

被重写为默认执行清除操作。

默认值为 `true`。

**重写：** [Pass#clear](Pass.html#clear)

### .distanceAttenuation : boolean

是否使用距离衰减。

默认值为 `true`。

### .fresnel : boolean

是否使用菲涅尔效果。

默认值为 `true`。

### .groundReflector : ReflectorForSSRPass

地面反射器。

默认值为 `0`。

### .height : number

效果的高度。

默认值为 `512`。

### .infiniteThick : boolean

是否使用无限厚度。

默认值为 `false`。

### .maxDistance : number

控制片元可反射的最远距离。

默认值为 `180`。

### .opacity : number

不透明度。

默认值为 `0.5`。

### .output : number

输出配置。

默认值为 `0`。

### .renderer : WebGLRenderer

渲染器。

### .resolutionScale : number

分辨率缩放。有效值范围为 `[0,1]`。`1` 表示最佳质量，但计算开销也更大。设为 `0.5` 表示以半分辨率计算效果。

默认值为 `1`。

### .scene : Scene

要渲染的场景。

### .selective : boolean

通道是否为选择性模式。

默认值为 `false`。

### .selects : Array.<Object3D>

应受 SSR 影响的 3D 对象。若未设置，则影响整个场景。

默认值为 `null`。

### .thickness : number

控制判定为可能反射命中与否的截止阈值。

默认值为 `.018`。

### .width : number

效果的宽度。

默认值为 `512`。

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

**重写：** [Pass#dispose](Pass.html#dispose)

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行 SSR 通道。

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

## 类型定义

### .Options

`SSRPass` 的构造函数选项。

**renderer**  
[WebGLRenderer](WebGLRenderer.html)

渲染器。

**scene**  
[Scene](Scene.html)

要渲染的场景。

**camera**  
[Camera](Camera.html)

相机。

**width**  
number

效果的宽度。

默认值为 `512`。

**height**  
number

效果的高度。

默认值为 `512`。

**selects**  
Array.<[Object3D](Object3D.html)\>

应受 SSR 影响的 3D 对象。若未设置，则影响整个场景。

默认值为 `null`。

**bouncing**  
boolean

是否启用弹跳反射。

默认值为 `false`。

**groundReflector**  
[ReflectorForSSRPass](ReflectorForSSRPass.html)

地面反射器。

默认值为 `null`。

## 源码

[examples/jsm/postprocessing/SSRPass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/SSRPass.js)

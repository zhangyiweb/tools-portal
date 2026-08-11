*Inheritance: Pass →*

# BokehPass

用于创建景深（DOF）效果的通道。

## 代码示例

```js
const bokehPass = new BokehPass( scene, camera, {
	focus: 500
	aperture: 5,
	maxblur: 0.01
} );
composer.addPass( bokehPass );
```

## 导入

BokehPass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
```

## 构造函数

### new BokehPass( scene : Scene, camera : Camera, params : BokehPass~Options )

构造一个新的 Bokeh 通道。

**scene**

要为其渲染景深效果的场景。

**camera**

相机。

**params**

通道选项。

## 属性

### .camera : Camera

相机。

### .materialBokeh : ShaderMaterial

通道的散景材质。

### .scene : Scene

要为其渲染景深效果的场景。

### .uniforms : Object

通道的 uniform 对象。如需在运行时更新 `focus`、`aperture` 或 `maxblur` 值，可使用此对象。

```js
pass.uniforms.focus.value = focus;
pass.uniforms.aperture.value = aperture;
pass.uniforms.maxblur.value = maxblur;
```

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

**重写：** [Pass#dispose](Pass.html#dispose)

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行 Bokeh 通道渲染。

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

`BokehPass` 的构造函数选项。

**focus**  
number

定义效果的焦点，即沿相机观察方向的世界单位距离。

默认值为 `1`。

**aperture**  
number

定义效果的光圈。

默认值为 `0.025`。

**maxblur**  
number

定义效果的最大模糊程度。

默认值为 `1`。

## 源码

[examples/jsm/postprocessing/BokehPass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/BokehPass.js)

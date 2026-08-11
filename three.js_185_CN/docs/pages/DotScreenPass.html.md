*Inheritance: Pass →*

# DotScreenPass

用于创建网点屏效果的通道。

## 代码示例

```js
const pass = new DotScreenPass( new THREE.Vector2( 0, 0 ), 0.5, 0.8 );
composer.addPass( pass );
```

## 导入

DotScreenPass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { DotScreenPass } from 'three/addons/postprocessing/DotScreenPass.js';
```

## 构造函数

### new DotScreenPass( center : Vector2, angle : number, scale : number )

构造一个新的网点屏通道。

**center**

中心点。

**angle**

效果的旋转角度（弧度）。

**scale**

效果的缩放。数值越高，网点越小。

## 属性

### .material : ShaderMaterial

通道材质。

### .uniforms : Object

通道的 uniform 对象。如需在运行时更新 `center`、`angle` 或 `scale` 值，可使用此对象。

```js
pass.uniforms.center.value.copy( center );
pass.uniforms.angle.value = 0;
pass.uniforms.scale.value = 0.5;
```

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

**重写：** [Pass#dispose](Pass.html#dispose)

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行网点屏通道渲染。

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

[examples/jsm/postprocessing/DotScreenPass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/DotScreenPass.js)

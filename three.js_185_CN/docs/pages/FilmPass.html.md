*Inheritance: Pass →*

# FilmPass

此通道可用于创建胶片颗粒效果。

## 代码示例

```js
const filmPass = new FilmPass();
composer.addPass( filmPass );
```

## 导入

FilmPass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
```

## 构造函数

### new FilmPass( intensity : number, grayscale : boolean )

构造一个新的胶片通道。

**intensity**

颗粒强度，取值范围为 `[0,1]`（0 = 无效果，1 = 完整效果）。

默认值为 `0.5`。

**grayscale**

是否应用灰度效果。

默认值为 `false`。

## 属性

### .material : ShaderMaterial

通道材质。

### .uniforms : Object

通道的 uniform 对象。如需在运行时更新 `intensity` 或 `grayscale` 值，可使用此对象。

```js
pass.uniforms.intensity.value = 1;
pass.uniforms.grayscale.value = true;
```

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

**重写：** [Pass#dispose](Pass.html#dispose)

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行胶片通道渲染。

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

[examples/jsm/postprocessing/FilmPass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/FilmPass.js)

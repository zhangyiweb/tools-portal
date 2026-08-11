*Inheritance: EventDispatcher → Object3D → Mesh →*

# FullScreenQuad

该模块是需要渲染全屏效果的通道的辅助工具，这在后处理场景中十分常见。

预期用法是复用同一个全屏四边形来渲染后续通道，只需重新指定 `material` 引用即可。

该模块只能与 [WebGLRenderer](WebGLRenderer.html) 一起使用。

## 导入

FullScreenQuad 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
```

## 构造函数

### new FullScreenQuad( material : Material )

构造一个新的全屏四边形。

**material**

用于渲染全屏四边形的材质。

## 属性

### .material : Material

四边形的材质。

**重写：** [Mesh#material](Mesh.html#material)

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再使用该实例时，应调用此方法。

### .render( renderer : WebGLRenderer )

渲染全屏四边形。

**renderer**

渲染器。

## 源码

[examples/jsm/postprocessing/Pass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/Pass.js)

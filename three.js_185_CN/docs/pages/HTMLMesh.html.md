*Inheritance: EventDispatcher → Object3D → Mesh →*

# HTMLMesh

该类可将 DOM 元素渲染到画布上，并将其用作平面网格的纹理。

典型用例是将 `lil-gui` 的 GUI 渲染为纹理，以便在 VR 中兼容使用。

## 代码示例

```js
const gui = new GUI( { width: 300 } ); // create lil-gui instance
const mesh = new HTMLMesh( gui.domElement );
scene.add( mesh );
```

## 导入

HTMLMesh 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { HTMLMesh } from 'three/addons/interactive/HTMLMesh.js';
```

## 构造函数

### new HTMLMesh( dom : HTMLElement )

构造一个新的 HTML 网格。

**dom**

要作为平面网格显示的 DOM 元素。

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源，并移除所有事件监听器。当应用中不再使用该实例时，请调用此方法。

## 源码

[examples/jsm/interactive/HTMLMesh.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/interactive/HTMLMesh.js)

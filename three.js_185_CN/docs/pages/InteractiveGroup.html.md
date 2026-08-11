*Inheritance: EventDispatcher → Object3D → Group →*

# InteractiveGroup

该类可用于将 3D 对象归入一个交互组。组本身可监听 Pointer、Mouse 或 XR 控制器事件，以检测其子级 3D 对象的选中。若某个 3D 对象被选中，相应事件会派发给该对象。

## 代码示例

```js
const group = new InteractiveGroup();
group.listenToPointerEvents( renderer, camera );
group.listenToXRControllerEvents( controller1 );
group.listenToXRControllerEvents( controller2 );
scene.add( group );
// now add objects that should be interactive
group.add( mesh1, mesh2, mesh3 );
```

## 导入

InteractiveGroup 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { InteractiveGroup } from 'three/addons/interactive/InteractiveGroup.js';
```

## 构造函数

### new InteractiveGroup()

## 属性

### .camera : Camera

用于光线投射的相机。

默认值为 `null`。

### .controllers : Array.<Group>

XR 控制器数组。

### .element : HTMLElement

内部光线投射器。

默认值为 `null`。

### .raycaster : Raycaster

内部光线投射器。

## 方法

### .disconnect()

断开该交互组与 DOM 及所有 XR 控制器的连接。

### .disconnectXrControllerEvents()

断开该交互组与所有 XR 控制器的连接。

### .disconnectionPointerEvents()

断开该交互组与所有 Pointer 和 Mouse 事件的连接。

### .listenToPointerEvents( renderer : WebGPURenderer | WebGLRenderer, camera : Camera )

调用此方法可使交互组监听 Pointer 和 Mouse 事件。目标为给定渲染器的 `domElement`。相机用于内部光线投射，以便根据事件检测 3D 对象。

**renderer**

渲染器。

**camera**

相机。

### .listenToXRControllerEvents( controller : Group )

调用此方法可使交互组监听给定 XR 控制器的事件。

**controller**

XR 控制器。

## 源码

[examples/jsm/interactive/InteractiveGroup.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/interactive/InteractiveGroup.js)

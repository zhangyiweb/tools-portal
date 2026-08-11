# SelectionBox

该类可用选择框在场景中选取 3D 对象。建议借助 [SelectionHelper](SelectionHelper.html) 可视化选中区域。

## 代码示例

```js
const selectionBox = new SelectionBox( camera, scene );
const selectedObjects = selectionBox.select( startPoint, endPoint );
```

## 导入

SelectionBox 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { SelectionBox } from 'three/addons/interactive/SelectionBox.js';
```

## 构造函数

### new SelectionBox( camera : Camera, scene : Scene, deep : number )

构造一个新的选择框。

**camera**

用于渲染场景的相机。

**scene**

场景。

**deep**

透视相机选择视锥体应延伸的深度。

默认值为 `Number.MAX_VALUE`。

## 属性

### .batches : Object

已选中的批处理网格批次。

### .camera : Camera

用于渲染场景的相机。

### .collection : Array.<Object3D>

已选中的 3D 对象。

### .deep : number

透视相机选择视锥体应延伸的深度。

默认值为 `Number.MAX_VALUE`。

### .endPoint : Vector3

选择的终点。

### .instances : Object

已选中的实例化网格实例 ID。

### .scene : Scene

场景。

### .startPoint : Vector3

选择的起点。

## 方法

### .select( startPoint : Vector3, endPoint : Vector3 ) : Array.<Object3D>

根据给定的起点和终点在场景中选取 3D 对象。若未提供参数，则使用对应成员的起点和终点值。

**startPoint**

起点。

**endPoint**

终点。

**返回值：** 已选中的 3D 对象。

## 源码

[examples/jsm/interactive/SelectionBox.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/interactive/SelectionBox.js)

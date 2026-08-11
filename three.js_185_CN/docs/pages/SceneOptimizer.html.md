# SceneOptimizer

此类可用于优化场景，将独立网格转换为 [BatchedMesh](BatchedMesh.html)。该组件是 three.js 中实现自动批处理的实验性尝试。

## 导入

SceneOptimizer 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { SceneOptimizer } from 'three/addons/utils/SceneOptimizer.js';
```

## 构造函数

### new SceneOptimizer( scene : Scene, options : SceneOptimizer~Options )

构造一个新的场景优化器。

**scene**

要优化的场景。

**options**

配置选项。

## 方法

### .disposeMeshes( meshesToRemove : Set.<Mesh> )

从场景中移除给定的网格数组。

**meshesToRemove**

要移除的网格。

### .removeEmptyNodes( object : Object3D )

从给定 3D 对象的所有后代中移除空节点。

**object**

要处理的 3D 对象。

### .toBatchedMesh() : Scene

通过识别场景中可表示为单个 [BatchedMesh](BatchedMesh.html) 的网格组来执行自动批处理。该方法会修改场景，添加 `BatchedMesh` 实例并移除现已冗余的独立网格。

**返回值：** 优化后的场景。

### .toInstancingMesh() : Scene (abstract)

通过识别场景中可表示为单个 [InstancedMesh](InstancedMesh.html) 的网格组来执行自动实例化。该方法会修改场景，添加 `InstancedMesh` 实例并移除现已冗余的独立网格。

此方法尚未实现。

**返回值：** 优化后的场景。

## 类型定义

### .Options

`SceneOptimizer` 的构造函数选项。

**debug**  
boolean

是否启用调试模式。

默认值为 `false`。

## 源码

[examples/jsm/utils/SceneOptimizer.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/utils/SceneOptimizer.js)
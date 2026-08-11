# SceneUtils

## 导入

SceneUtils 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import * as SceneUtils from 'three/addons/utils/SceneUtils.js';
```

## 方法

### .createMeshesFromInstancedMesh( instancedMesh : InstancedMesh ) : Group (inner)

此函数为给定实例化网格的每个实例创建一个网格，并将其添加到组中。每个网格将遵循其对应实例当前的 3D 变换。

**instancedMesh**

实例化网格。

**返回值：** 网格组。

### .createMeshesFromMultiMaterialMesh( mesh : Mesh ) : Group (inner)

此函数为给定多材质网格的每个几何体组创建一个网格，并将其添加到组中。

**mesh**

多材质网格。

**返回值：** 网格组。

### .createMultiMaterialObject( geometry : BufferGeometry, materials : Array.<Material> ) : Group (inner)

此函数提供了一种创建多材质 3D 对象的替代方式。通常使用 [BufferGeometry#groups](BufferGeometry.html#groups)，但这可能在将对象导出为 3D 格式时引入问题。此函数接受一个几何体和一个材质数组，为每个材质创建一个网格并添加到组中。

**geometry**

几何体。

**materials**

材质数组。

**返回值：** 表示多材质对象的组。

### .reduceVertices( object : Object3D, func : function, initialValue : any ) : any (inner)

对给定 3D 对象的每个顶点执行归约函数。`reduceVertices()` 返回单个值：函数的累积结果。

**object**

要处理的 3D 对象。必须具有带有 `position` 属性的几何体。

**func**

归约函数。第一个参数是当前值，第二个参数是当前顶点。

**initialValue**

初始值。

**返回值：** 结果。

### .sortInstancedMesh( mesh : InstancedMesh, compareFn : function ) (inner)

对给定实例化网格的实例进行排序。

**mesh**

要排序的实例化网格。

**compareFn**

用于排序的自定义比较函数。

### .traverseAncestorsGenerator( object : Object3D ) : Object3D (generator, inner)

基于生成器的 [Object3D#traverseAncestors](Object3D.html#traverseAncestors) 替代方案。

**object**

要遍历的对象。

##### 产出：

通过筛选条件的对象。

### .traverseGenerator( object : Object3D ) : Object3D (generator, inner)

基于生成器的 [Object3D#traverse](Object3D.html#traverse) 替代方案。

**object**

要遍历的对象。

##### 产出：

通过筛选条件的对象。

### .traverseVisibleGenerator( object : Object3D ) : Object3D (generator, inner)

基于生成器的 [Object3D#traverseVisible](Object3D.html#traverseVisible) 替代方案。

**object**

要遍历的对象。

##### 产出：

通过筛选条件的对象。

## 源码

[examples/jsm/utils/SceneUtils.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/utils/SceneUtils.js)

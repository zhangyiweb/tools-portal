# Octree

八叉树是一种层次化树形数据结构，用于通过对三维空间递归细分为八个卦限来进行空间划分。

本实现最多可有十六层，叶节点最多可存储八个三角形。

`Octree` 可用于游戏中计算游戏世界与玩家或其他动态 3D 对象的碰撞体之间的碰撞。

## 代码示例

```js
const octree = new Octree().fromGraphNode( scene );
const result = octree.capsuleIntersect( playerCollider ); // collision detection
```

## 导入

Octree 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { Octree } from 'three/addons/math/Octree.js';
```

## 构造函数

### new Octree( box : Box3 )

构造一个新的八叉树。

**box**

包围整个八叉树的基础盒子。

## 属性

### .bounds : Box3

八叉树的边界。与 [Octree#box](Octree.html#box) 相比，不应用边距。

### .box : Box3

包围整个八叉树的基础盒子。

### .layers : Layers

可用于图层配置，以便进行更精细的检测。

### .maxLevel : number

八叉树的最大层数。它定义了该数据结构的最大层次深度。

默认值为 `16`。

### .trianglesPerLeaf : number

叶节点在拆分前可存储的三角形数量。

默认值为 `8`。

## 方法

### .addTriangle( triangle : Triangle ) : Octree

将给定三角形添加到八叉树。若三角形顶点超出八叉树边界，则会被钳制。

**triangle**

要添加的三角形。

**返回值：** 对此八叉树的引用。

### .boxIntersect( box : Box3 ) : Object | boolean

对此八叉树执行包围盒相交检测。

**box**

要检测的包围盒。

**返回值：** 相交对象。如果未检测到相交，则方法返回 `false`。

### .build() : Octree

构建八叉树。

**返回值：** 对此八叉树的引用。

### .calcBox() : Octree

为构建准备 [Octree#box](Octree.html#box)。

**返回值：** 对此八叉树的引用。

### .capsuleIntersect( capsule : Capsule ) : Object | boolean

对此八叉树执行胶囊体相交检测。

**capsule**

要检测的胶囊体。

**返回值：** 相交对象。如果未检测到相交，则方法返回 `false`。

### .clear() : Octree

清空八叉树，使其为空。

**返回值：** 对此八叉树的引用。

### .fromGraphNode( group : Object3D ) : Octree

根据给定的 3D 对象构建八叉树。

**group**

场景图节点。

**返回值：** 对此八叉树的引用。

### .getBoxTriangles( box : Box3, triangles : Array.<Triangle> )

计算可能与给定包围盒相交的三角形。

**box**

包围盒。

**triangles**

用于存放三角形的目标数组。

### .getCapsuleTriangles( capsule : Capsule, triangles : Array.<Triangle> )

计算可能与给定胶囊体相交的三角形。

**capsule**

要检测的胶囊体。

**triangles**

用于存放三角形的目标数组。

### .getRayTriangles( ray : Ray, triangles : Array.<Triangle> )

计算可能与给定射线相交的三角形。

**ray**

要检测的射线。

**triangles**

用于存放三角形的目标数组。

### .getSphereTriangles( sphere : Sphere, triangles : Array.<Triangle> )

计算可能与给定包围球相交的三角形。

**sphere**

要检测的球体。

**triangles**

用于存放三角形的目标数组。

### .rayIntersect( ray : Ray ) : Object | boolean

对此八叉树执行射线相交检测。

**ray**

要检测的射线。

**返回值：** 最近的相交对象。如果未检测到相交，则方法返回 `false`。

### .sphereIntersect( sphere : Sphere ) : Object | boolean

对此八叉树执行包围球相交检测。

**sphere**

要检测的包围球。

**返回值：** 相交对象。如果未检测到相交，则方法返回 `false`。

### .split( level : number ) : Octree

拆分八叉树。此方法在构建八叉树时被递归调用。

**level**

当前层数。

**返回值：** 对此八叉树的引用。

### .triangleBoxIntersect( box : Box3, triangle : Triangle ) : Object | false

计算给定包围盒与三角形之间的相交。

**box**

要检测的包围盒。

**triangle**

要检测的三角形。

**返回值：** 相交对象。如果未检测到相交，则方法返回 `false`。

### .triangleCapsuleIntersect( capsule : Capsule, triangle : Triangle ) : Object | false

计算给定胶囊体与三角形之间的相交。

**capsule**

要检测的胶囊体。

**triangle**

要检测的三角形。

**返回值：** 相交对象。如果未检测到相交，则方法返回 `false`。

### .triangleSphereIntersect( sphere : Sphere, triangle : Triangle ) : Object | false

计算给定球体与三角形之间的相交。

**sphere**

要检测的球体。

**triangle**

要检测的三角形。

**返回值：** 相交对象。如果未检测到相交，则方法返回 `false`。

## 源码

[examples/jsm/math/Octree.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/math/Octree.js)

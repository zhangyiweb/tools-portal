# ConvexHull

可用于计算给定点集在三维空间中的凸包。它主要用于 [ConvexGeometry](ConvexGeometry.html)。

此 Quickhull 3D 实现移植自 Mauricio Poppe 的 [quickhull3d](https://github.com/maurizzzio/quickhull3d/)。

## 导入

ConvexHull 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { ConvexHull } from 'three/addons/math/ConvexHull.js';
```

## 构造函数

### new ConvexHull()

构造一个新的凸包。

## 方法

### .containsPoint( point : Vector3 ) : boolean

若给定点位于凸包内，则返回 `true`。

**point**

要测试的点。

**返回值：** 给定点是否位于凸包内。

### .intersectRay( ray : Ray, target : Vector3 ) : Vector3

计算给定射线与此凸包的交点。

**ray**

要测试的射线。

**target**

用于存储方法结果的目标向量。

**返回值：** 交点。若未检测到相交则返回 `null`。

### .intersectsRay( ray : Ray ) : boolean

若给定射线与此凸包相交，则返回 `true`。

**ray**

要测试的射线。

**返回值：** 给定射线是否与此凸包相交。

### .makeEmpty() : ConvexHull

清空此凸包。

**返回值：** 对此凸包的引用。

### .setFromObject( object : Object3D ) : ConvexHull

计算给定 3D 对象（包括其子对象）的凸包，并考虑对象及其子对象的世界变换。

**object**

要计算凸包的 3D 对象。

**返回值：** 对此凸包的引用。

### .setFromPoints( points : Array.<Vector3> ) : ConvexHull

根据给定点数组计算凸包。

**points**

三维空间中的点数组。

**返回值：** 对此凸包的引用。

## 源码

[examples/jsm/math/ConvexHull.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/math/ConvexHull.js)

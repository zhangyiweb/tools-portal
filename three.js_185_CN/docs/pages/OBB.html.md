# OBB

表示三维空间中的定向包围盒（Oriented Bounding Box，OBB）。

## 导入

OBB 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { OBB } from 'three/addons/math/OBB.js';
```

## 构造函数

### new OBB( center : Vector3, halfSize : Vector3, rotation : Matrix3 )

构造一个新的 OBB。

**center**

OBB 的中心。

**halfSize**

OBB 沿各轴的正半宽范围。

**rotation**

OBB 的旋转。

## 属性

### .center : Vector3

OBB 的中心。

### .halfSize : Vector3

OBB 沿各轴的正半宽范围。

### .rotation : Matrix3

OBB 的旋转。

## 方法

### .applyMatrix4( matrix : Matrix4 ) : OBB

将给定的变换矩阵应用于此 OBB。此方法可用于使用 3D 对象的世界矩阵变换包围体，以使两者保持同步。

**matrix**

要应用的矩阵。

**返回值：** 对此 OBB 的引用。

### .clampPoint( point : Vector3, target : Vector3 ) : Vector3

将给定点钳制在此 OBB 的边界内。

**point**

应钳制在此 OBB 边界内的点。

**target**

用于存储方法结果的目标向量。

**返回值：**

*   钳制后的点。

### .clone() : OBB

返回一个新的 OBB，其值从此实例复制而来。

**返回值：** 此实例的克隆。

### .containsPoint( point : Vector3 ) : boolean

如果给定点位于此 OBB 内，则返回 `true`。

**point**

要检测的点。

**返回值：**

*   给定点是否位于此 OBB 内。

### .copy( obb : OBB ) : OBB

将给定 OBB 的值复制到此实例。

**obb**

要复制的 OBB。

**返回值：** 对此 OBB 的引用。

### .equals( obb : OBB ) : boolean

如果给定 OBB 与此 OBB 相等，则返回 `true`。

**obb**

要检测的 OBB。

**返回值：** 给定 OBB 是否与此 OBB 相等。

### .fromBox3( box3 : Box3 ) : OBB

根据给定的 AABB 定义一个 OBB。

**box3**

用于设置此 OBB 的 AABB。

**返回值：** 对此 OBB 的引用。

### .getSize( target : Vector3 ) : Vector3

返回此 OBB 的尺寸。

**target**

用于存储方法结果的目标向量。

**返回值：** 尺寸。

### .intersectRay( ray : Ray, target : Vector3 ) : Vector3

执行射线与 OBB 的相交检测，并将交点存储到给定的三维向量中。

**ray**

要检测的射线。

**target**

用于存储方法结果的目标向量。

**返回值：** 交点。如果未检测到相交，则返回 `null`。

### .intersectsBox3( box3 : Box3 ) : boolean

如果给定 AABB 与此 OBB 相交，则返回 `true`。

**box3**

要检测的 AABB。

**返回值：**

*   给定 AABB 是否与此 OBB 相交。

### .intersectsOBB( obb : OBB, epsilon : number ) : boolean

如果给定 OBB 与此 OBB 相交，则返回 `true`。

**obb**

要检测的 OBB。

**epsilon**

用于防止算术误差的小值。

默认值为 `Number.EPSILON`。

**返回值：**

*   给定 OBB 是否与此 OBB 相交。

### .intersectsPlane( plane : Plane ) : boolean

如果给定平面与此 OBB 相交，则返回 `true`。

**plane**

要检测的平面。

**返回值：** 给定平面是否与此 OBB 相交。

### .intersectsRay( ray : Ray ) : boolean

如果给定射线与此 OBB 相交，则返回 `true`。

**ray**

要检测的射线。

**返回值：** 给定射线是否与此 OBB 相交。

### .intersectsSphere( sphere : Sphere ) : boolean

如果给定包围球与此 OBB 相交，则返回 `true`。

**sphere**

要检测的包围球。

**返回值：**

*   给定包围球是否与此 OBB 相交。

### .set( center : Vector3, halfSize : Vector3, rotation : Matrix3 ) : OBB

将 OBB 的各分量设置为给定值。

**center**

OBB 的中心。

**halfSize**

OBB 沿各轴的正半宽范围。

**rotation**

OBB 的旋转。

**返回值：** 对此 OBB 的引用。

## 源码

[examples/jsm/math/OBB.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/math/OBB.js)

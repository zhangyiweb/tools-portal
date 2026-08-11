# Capsule

胶囊体本质上是两端带有半球形盖的圆柱体。可以将其理解为扫掠球体，即将一个球体沿线段移动所形成的形状。

胶囊体常被用作包围体（与 AABB 和包围球并列）。

## 导入

Capsule 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { Capsule } from 'three/addons/math/Capsule.js';
```

## 构造函数

### new Capsule( start : Vector3, end : Vector3, radius : number )

构造一个新的胶囊体。

**start**

起点向量。

**end**

终点向量。

**radius**

胶囊体的半径。

默认值为 `1`。

## 属性

### .end : Vector3

终点向量。

### .radius : number

胶囊体的半径。

默认值为 `1`。

### .start : Vector3

起点向量。

## 方法

### .clone() : Capsule

返回一个新胶囊体，其值从本实例复制而来。

**返回值：** 此实例的克隆。

### .copy( capsule : Capsule ) : Capsule

将给定胶囊体的值复制到本实例。

**capsule**

要复制的胶囊体。

**返回值：** 对此胶囊体的引用。

### .getCenter( target : Vector3 ) : Vector3

返回此胶囊体的中心点。

**target**

用于存储方法结果的目标向量。

**返回值：** 中心点。

### .intersectsBox( box : Box3 ) : boolean

若给定包围盒与此胶囊体相交，则返回 `true`。

**box**

要测试的包围盒。

**返回值：** 给定包围盒是否与此胶囊体相交。

### .set( start : Vector3, end : Vector3, radius : number ) : Capsule

将胶囊体的各分量设置为给定值。请注意，此方法仅从给定对象复制值。

**start**

起点向量。

**end**

终点向量。

**radius**

胶囊体的半径。

**返回值：** 对此胶囊体的引用。

### .translate( v : Vector3 ) : Capsule

将给定偏移量加到此胶囊体上，从而在三维空间中移动它。

**v**

用于平移胶囊体的偏移量。

**返回值：** 对此胶囊体的引用。

## 源码

[examples/jsm/math/Capsule.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/math/Capsule.js)

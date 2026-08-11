# GeometryUtils

## 导入

GeometryUtils 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import * as GeometryUtils from 'three/addons/utils/GeometryUtils.js';
```

## 方法

### .gosper( size : number ) : Array.<number> (inner)

生成 Gosper 曲线（位于 XY 平面）。

参考：[https://gist.github.com/nitaku/6521802](https://gist.github.com/nitaku/6521802)

**size**

单个 Gosper 岛屿的大小。

默认值为 `1`。

**返回值：** Gosper 岛屿的点。

### .hilbert2D( center : Vector3, size : number, iterations : number, v0 : number, v1 : number, v2 : number, v3 : number ) : Array.<Vector3> (inner)

沿 Hilbert 曲线生成二维坐标。

基于以下工作：[http://www.openprocessing.org/sketch/15493](http://www.openprocessing.org/sketch/15493)

**center**

Hilbert 曲线的中心。

**size**

Hilbert 曲线的总宽度。

默认值为 `10`。

**iterations**

细分次数。

默认值为 `10`。

**v0**

角点索引 -X, -Z。

默认值为 `0`。

**v1**

角点索引 -X, +Z。

默认值为 `1`。

**v2**

角点索引 +X, +Z。

默认值为 `2`。

**v3**

角点索引 +X, -Z。

默认值为 `3`。

**返回值：** Hilbert 曲线的点。

### .hilbert3D( center : Vector3, size : number, iterations : number, v0 : number, v1 : number, v2 : number, v3 : number, v4 : number, v5 : number, v6 : number, v7 : number ) : Array.<Vector3> (inner)

沿 Hilbert 曲线生成三维坐标。

基于以下工作：[https://openprocessing.org/user/5654](https://openprocessing.org/user/5654)

**center**

Hilbert 曲线的中心。

**size**

Hilbert 曲线的总宽度。

默认值为 `10`。

**iterations**

细分次数。

默认值为 `1`。

**v0**

角点索引 -X, +Y, -Z。

默认值为 `0`。

**v1**

角点索引 -X, +Y, +Z。

默认值为 `1`。

**v2**

角点索引 -X, -Y, +Z。

默认值为 `2`。

**v3**

角点索引 -X, -Y, -Z。

默认值为 `3`。

**v4**

角点索引 +X, -Y, -Z。

默认值为 `4`。

**v5**

角点索引 +X, -Y, +Z。

默认值为 `5`。

**v6**

角点索引 +X, +Y, +Z。

默认值为 `6`。

**v7**

角点索引 +X, +Y, -Z。

默认值为 `7`。

**返回值：**

*   Hilbert 曲线的点。

## 源码

[examples/jsm/utils/GeometryUtils.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/utils/GeometryUtils.js)

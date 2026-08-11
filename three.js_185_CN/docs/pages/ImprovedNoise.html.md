# ImprovedNoise

提供三维噪声函数的工具类。

代码基于 Ken Perlin 于 2002 年发布的 [IMPROVED NOISE](https://cs.nyu.edu/~perlin/noise/)。

## 导入

ImprovedNoise 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
```

## 构造函数

### new ImprovedNoise()

## 方法

### .noise( x : number, y : number, z : number ) : number

根据给定参数返回噪声值。

**x**

x 坐标。

**y**

y 坐标。

**z**

z 坐标。

**返回值：** 噪声值。

## 源码

[examples/jsm/math/ImprovedNoise.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/math/ImprovedNoise.js)

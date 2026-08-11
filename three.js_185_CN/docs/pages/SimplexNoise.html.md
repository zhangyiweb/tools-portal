# SimplexNoise

提供噪声函数的工具类。

代码基于 Stefan Gustavson 于 2005 年撰写的 [Simplex noise demystified](https://web.archive.org/web/20210210162332/http://staffwww.itn.liu.se/~stegu/simplexnoise/simplexnoise.pdf)。

## 导入

SimplexNoise 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
```

## 构造函数

### new SimplexNoise( r : Object )

构造一个新的 simplex noise 对象。

**r**

持有 `random()` 方法的数学工具类。这使得可以传入自定义随机数生成器。

默认值为 `Math`。

## 方法

### .noise( xin : number, yin : number ) : number

二维 simplex 噪声方法。

**xin**

x 坐标。

**yin**

y 坐标。

**返回值：** 噪声值。

### .noise3d( xin : number, yin : number, zin : number ) : number

三维 simplex 噪声方法。

**xin**

x 坐标。

**yin**

y 坐标。

**zin**

z 坐标。

**返回值：** 噪声值。

### .noise4d( x : number, y : number, z : number, w : number ) : number

四维 simplex 噪声方法。

**x**

x 坐标。

**y**

y 坐标。

**z**

z 坐标。

**w**

w 坐标。

**返回值：** 噪声值。

## 源码

[examples/jsm/math/SimplexNoise.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/math/SimplexNoise.js)

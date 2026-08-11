# ColorConverter

提供颜色转换辅助函数的工具类。

## 导入

ColorConverter 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { ColorConverter } from 'three/addons/math/ColorConverter.js';
```

## 静态方法

### .getHSV( color : Color, target : Object ) : Object

返回给定颜色对象的 HSV 颜色表示。

**color**

要从中获取 HSV 值的颜色。

**target**

用于存储方法结果的目标对象。

**返回值：** HSV 颜色。

### .setHSV( color : Color, h : number, s : number, v : number ) : Color

将给定的 HSV 颜色定义设置到给定颜色对象。

**color**

要设置的颜色。

**h**

色相。

**s**

饱和度。

**v**

明度。

**返回值：** 更新后的颜色。

## 源码

[examples/jsm/math/ColorConverter.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/math/ColorConverter.js)

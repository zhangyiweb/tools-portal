# ColorUtils

## 导入

ColorUtils 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import * as ColorUtils from 'three/addons/utils/ColorUtils.js';
```

## 方法

### .setKelvin( color : Color, kelvin : number ) : Color (inner)

根据开尔文色温设置给定颜色。

使用 Tanner Helland 的算法将相关色温（CTT）转换为近似的 sRGB 颜色。适用于基于物理的光照设置 — 例如蜡烛火焰（约 1900K）、钨丝灯泡（约 3200K）、日光（约 6500K）或晴朗蓝天（约 10000K）。超出 \[1000, 40000\] 范围的值会被钳制。

参考：https://tannerhelland.com/2012/09/18/convert-temperature-rgb-algorithm-code.html

**color**

要设置的颜色。

**kelvin**

开尔文色温。[1000, 40000] 范围内会被钳制。

**返回值：** 更新后的颜色。

## 源码

[examples/jsm/utils/ColorUtils.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/utils/ColorUtils.js)

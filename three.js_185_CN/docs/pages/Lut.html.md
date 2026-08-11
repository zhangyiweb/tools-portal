# Lut

表示颜色映射的查找表。用于从一段数据值范围中确定颜色值。

## 代码示例

```js
const lut = new Lut( 'rainbow', 512 );
const color = lut.getColor( 0.5 );
```

## 导入

Lut 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { Lut } from 'three/addons/math/Lut.js';
```

## 构造函数

### new Lut( colormap : 'rainbow' | 'cooltowarm' | 'blackbody' | 'grayscale', count : number )

构造一个新的 Lut。

**colormap**

从预定义的颜色映射列表中设置颜色映射。

默认值为 `'rainbow'`。

**count**

设置用于表示数据数组的颜色数量。

默认值为 `32`。

## 属性

### .isLut : boolean (readonly)

此标志可用于类型检测。

默认值为 `true`。

### .lut : Array.<Color>

所选颜色映射的查找表。

### .map : Array.<Array.<number>>

当前所选的颜色映射。

### .maxV : number

查找表所表示的最大值。

默认值为 `1`。

### .minV : number

查找表所表示的最小值。

默认值为 `0`。

### .n : number

当前所选颜色映射的颜色数量。

默认值为 `32`。

## 方法

### .addColorMap( name : string, arrayOfColors : Array.<Array.<number>> ) : Lut

向此 Lut 实例添加颜色映射。

**name**

颜色映射的名称。

**arrayOfColors**

颜色值数组。每个值是一个数组，包含阈值和以十六进制数表示的实际颜色值。

**返回值：** 对此 LUT 的引用。

### .copy( lut : Lut ) : Lut

复制给定的 lut。

**lut**

要复制的 LUT。

**返回值：** 对此 LUT 的引用。

### .createCanvas() : HTMLCanvasElement

创建一个画布，以便将查找表可视化为纹理。

**返回值：** 创建的画布。

### .getColor( alpha : number ) : Color

返回给定数据值对应的 Color 实例。

**alpha**

要查找的值。

**返回值：** 来自 LUT 的颜色。

### .set( value : Lut ) : Lut

设置给定的 LUT。

**value**

要设置的 LUT。

**返回值：** 对此 LUT 的引用。

### .setColorMap( colormap : string, count : number ) : Lut

为给定的颜色映射和颜色数量配置查找表。

**colormap**

颜色映射的名称。

**count**

颜色数量。

默认值为 `32`。

**返回值：** 对此 LUT 的引用。

### .setMax( max : number ) : Lut

设置此 LUT 所表示的最大值。

**max**

查找表所表示的最大值。

**返回值：** 对此 LUT 的引用。

### .setMin( min : number ) : Lut

设置此 LUT 所表示的最小值。

**min**

查找表所表示的最小值。

**返回值：** 对此 LUT 的引用。

### .updateCanvas( canvas : HTMLCanvasElement ) : HTMLCanvasElement

用 Lut 的数据更新给定画布。

**canvas**

要更新的画布。

**返回值：** 更新后的画布。

## 源码

[examples/jsm/math/Lut.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/math/Lut.js)

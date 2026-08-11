# ColorSpaces

## 属性

### .DisplayP3ColorSpace : string (constant)

Display-P3 颜色空间。

### .DisplayP3ColorSpaceImpl : module:ColorSpaces~ColorSpaceImpl (constant)

Display-P3 颜色空间的实现对象。

### .ExtendedSRGBColorSpace : string (constant)

Extended-sRGB 颜色空间。

### .ExtendedSRGBColorSpaceImpl : module:ColorSpaces~ColorSpaceImpl (constant)

Extended-sRGB 颜色空间的实现对象。

### .LinearDisplayP3ColorSpace : string (constant)

Display-P3-Linear 颜色空间。

### .LinearDisplayP3ColorSpaceImpl : module:ColorSpaces~ColorSpaceImpl (constant)

Display-P3-Linear 颜色空间的实现对象。

### .LinearRec2020ColorSpace : string (constant)

Rec2020-Linear 颜色空间。

### .LinearRec2020ColorSpaceImpl : module:ColorSpaces~ColorSpaceImpl (constant)

Rec2020-Linear 颜色空间的实现对象。

## 类型定义

### .ColorSpaceImpl

包含颜色空间实现的对象。

**primaries**  
Array.<number>

基色。

**whitePoint**  
Array.<number>

白点。

**toXYZ**  
[Matrix3](Matrix3.html)

转换到 CIE XYZ 的颜色空间转换矩阵。

**fromXYZ**  
[Matrix3](Matrix3.html)

从 CIE XYZ 转换的颜色空间转换矩阵。

**luminanceCoefficients**  
Array.<number>

亮度系数。

**workingColorSpaceConfig**  
Object

工作颜色空间配置。

**outputColorSpaceConfig**  
Object

绘图缓冲区颜色空间配置。

## 源码

[examples/jsm/math/ColorSpaces.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/math/ColorSpaces.js)

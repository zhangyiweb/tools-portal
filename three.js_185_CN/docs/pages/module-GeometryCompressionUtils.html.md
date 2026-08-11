# GeometryCompressionUtils

## 导入

GeometryCompressionUtils 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import * as GeometryCompressionUtils from 'three/addons/utils/GeometryCompressionUtils.js';
```

## 方法

### .compressNormals( geometry : BufferGeometry, encodeMethod : 'DEFAULT' | 'OCT1Byte' | 'OCT2Byte' | 'ANGLES' ) (inner)

按所选编码方法压缩给定几何体的 `normal` 属性。

**geometry**

要压缩法线的几何体。

**encodeMethod**

压缩方法。

### .compressPositions( geometry : BufferGeometry ) (inner)

压缩给定几何体的 `position` 属性。

**geometry**

要压缩位置值的几何体。

### .compressUvs( geometry : BufferGeometry ) (inner)

压缩给定几何体的 `uv` 属性。

**geometry**

要压缩纹理坐标的几何体。

## 源码

[examples/jsm/utils/GeometryCompressionUtils.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/utils/GeometryCompressionUtils.js)

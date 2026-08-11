*Inheritance: Pass → ShaderPass →*

# LUTPass

通过查找表进行色彩分级的通道。

## 代码示例

```js
const lutPass = new LUTPass( { lut: lut.texture3D } );
composer.addPass( lutPass );
```

## 导入

LUTPass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { LUTPass } from 'three/addons/postprocessing/LUTPass.js';
```

## 构造函数

### new LUTPass( options : Object )

构造一个 LUT 通道。

**options**

通道选项。

默认值为 `{}`。

## 属性

### .intensity : number

强度。

默认值为 `1`。

### .lut : Data3DTexture

作为 3D 纹理的 LUT。

默认值为 `null`。

## 源码

[examples/jsm/postprocessing/LUTPass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/LUTPass.js)

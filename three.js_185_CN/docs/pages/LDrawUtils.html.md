# LDrawUtils

LDraw 模型的工具类。

## 导入

LDrawUtils 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { LDrawUtils } from 'three/addons/utils/LDrawUtils.js';
```

## 构造函数

### new LDrawUtils()

## 静态方法

### .mergeObject( object : Object3D ) : Group

按材质合并给定对象中的几何体并返回新的组对象。用于未索引的几何体。对象缓冲区引用原对象的缓冲区。对 LDrawLoader 生成的条件线会进行特殊处理。

**object**

要合并的对象。

**返回值：** 合并后的对象。

## 源码

[examples/jsm/utils/LDrawUtils.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/utils/LDrawUtils.js)
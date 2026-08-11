# SkeletonUtils

## 导入

SkeletonUtils 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
```

## 方法

### .clone( source : Object3D ) : Object3D (inner)

克隆给定的 3D 对象及其后代，确保任何 `SkinnedMesh` 实例与其骨骼正确关联。骨骼也会被克隆，且必须是传入此方法的 3D 对象的后代。其他数据（如几何体和材质）通过引用复用。

**source**

要克隆的 3D 对象。

**返回值：** 克隆后的 3D 对象。

### .retarget( target : Object3D | Skeleton, source : Object3D | Skeleton, options : module:SkeletonUtils~RetargetOptions ) (inner)

将给定源的骨骼重定向到目标。

`target` 和 `source` 都可以是带有 skeleton 属性的 3D 对象（例如蒙皮网格），也可以直接是 [Skeleton](Skeleton.html)。

**target**

目标对象。

**source**

源对象。

**options**

选项。

### .retargetClip( target : Object3D, source : Object3D | Skeleton, clip : AnimationClip, options : module:SkeletonUtils~RetargetOptions ) : AnimationClip (inner)

将源的动画剪辑重定向到目标 3D 对象。

`source` 可以是带有 skeleton 属性的 3D 对象（例如蒙皮网格），也可以直接是 [Skeleton](Skeleton.html)。

**target**

目标 3D 对象。必须具有 `skeleton` 属性。

**source**

源对象。

**clip**

动画剪辑。

**options**

选项。

**返回值：** 重定向后的动画剪辑。

## 类型定义

### .RetargetOptions

`SkeletonUtils` 的重定向选项。

**useFirstFramePosition**  
boolean

是否使用第一帧的位置。

默认值为 `false`。

**fps**  
number

剪辑的帧率。

**names**  
Object.<string, string>

用于映射目标到源骨骼名称的字典。

**getBoneName**  
function

用于映射骨骼名称的函数。`names` 的替代方案。

**trim**  
Array.<number>

是否裁剪剪辑。如果设置，数组应包含起始和结束两个值。

**preserveBoneMatrix**  
boolean

是否保留骨骼矩阵。

默认值为 `true`。

**preserveBonePositions**  
boolean

是否保留骨骼位置。

默认值为 `true`。

**useTargetMatrix**  
boolean

是否使用目标矩阵。

默认值为 `false`。

**hip**  
string

源对象髋部骨骼的名称。

默认值为 `'hip'`。

**hipInfluence**  
[Vector3](Vector3.html)

髋部影响。

默认值为 `(1,1,1)`。

**scale**  
number

缩放。

默认值为 `1`。

**localOffsets**  
Object.<string, [Matrix4](Matrix4.html)\>

按骨骼名称索引的每骨骼局部偏移矩阵。

**hipPosition**  
[Vector3](Vector3.html)

应用于髋部骨骼的额外位置偏移。

## 源码

[examples/jsm/utils/SkeletonUtils.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/utils/SkeletonUtils.js)

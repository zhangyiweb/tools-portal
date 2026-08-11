# BufferGeometryUtils

## 导入

BufferGeometryUtils 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
```

## 方法

### .computeMikkTSpaceTangents( geometry : BufferGeometry, MikkTSpace : Object, negateSign : boolean ) : BufferGeometry (inner)

使用 MikkTSpace 算法计算顶点切线。MikkTSpace 能稳定生成一致的切线，大多数建模工具和法线贴图烘焙器都会使用它。对于带有法线贴图的材质，应使用 MikkTSpace，因为不一致的切线可能导致法线贴图出现细微的视觉问题，尤其是在镜像 UV 接缝附近。

与此方法相比，[BufferGeometry#computeTangents](BufferGeometry.html#computeTangents)（自定义算法）生成的切线很可能与其他软件中的切线不匹配。自定义算法对于配合自定义材质的一般用途已经足够，且可能比 MikkTSpace 更快。

返回原始 BufferGeometry。已索引的几何体将被去索引。需要 position、normal 和 uv 属性。

**geometry**

要计算切线的几何体。

**MikkTSpace**

`examples/jsm/libs/mikktspace.module.js` 的实例，或 `mikktspace` npm 包。使用前请等待 `MikkTSpace.ready`。

**negateSign**

是否对每个切线的符号分量（.w）取反。某些格式的法线贴图约定需要此参数，包括 glTF。

默认值为 `true`。

**返回值：** 更新后的几何体。

### .computeMorphedAttributes( object : Mesh | Line | Points ) : Object (inner)

计算变形/蒙皮 BufferGeometry 的变形属性。

有助于光线追踪或贴花（例如，将 `DecalGeometry` 应用于带有 `BufferGeometry` 的变形对象时，会使用原始 `BufferGeometry`，而非变形/蒙皮后的几何体，从而产生错误结果。使用此函数创建影子 `Object3`D，即可正确生成 `DecalGeometry`）。

**object**

要计算变形属性的 3D 对象。

**返回值：** 包含原始 position/normal 属性和变形后属性的对象。

### .deepCloneAttribute( attribute : BufferAttribute ) : BufferAttribute (inner)

对给定的 buffer attribute 执行深克隆。

**attribute**

要克隆的属性。

**返回值：** 克隆后的属性。

### .deinterleaveAttribute( attribute : InterleavedBufferAttribute ) : BufferAttribute (inner)

返回给定属性的新的非交错版本。

**attribute**

交错属性。

**返回值：** 非交错属性。

### .deinterleaveGeometry( geometry : BufferGeometry ) (inner)

对给定几何体上的所有属性进行去交错。

**geometry**

要去交错的几何体。

### .estimateBytesUsed( geometry : BufferGeometry ) : number (inner)

返回所有属性表示该几何体所使用的字节数。

**geometry**

该几何体。

**返回值：** 估算使用的字节数。

### .interleaveAttributes( attributes : Array.<BufferAttribute> ) : Array.<InterleavedBufferAttribute> (inner)

交错一组属性，并返回共享单个 [InterleavedBuffer](InterleavedBuffer.html) 实例的对应属性新数组。所有属性必须具有兼容的类型。

**attributes**

要交错的属性。

**返回值：** 交错属性数组。如果交错不成功，该方法返回 `null`。

### .mergeAttributes( attributes : Array.<BufferAttribute> ) : BufferAttribute (inner)

将一组属性合并为单个实例。所有属性必须具有兼容的属性和类型。不支持 [InterleavedBufferAttribute](InterleavedBufferAttribute.html) 实例。

**attributes**

要合并的属性。

**返回值：** 合并后的属性。如果合并不成功，则返回 `null`。

### .mergeGeometries( geometries : Array.<BufferGeometry>, useGroups : boolean ) : BufferGeometry (inner)

将一组几何体合并为单个实例。所有几何体必须具有兼容的属性。

**geometries**

要合并的几何体。

**useGroups**

是否使用分组。

默认值为 `false`。

**返回值：** 合并后的几何体。如果合并不成功，则返回 `null`。

### .mergeGroups( geometry : BufferGeometry ) : BufferGeometry (inner)

合并给定几何体的 [BufferGeometry#groups](BufferGeometry.html#groups)。

**geometry**

要修改的几何体。

**返回值：**

*   更新后的几何体

### .mergeVertices( geometry : BufferGeometry, tolerance : number ) : BufferGeometry (inner)

返回一个新几何体，其中所有相似顶点属性（在容差范围内）的顶点已被合并。

**geometry**

要合并顶点的几何体。

**tolerance**

容差值。

默认值为 `1e-4`。

**返回值：**

*   合并顶点后的新几何体。

### .toCreasedNormals( geometry : BufferGeometry, creaseAngle : number ) : BufferGeometry (inner)

如果提供的几何体是非索引的，则修改它；否则创建一个新的非索引几何体。返回的几何体除夹角大于折痕角的面之外，各处都具有平滑法线。

**geometry**

要修改的几何体。

**creaseAngle**

折痕角（弧度）。

默认值为 `Math.PI/3`。

**返回值：**

*   更新后的几何体

### .toTrianglesDrawMode( geometry : BufferGeometry, drawMode : number ) : BufferGeometry (inner)

基于 `TrianglesDrawMode` 绘制模式返回一个新的索引几何体。此模式对应于 WebGL 中的 `gl.TRIANGLES` 图元。

**geometry**

要转换的几何体。

**drawMode**

当前的绘制模式。

**返回值：** 使用 `TrianglesDrawMode` 的新几何体。

## 源码

[examples/jsm/utils/BufferGeometryUtils.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/utils/BufferGeometryUtils.js)

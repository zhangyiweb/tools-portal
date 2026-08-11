# MeshSurfaceSampler

用于在网格表面上采样加权随机点的工具类。

构建采样器是一次性的 O(n) 操作。构建完成后，可在 O(logn) 时间内选取任意数量的随机样本。内存占用为 O(n)。

参考：

*   [http://www.joesfer.com/?p=84](http://www.joesfer.com/?p=84)
*   [https://stackoverflow.com/a/4322940/1314762](https://stackoverflow.com/a/4322940/1314762)

## 代码示例

```js
const sampler = new MeshSurfaceSampler( surfaceMesh )
	.setWeightAttribute( 'color' )
	.build();
const mesh = new THREE.InstancedMesh( sampleGeometry, sampleMaterial, 100 );
const position = new THREE.Vector3();
const matrix = new THREE.Matrix4();
// Sample randomly from the surface, creating an instance of the sample geometry at each sample point.
for ( let i = 0; i < 100; i ++ ) {
	sampler.sample( position );
	matrix.makeTranslation( position.x, position.y, position.z );
	mesh.setMatrixAt( i, matrix );
}
scene.add( mesh );
```

## 导入

MeshSurfaceSampler 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
```

## 构造函数

### new MeshSurfaceSampler( mesh : Mesh )

构造一个网格表面采样器。

**mesh**

要从中采样的表面网格。

## 方法

### .build() : MeshSurfaceSampler

处理输入几何体并准备返回样本。几何体或采样器的任何配置都必须在调用此方法之前完成。对于具有 n 个面的表面，时间复杂度为 O(n)。

**返回值：** 对此采样器的引用。

### .sample( targetPosition : Vector3, targetNormal : Vector3, targetColor : Color, targetUV : Vector2 ) : MeshSurfaceSampler

在输入几何体表面上选择一个随机点，返回该点的位置，并可选择返回法线向量、颜色和 UV 坐标。对于具有 n 个面的表面，时间复杂度为 O(log n)。

**targetPosition**

保存采样位置的目标对象。

**targetNormal**

保存采样法线的目标对象。

**targetColor**

保存采样颜色的目标对象。

**targetUV**

保存采样 UV 坐标的目标对象。

**返回值：** 对此采样器的引用。

### .setRandomGenerator( randomFunction : function ) : MeshSurfaceSampler

允许设置自定义随机数生成器。默认值为 `Math.random()`。

**randomFunction**

随机数生成器。

**返回值：** 对此采样器的引用。

### .setWeightAttribute( name : string ) : MeshSurfaceSampler

指定在从表面采样时用作权重的顶点属性。权重较高的面更有可能被采样，权重为零的面则完全不会被采样。对于向量属性，采样时仅使用 .x。

如果未选择权重属性，则采样按面积随机分布。

**name**

属性名称。

**返回值：** 对此采样器的引用。

## 源码

[examples/jsm/math/MeshSurfaceSampler.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/math/MeshSurfaceSampler.js)

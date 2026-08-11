*Inheritance: Pass →*

# OutlinePass

用于在选中对象周围渲染描边的通道。

## 代码示例

```js
const resolution = new THREE.Vector2( window.innerWidth, window.innerHeight );
const outlinePass = new OutlinePass( resolution, scene, camera );
composer.addPass( outlinePass );
```

## 导入

OutlinePass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
```

## 构造函数

### new OutlinePass( resolution : Vector2, scene : Scene, camera : Camera, selectedObjects : Array.<Object3D> )

构造一个新的描边通道。

**resolution**

效果的分辨率。

**scene**

要渲染的场景。

**camera**

相机。

**selectedObjects**

应接收描边的已选中 3D 对象。

## 属性

### .downSampleRatio : number

下采样比率。该效果可以以远低于美化通道的分辨率进行渲染。

默认值为 `2`。

### .edgeGlow : number

可用于实现动画发光/脉冲效果。

默认值为 `0`。

### .edgeStrength : number

边缘强度。

默认值为 `3`。

### .edgeThickness : number

边缘厚度。

默认值为 `1`。

### .hiddenEdgeColor : Color

隐藏边缘的颜色。

默认值为 `(0.1,0.04,0.02)`。

### .patternTexture : Texture

可用于高亮已选中的 3D 对象。需要将 [OutlinePass#usePatternTexture](OutlinePass.html#usePatternTexture) 设为 `true`。

默认值为 `null`。

### .pulsePeriod : number

脉冲周期。

默认值为 `0`。

### .renderCamera : Object

相机。

### .renderScene : Object

要渲染的场景。

### .resolution : Vector2

效果的分辨率。

默认值为 `(256,256)`。

### .selectedObjects : Array.<Object3D>

应接收描边的已选中 3D 对象。

### .usePatternTexture : boolean

是否使用图案纹理来高亮已选中的 3D 对象。

默认值为 `false`。

### .visibleEdgeColor : Color

可见边缘的颜色。

默认值为 `(1,1,1)`。

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

**重写：** [Pass#dispose](Pass.html#dispose)

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行描边通道。

**renderer**

渲染器。

**writeBuffer**

写入缓冲区。该缓冲区作为通道的渲染目标。

**readBuffer**

读取缓冲区。通道可从此缓冲区获取上一通道的渲染结果。

**deltaTime**

时间增量（秒）。

**maskActive**

遮罩是否处于激活状态。

**重写：** [Pass#render](Pass.html#render)

### .setSize( width : number, height : number )

设置通道的尺寸。

**width**

要设置的宽度。

**height**

要设置的高度。

**重写：** [Pass#setSize](Pass.html#setSize)

## 源码

[examples/jsm/postprocessing/OutlinePass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/OutlinePass.js)

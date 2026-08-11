*Inheritance: Pass →*

# RenderTransitionPass

一种用于实现转场效果的特殊渲染通道。激活时，该通道将从场景 A 过渡到场景 B。

## 代码示例

```js
const renderTransitionPass = new RenderTransitionPass( fxSceneA.scene, fxSceneA.camera, fxSceneB.scene, fxSceneB.camera );
renderTransitionPass.setTexture( textures[ 0 ] );
composer.addPass( renderTransitionPass );
```

## 导入

RenderTransitionPass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { RenderTransitionPass } from 'three/addons/postprocessing/RenderTransitionPass.js';
```

## 构造函数

### new RenderTransitionPass( sceneA : Scene, cameraA : Camera, sceneB : Scene, cameraB : Camera )

构造一个渲染转场通道。

**sceneA**

第一个场景。

**cameraA**

第一个场景的相机。

**sceneB**

第二个场景。

**cameraB**

第二个场景的相机。

## 属性

### .cameraA : Camera

第一个场景的相机。

### .cameraB : Camera

第二个场景的相机。

### .material : ShaderMaterial

通道材质。

### .sceneA : Scene

第一个场景。

### .sceneB : Scene

第二个场景。

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

**重写：** [Pass#dispose](Pass.html#dispose)

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行转场通道。

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

### .setTexture( value : Texture )

设置效果纹理。

**value**

效果纹理。

### .setTextureThreshold( value : boolean | number )

设置纹理阈值。该值定义纹理对转场效果的影响强度。必须在 `[0,1]` 范围内（0 表示完全生效，1 表示无效果）。

**value**

阈值。

### .setTransition( value : boolean | number )

设置转场因子。必须在 `[0,1]` 范围内。该值决定两个场景的混合程度。

**value**

转场因子。

### .useTexture( value : boolean )

切换是否对效果使用纹理。

**value**

是否对转场效果使用纹理。

## 源码

[examples/jsm/postprocessing/RenderTransitionPass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/RenderTransitionPass.js)

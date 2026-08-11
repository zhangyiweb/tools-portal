*Inheritance: Pass →*

# OutputPass

此通道负责在通道链中加入色调映射和色彩空间转换。在大多数情况下，应将其放在每条通道链的末尾。如果某个通道需要 sRGB 输入（例如 FXAA），则该通道必须跟在 `OutputPass` 之后。

色调映射和色彩空间设置从渲染器中提取。

## 代码示例

```js
const outputPass = new OutputPass();
composer.addPass( outputPass );
```

## 导入

OutputPass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
```

## 构造函数

### new OutputPass()

构造一个新的输出通道。

## 属性

### .isOutputPass : boolean (readonly)

此标志表示这是一个输出通道。

默认值为 `true`。

### .material : RawShaderMaterial

通道材质。

### .uniforms : Object

通道的 uniform 对象。

## 方法

### .dispose()

释放该实例分配的 GPU 相关资源。当应用中不再需要此通道时，应调用此方法。

**重写：** [Pass#dispose](Pass.html#dispose)

### .render( renderer : WebGLRenderer, writeBuffer : WebGLRenderTarget, readBuffer : WebGLRenderTarget, deltaTime : number, maskActive : boolean )

执行输出通道。

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

## 源码

[examples/jsm/postprocessing/OutputPass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/OutputPass.js)

*Inheritance: Pass → ShaderPass →*

# FXAAPass

用于应用 FXAA 的通道。

## 代码示例

```js
const fxaaPass = new FXAAPass();
composer.addPass( fxaaPass );
```

## 导入

FXAAPass 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
```

## 构造函数

### new FXAAPass()

构造一个新的 FXAA 通道。

## 方法

### .setSize( width : number, height : number )

设置通道的尺寸。

**width**

要设置的宽度。

**height**

要设置的高度。

**重写：** [ShaderPass#setSize](ShaderPass.html#setSize)

## 源码

[examples/jsm/postprocessing/FXAAPass.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/FXAAPass.js)

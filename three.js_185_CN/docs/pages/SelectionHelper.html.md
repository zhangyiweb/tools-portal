# SelectionHelper

[SelectionBox](SelectionBox.html) 的辅助对象。

使用 `div` 容器元素可视化当前选择框。

## 导入

SelectionHelper 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { SelectionHelper } from 'three/addons/interactive/SelectionHelper.js';
```

## 构造函数

### new SelectionHelper( renderer : WebGPURenderer | WebGLRenderer, cssClassName : string )

构造一个新的选择辅助对象。

**renderer**

渲染器。

**cssClassName**

`div` 的 CSS 类名。

## 属性

### .element : HTMLDivElement

选择框的可视化元素。

### .enabled : boolean

辅助对象是否启用。

默认值为 `true`。

### .isDown : boolean

鼠标或指针是否处于按下状态。

默认值为 `false`。

### .renderer : WebGPURenderer | WebGLRenderer

渲染器的引用。

## 方法

### .dispose()

若不再需要使用该控件，请调用此方法。它会释放所有内部资源并移除所有事件监听器。

## 源码

[examples/jsm/interactive/SelectionHelper.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/interactive/SelectionHelper.js)

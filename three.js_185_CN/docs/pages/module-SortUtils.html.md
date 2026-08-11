# SortUtils

## 导入

SortUtils 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import * as SortUtils from 'three/addons/utils/SortUtils.js';
```

## 静态方法

### .radixSort( arr : Array.<Object>, opt : Object )

混合基数排序，来源：

*   [https://gist.github.com/sciecode/93ed864dd77c5c8803c6a86698d68dab](https://gist.github.com/sciecode/93ed864dd77c5c8803c6a86698d68dab)
*   [https://github.com/mrdoob/three.js/pull/27202#issuecomment-1817640271](https://github.com/mrdoob/three.js/pull/27202#issuecomment-1817640271)

期望无符号 32 位整数值。

**arr**

要排序的数组。

**opt**

选项。

## 源码

[examples/jsm/utils/SortUtils.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/utils/SortUtils.js)

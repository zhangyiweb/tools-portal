# CameraUtils

## 导入

CameraUtils 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import * as CameraUtils from 'three/addons/utils/CameraUtils.js';
```

## 方法

### .frameCorners( camera : PerspectiveCamera, bottomLeftCorner : Vector3, bottomRightCorner : Vector3, topLeftCorner : Vector3, estimateViewFrustum : boolean ) (inner)

设置透视相机的投影矩阵和朝向，以精确框住任意矩形的四个角。注意：此函数会忽略标准参数；调用后请勿再调用 `updateProjectionMatrix()`。

**camera**

相机。

**bottomLeftCorner**

左下角点。

**bottomRightCorner**

右下角点。

**topLeftCorner**

左上角点。

**estimateViewFrustum**

若设为 `true`，该函数会尝试估算相机的 FOV。

默认值为 `false`。

## 源码

[examples/jsm/utils/CameraUtils.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/utils/CameraUtils.js)

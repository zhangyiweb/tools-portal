# WorkerPool

用于管理 Web Worker 的简单池。

## 导入

WorkerPool 是一个插件，必须显式导入，参见 [Installation#Addons](https://threejs.org/manual/#en/installation)。

```js
import { WorkerPool } from 'three/addons/utils/WorkerPool.js';
```

## 构造函数

### new WorkerPool( pool : number )

构造一个新的 Worker 池。

**pool**

池的大小。

默认值为 `4`。

## 类

[WorkerPool](WorkerPool.html)

## 属性

### .pool : number

池的大小。

默认值为 `4`。

### .queue : Array.<Object>

消息队列。

### .workerCreator : function

用于创建 Worker 的工厂函数。

### .workerStatus : number

当前 Worker 状态。

### .workers : Array.<Worker>

Worker 数组。

### .workersResolve : Array.<function()>

用于消息 resolve 函数的数组。

## 方法

### .dispose()

终止此池中所有 Worker。当应用中不再使用此 Worker 池时请调用此方法。

### .postMessage( msg : Object, transfer : Array.<ArrayBuffer> ) : Promise

向空闲 Worker 发送消息。如果没有可用的 Worker，消息会被推入消息队列以待后续处理。

**msg**

消息。

**transfer**

用于数据传输的 ArrayBuffer 数组。

**返回值：** 消息处理完成后 resolve 的 Promise。

### .setWorkerCreator( workerCreator : function )

设置负责创建 Worker 的函数。

**workerCreator**

Worker 创建函数。

### .setWorkerLimit( pool : number )

设置 Worker 上限。

**pool**

池的大小。

## 源码

[examples/jsm/utils/WorkerPool.js](https://github.com/mrdoob/three.js/blob/master/examples/jsm/utils/WorkerPool.js)
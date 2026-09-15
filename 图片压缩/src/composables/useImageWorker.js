import ImageWorker from "../compress.worker.js?worker";

let worker = null;
let seq = 0;
/** @type {Map<string, { resolve: Function, reject: Function }>} */
const pending = new Map();

function ensureWorker() {
  if (worker) return worker;
  worker = new ImageWorker();
  worker.onmessage = (event) => {
    const { id, ok, buffer, mime, ext, width, height, error } = event.data || {};
    const job = pending.get(id);
    if (!job) return;
    pending.delete(id);
    if (ok) {
      job.resolve({
        blob: new Blob([buffer], { type: mime }),
        mime,
        ext: ext || "jpg",
        width,
        height,
      });
    } else {
      job.reject(new Error(error || "处理失败"));
    }
  };
  worker.onerror = (event) => {
    for (const [, job] of pending) {
      job.reject(new Error(event.message || "Worker 异常"));
    }
    pending.clear();
  };
  return worker;
}

export function postJob(payload, transfer = []) {
  ensureWorker();
  return new Promise((resolve, reject) => {
    const id = `job-${++seq}-${Date.now()}`;
    pending.set(id, { resolve, reject });
    worker.postMessage({ ...payload, id }, transfer);
  });
}

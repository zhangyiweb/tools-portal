import ImageWorker from "../compress.worker.js?worker";

let worker = null;
let seq = 0;
/** @type {Map<string, { resolve: Function, reject: Function }>} */
const pending = new Map();

function ensureWorker() {
  if (worker) return worker;
  worker = new ImageWorker();
  worker.onmessage = (event) => {
    const data = event.data || {};
    const { id, ok, error } = data;
    const job = pending.get(id);
    if (!job) return;
    pending.delete(id);
    if (!ok) {
      job.reject(new Error(error || "处理失败"));
      return;
    }
    if (data.multi && Array.isArray(data.pieces)) {
      job.resolve({
        multi: true,
        pieces: data.pieces.map((p) => ({
          blob: new Blob([p.buffer], { type: p.mime }),
          mime: p.mime,
          ext: p.ext || "jpg",
          width: p.width,
          height: p.height,
          row: p.row,
          col: p.col,
        })),
        srcWidth: data.srcWidth,
        srcHeight: data.srcHeight,
        rows: data.rows,
        cols: data.cols,
      });
      return;
    }
    job.resolve({
      blob: new Blob([data.buffer], { type: data.mime }),
      mime: data.mime,
      ext: data.ext || "jpg",
      width: data.width,
      height: data.height,
    });
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

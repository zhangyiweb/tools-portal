import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export type TaskEvent =
  | { type: 'start'; message: string }
  | { type: 'log'; chunk: string }
  | { type: 'done'; code: number | null; message: string }
  | { type: 'error'; message: string };

export class TaskBus {
  private bus = new EventEmitter();
  private buffers = new Map<string, TaskEvent[]>();

  create(): string {
    const id = uuidv4();
    this.buffers.set(id, []);
    // 清理过期任务缓冲
    setTimeout(() => this.buffers.delete(id), 30 * 60 * 1000);
    return id;
  }

  emit(taskId: string, event: TaskEvent) {
    const buf = this.buffers.get(taskId);
    if (buf) buf.push(event);
    this.bus.emit(taskId, event);
  }

  subscribe(taskId: string, handler: (e: TaskEvent) => void): () => void {
    const buf = this.buffers.get(taskId) || [];
    for (const e of buf) handler(e);
    this.bus.on(taskId, handler);
    return () => this.bus.off(taskId, handler);
  }
}

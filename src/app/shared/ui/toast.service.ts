import { Injectable, signal } from '@angular/core';

export interface Toast { id: number; text: string; kind: 'ok' | 'error'; }

/** แจ้งเตือนมุมจอ เช่น "เพิ่มลูกค้าสำเร็จ" — เรียกจากหน้าไหนก็ได้: toast.success('...') */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  success(text: string): void { this.push(text, 'ok'); }
  error(text: string): void { this.push(text, 'error'); }

  private push(text: string, kind: Toast['kind']): void {
    const id = this.nextId++;
    this.toasts.update(list => [...list, { id, text, kind }]);
    setTimeout(() => this.toasts.update(list => list.filter(t => t.id !== id)), 4000);
  }
}

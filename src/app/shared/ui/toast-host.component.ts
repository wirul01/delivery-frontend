import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-host',
  template: `
    <div class="toasts" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class.err]="t.kind === 'error'" role="status">{{ t.text }}</div>
      }
    </div>
  `,
  styles: `
    .toasts { position: fixed; right: 16px; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); display: grid; gap: 8px; z-index: 80; max-width: min(380px, calc(100vw - 32px)); }
    .toast { background: var(--ink); color: var(--bg); padding: 11px 16px; border-radius: 10px; border-left: 5px solid var(--ok); }
    .toast.err { border-left-color: var(--danger); }
  `,
})
export class ToastHostComponent {
  toast = inject(ToastService);
}

import { Component, input, output } from '@angular/core';

/**
 * กล่องยืนยัน (ใช้ก่อนลบ) — ใช้แบบนี้:
 *   @if (toDelete()) {
 *     <app-confirm-dialog title="ลบลูกค้า" message="..." (confirmed)="doDelete()" (cancelled)="toDelete.set(null)" />
 *   }
 */
@Component({
  selector: 'app-confirm-dialog',
  template: `
    <div class="modal-backdrop" (click)="cancelled.emit()">
      <div class="modal" role="alertdialog" aria-modal="true" (click)="$event.stopPropagation()">
        <div class="modal-head"><h2>{{ title() }}</h2></div>
        <div class="modal-body"><p>{{ message() }}</p></div>
        <div class="modal-foot">
          <button class="btn" type="button" (click)="cancelled.emit()">ยกเลิก</button>
          <button class="btn" [class.btn-danger]="danger()" [class.solid]="danger()" [class.btn-primary]="!danger()" type="button" [disabled]="busy()" (click)="confirmed.emit()">
            {{ busy() ? 'กำลังทำงาน…' : confirmLabel() }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ConfirmDialogComponent {
  title = input.required<string>();
  message = input.required<string>();
  confirmLabel = input('ลบ');
  busy = input(false);
  danger = input(true); // false = ปุ่มยืนยันสีปกติ (ใช้กับการกระทำที่ไม่อันตราย)
  confirmed = output<void>();
  cancelled = output<void>();
}

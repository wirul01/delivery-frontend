import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { CustomerService } from './customer.service';
import { Customer, customerFullName } from './customer.model';
import { ToastService } from '../../../shared/ui/toast.service';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { apiErrorMessage } from '../../../core/utils/format';

type SearchBy = 'first_name' | 'last_name' | 'id';
type ViewMode = 'all' | 'search' | 'nearby';

@Component({
  selector: 'app-customers',
  imports: [FormsModule, ReactiveFormsModule, ConfirmDialogComponent],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.css',
})
export class CustomersComponent implements OnInit {
  private api = inject(CustomerService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  readonly fullName = customerFullName;

  // ---------- สถานะของหน้า (signal) ----------
  customers = signal<Customer[]>([]);
  loading = signal(true);
  loadError = signal('');
  mode = signal<ViewMode>('all');

  // ---------- ค้นหา ----------
  searchBy: SearchBy = 'first_name';
  searchText = '';

  // ---------- ค้นหาใกล้เคียง (ค่าเริ่มต้น = พิกัดร้านตามข้อมูลตัวอย่าง) ----------
  showNearby = signal(false);
  nearbyForm = this.fb.nonNullable.group({
    latitude: [16.185, [Validators.required, Validators.min(-90), Validators.max(90)]],
    longitude: [103.3, [Validators.required, Validators.min(-180), Validators.max(180)]],
    radius: [1, [Validators.required, Validators.min(0.1)]],
  });

  // ---------- ฟอร์มเพิ่ม/แก้ไข ----------
  formOpen = signal(false);
  editing = signal<Customer | null>(null); // null = กำลังเพิ่มใหม่
  saving = signal(false);
  formError = signal('');
  form = this.fb.nonNullable.group({
    first_name: ['', [Validators.required, Validators.maxLength(100)]],
    last_name: ['', [Validators.required, Validators.maxLength(100)]],
    phone_number: ['', [Validators.required, Validators.pattern(/^0\d{8,9}$/)]],
    latitude: [16.185, [Validators.required, Validators.min(-90), Validators.max(90)]],
    longitude: [103.3, [Validators.required, Validators.min(-180), Validators.max(180)]],
  });

  // ---------- ลบ ----------
  deleteTarget = signal<Customer | null>(null);
  deleting = signal(false);

  ngOnInit(): void { this.loadAll(); }

  // ============ โหลดข้อมูล ============
  private fetch(source$: Observable<Customer[]>): void {
    this.loading.set(true);
    this.loadError.set('');
    source$.subscribe({
      next: rows => { this.customers.set(rows); this.loading.set(false); },
      error: err => { this.loadError.set(apiErrorMessage(err, 'โหลดข้อมูลลูกค้าไม่สำเร็จ')); this.loading.set(false); },
    });
  }

  loadAll(): void {
    this.mode.set('all');
    this.searchText = '';
    this.fetch(this.api.getAll());
  }

  /** โหลดใหม่ตามโหมดที่ค้างอยู่ (ใช้หลังเพิ่ม/แก้ไข/ลบ เพื่อให้ผลค้นหายังอยู่) */
  private reload(): void {
    if (this.mode() === 'search') this.runSearch();
    else if (this.mode() === 'nearby') this.runNearby();
    else this.fetch(this.api.getAll());
  }

  // ============ ค้นหา ============
  runSearch(): void {
    const text = this.searchText.trim();
    if (!text) { this.loadAll(); return; }
    this.mode.set('search');
    this.fetch(this.api.search({ [this.searchBy]: text }));
  }

  runNearby(): void {
    if (this.nearbyForm.invalid) { this.nearbyForm.markAllAsTouched(); return; }
    const { latitude, longitude, radius } = this.nearbyForm.getRawValue();
    this.mode.set('nearby');
    this.fetch(this.api.nearby(latitude, longitude, radius));
  }

  // ============ เพิ่ม / แก้ไข ============
  openCreate(): void {
    this.editing.set(null);
    this.formError.set('');
    this.form.reset({ first_name: '', last_name: '', phone_number: '', latitude: 16.185, longitude: 103.3 });
    this.formOpen.set(true);
  }

  openEdit(c: Customer): void {
    this.editing.set(c);
    this.formError.set('');
    this.form.reset({
      first_name: c.first_name, last_name: c.last_name, phone_number: c.phone_number,
      latitude: c.latitude, longitude: c.longitude,
    });
    this.formOpen.set(true);
  }

  closeForm(): void { this.formOpen.set(false); }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    const target = this.editing();
    this.saving.set(true);
    this.formError.set('');

    (target ? this.api.update(target.buyer_id, value) : this.api.create(value)).subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.success(target ? 'แก้ไขข้อมูลลูกค้าแล้ว' : 'เพิ่มลูกค้าใหม่แล้ว');
        this.reload();
      },
      error: err => {
        this.saving.set(false);
        // 409 = เบอร์โทรซ้ำ (UNIQUE ในฐานข้อมูล)
        // POST เบอร์ซ้ำ backend ตอบ 409 ส่วน PATCH ยังไม่ดักกรณีนี้ จะตอบ 500 แบบไม่มีข้อความ จึงแนะนำให้ตรวจเบอร์
        this.formError.set(
          err.status === 409 ? 'เบอร์โทรนี้มีในระบบแล้ว'
          : err.status === 500 && this.editing() ? 'บันทึกไม่สำเร็จ (อาจเป็นเพราะเบอร์โทรซ้ำกับลูกค้าคนอื่น)'
          : apiErrorMessage(err, 'บันทึกไม่สำเร็จ'));
      },
    });
  }

  // ============ ลบ ============
  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;
    this.deleting.set(true);
    this.api.remove(target.buyer_id).subscribe({
      next: () => {
        this.deleting.set(false); this.deleteTarget.set(null);
        this.toast.success(`ลบ ${this.fullName(target)} แล้ว`);
        this.reload();
      },
      error: err => {
        this.deleting.set(false); this.deleteTarget.set(null);
        // ลูกค้าที่มีออเดอร์อยู่จะลบไม่ได้ (FK) — backend ส่งข้อความอธิบายมาให้
        this.toast.error(apiErrorMessage(err, 'ลบไม่สำเร็จ'));
      },
    });
  }

  mapLink(c: Customer): string {
    return `https://www.google.com/maps?q=${c.latitude},${c.longitude}`;
  }
}

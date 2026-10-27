import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { OrderService } from './order.service';
import { Order, orderCustomer, orderProfit, orderTotal } from './order.model';
import { CustomerService } from '../customers/customer.service';
import { Customer, customerFullName } from '../customers/customer.model';
import { CREATION_TYPE_LABEL, ORDER_STATUS_CLASS, ORDER_STATUS_LABEL, OrderStatus } from '../../../core/models/order-status';
import { ToastService } from '../../../shared/ui/toast.service';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { apiErrorMessage, thaiDate, todayStr } from '../../../core/utils/format';

type StatusFilter = 'ALL' | OrderStatus;

@Component({
  selector: 'app-orders',
  imports: [FormsModule, ReactiveFormsModule, ConfirmDialogComponent],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css',
})
export class OrdersComponent implements OnInit {
  private api = inject(OrderService);
  private customerApi = inject(CustomerService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  // ตัวช่วยให้ template เรียกใช้ได้
  readonly statusLabel = ORDER_STATUS_LABEL;
  readonly statusClass = ORDER_STATUS_CLASS;
  readonly creationLabel = CREATION_TYPE_LABEL;
  readonly customerName = orderCustomer;
  readonly total = orderTotal;
  readonly profit = orderProfit;
  readonly date = thaiDate;

  // ---------- ข้อมูล ----------
  orders = signal<Order[]>([]);
  loading = signal(true);
  loadError = signal('');
  nearbyActive = signal(false);

  // ---------- ตัวกรอง (กรองในเบราว์เซอร์) ----------
  query = signal('');
  statusFilter = signal<StatusFilter>('ALL');
  dateFilter = signal('');

  visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.orders().filter(o =>
      (this.statusFilter() === 'ALL' || o.order_status === this.statusFilter()) &&
      (!this.dateFilter() || o.target_date === this.dateFilter()) &&
      (!q || o.order_number.toLowerCase().includes(q) || this.customerName(o).toLowerCase().includes(q) || (o.phone_number ?? '').includes(q)));
  });

  /** สรุปจำนวนตามสถานะ (นับจากออเดอร์ทั้งหมดที่โหลดมา) */
  summary = computed(() => {
    const all = this.orders();
    const pick = (s: OrderStatus) => {
      const rows = all.filter(o => o.order_status === s);
      return { orders: rows.length, boxes: rows.reduce((n, o) => n + o.quantity, 0) };
    };
    return { all: { orders: all.length, boxes: all.reduce((n, o) => n + o.quantity, 0) }, QUEUED: pick('QUEUED'), SHIPPED: pick('SHIPPED') };
  });
  visibleRevenue = computed(() => this.visible().reduce((n, o) => n + orderTotal(o), 0));

  // ---------- ค้นหาใกล้เคียง ----------
  showNearby = signal(false);
  nearbyForm = this.fb.nonNullable.group({
    lat: [16.1841, [Validators.required, Validators.min(-90), Validators.max(90)]],
    lng: [103.3005, [Validators.required, Validators.min(-180), Validators.max(180)]],
    radiusKm: [2, [Validators.required, Validators.min(0.1)]],
  });

  // ---------- ฟอร์มสร้างออเดอร์ ----------
  formOpen = signal(false);
  saving = signal(false);
  formError = signal('');
  customers = signal<Customer[]>([]);
  readonly fullName = customerFullName;
  form = this.fb.nonNullable.group({
    order_number: ['', [Validators.required, Validators.maxLength(20)]],
    buyer_id: [0, [Validators.min(1)]],
    target_date: [todayStr(), Validators.required],
    quantity: [1, [Validators.required, Validators.min(1), Validators.max(3)]],
    selling_price: [65, [Validators.required, Validators.min(0)]],
    cost_price: [40, [Validators.required, Validators.min(0)]],
    delivery_latitude: [16.185, [Validators.required, Validators.min(-90), Validators.max(90)]],
    delivery_longitude: [103.3, [Validators.required, Validators.min(-180), Validators.max(180)]],
  });

  // ---------- แก้จำนวนกล่อง / ลบ / เครื่องมือทดสอบ ----------
  qtyTarget = signal<Order | null>(null);
  qtyValue = signal(1);
  qtySaving = signal(false);
  deleteTarget = signal<Order | null>(null);
  deleting = signal(false);
  bulk = signal<'seed' | 'clear' | null>(null);
  bulkBusy = signal(false);

  ngOnInit(): void { this.load(); }

  // ============ โหลด ============
  load(): void {
    this.nearbyActive.set(false);
    this.fetch(this.api.getAll());
  }

  private fetch(source$: Observable<Order[]>): void {
    this.loading.set(true);
    this.loadError.set('');
    source$.subscribe({
      next: rows => { this.orders.set(rows); this.loading.set(false); },
      error: err => { this.loadError.set(apiErrorMessage(err, 'โหลดออเดอร์ไม่สำเร็จ')); this.loading.set(false); },
    });
  }

  private reload(): void { this.nearbyActive() ? this.runNearby() : this.load(); }

  runNearby(): void {
    if (this.nearbyForm.invalid) { this.nearbyForm.markAllAsTouched(); return; }
    const { lat, lng, radiusKm } = this.nearbyForm.getRawValue();
    this.nearbyActive.set(true);
    this.fetch(this.api.getNearby(lat, lng, radiusKm));
  }

  clearFilters(): void {
    this.query.set(''); this.statusFilter.set('ALL'); this.dateFilter.set('');
    if (this.nearbyActive()) this.load();
  }

  // ============ สร้างออเดอร์ ============
  openCreate(): void {
    this.formError.set('');
    this.formOpen.set(true);
    // โหลดรายชื่อลูกค้า (GET /buyers) มาให้เลือกในฟอร์ม
    this.customerApi.getAll().subscribe({
      next: customers => {
        this.customers.set(customers);
        const nextNo = Math.max(0, ...this.orders().map(o => o.order_id)) + 1;
        this.form.reset({
          order_number: `TKT-${String(nextNo).padStart(3, '0')}`,
          buyer_id: 0, target_date: todayStr(), quantity: 1,
          selling_price: 65, cost_price: 40, // ค่าเริ่มต้นเท่า store_preferences ในฐานข้อมูล (แก้ได้)
          delivery_latitude: 16.185, delivery_longitude: 103.3,
        });
      },
      error: err => this.formError.set(apiErrorMessage(err, 'โหลดรายชื่อลูกค้าไม่สำเร็จ')),
    });
  }

  /** เลือกลูกค้า → เติมพิกัดจุดส่งของลูกค้าให้อัตโนมัติ (แก้ต่อได้) */
  onBuyerChange(): void {
    const c = this.customers().find(x => x.buyer_id === Number(this.form.controls.buyer_id.value));
    if (c) this.form.patchValue({ delivery_latitude: c.latitude, delivery_longitude: c.longitude });
  }

  setQuantity(q: number): void { this.form.controls.quantity.setValue(q); }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.formError.set('');
    this.api.create({
      order_number: v.order_number.trim(),
      buyer_id: Number(v.buyer_id),
      target_date: v.target_date,
      quantity: v.quantity,
      selling_price: v.selling_price,
      cost_price: v.cost_price,
      delivery_latitude: v.delivery_latitude,
      delivery_longitude: v.delivery_longitude,
      creation_type: 'MANUAL',
      order_status: 'QUEUED',
    }).subscribe({
      next: () => { this.saving.set(false); this.formOpen.set(false); this.toast.success('สร้างออเดอร์แล้ว'); this.reload(); },
      error: err => {
        this.saving.set(false);
        this.formError.set(err.status === 409 ? 'เลขออเดอร์นี้ถูกใช้แล้ว กรุณาเปลี่ยนเลขใหม่' : apiErrorMessage(err, 'สร้างออเดอร์ไม่สำเร็จ'));
      },
    });
  }

  // ============ แก้จำนวนกล่อง ============
  openQuantity(o: Order): void { this.qtyTarget.set(o); this.qtyValue.set(o.quantity); }

  saveQuantity(): void {
    const target = this.qtyTarget();
    if (!target) return;
    this.qtySaving.set(true);
    this.api.updateQuantity(target.order_id, this.qtyValue()).subscribe({
      next: () => { this.qtySaving.set(false); this.qtyTarget.set(null); this.toast.success('แก้จำนวนกล่องแล้ว'); this.reload(); },
      error: err => { this.qtySaving.set(false); this.toast.error(apiErrorMessage(err, 'แก้จำนวนกล่องไม่สำเร็จ')); },
    });
  }

  // ============ ลบ ============
  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;
    this.deleting.set(true);
    this.api.remove(target.order_id).subscribe({
      next: () => { this.deleting.set(false); this.deleteTarget.set(null); this.toast.success(`ลบออเดอร์ ${target.order_number} แล้ว`); this.reload(); },
      error: err => { this.deleting.set(false); this.deleteTarget.set(null); this.toast.error(apiErrorMessage(err, 'ลบไม่สำเร็จ')); },
    });
  }

  // ============ เครื่องมือทดสอบ: สุ่มออเดอร์ / ล้างทั้งหมด ============
  confirmBulk(): void {
    const action = this.bulk();
    if (!action) return;
    this.bulkBusy.set(true);
    (action === 'seed' ? this.api.seed() : this.api.clearAll()).subscribe({
      next: res => { this.bulkBusy.set(false); this.bulk.set(null); this.toast.success(res.message); this.reload(); },
      error: err => { this.bulkBusy.set(false); this.bulk.set(null); this.toast.error(apiErrorMessage(err, 'ทำรายการไม่สำเร็จ')); },
    });
  }
}

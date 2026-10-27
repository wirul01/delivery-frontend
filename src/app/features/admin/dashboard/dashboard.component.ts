import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { OrderService } from '../orders/order.service';
import { Order, orderCustomer, orderProfit, orderTotal } from '../orders/order.model';
import { CustomerService } from '../customers/customer.service';
import { Customer } from '../customers/customer.model';
import { ORDER_STATUS_CLASS, ORDER_STATUS_LABEL } from '../../../core/models/order-status';
import { AuthService } from '../../auth/auth.service';
import { thaiDate, todayStr } from '../../../core/utils/format';

interface TrayBox { shipped: boolean; }
const MAX_TRAY = 72; // แสดงกล่องในถาดไม่เกินนี้ ที่เหลือสรุปเป็น "+N"

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private orderApi = inject(OrderService);
  private customerApi = inject(CustomerService);
  readonly auth = inject(AuthService);

  readonly statusLabel = ORDER_STATUS_LABEL;
  readonly statusClass = ORDER_STATUS_CLASS;
  readonly customerName = orderCustomer;
  readonly total = orderTotal;
  readonly date = thaiDate;

  loading = signal(true);
  orders = signal<Order[]>([]);
  customers = signal<Customer[]>([]);
  ordersFailed = signal(false);
  selectedDate = signal(todayStr());

  // ---------- ข้อมูลของ "วันที่ที่เลือก" ----------
  dayOrders = computed(() => this.orders().filter(o => o.target_date === this.selectedDate()));
  queuedBoxes = computed(() => this.dayOrders().filter(o => o.order_status === 'QUEUED').reduce((n, o) => n + o.quantity, 0));
  shippedBoxes = computed(() => this.dayOrders().filter(o => o.order_status === 'SHIPPED').reduce((n, o) => n + o.quantity, 0));
  totalBoxes = computed(() => this.queuedBoxes() + this.shippedBoxes());
  revenue = computed(() => this.dayOrders().reduce((n, o) => n + orderTotal(o), 0));
  profit = computed(() => this.dayOrders().reduce((n, o) => n + orderProfit(o), 0));

  /** ถาดข้าวกล่อง: 1 ช่อง = 1 กล่อง (เขียว = ส่งแล้ว, ขอบส้ม = รอส่ง) */
  tray = computed<TrayBox[]>(() => {
    const boxes: TrayBox[] = [
      ...Array.from({ length: this.shippedBoxes() }, () => ({ shipped: true })),
      ...Array.from({ length: this.queuedBoxes() }, () => ({ shipped: false })),
    ];
    return boxes.slice(0, MAX_TRAY);
  });
  trayOverflow = computed(() => Math.max(0, this.totalBoxes() - MAX_TRAY));
  progressPct = computed(() => (this.totalBoxes() ? Math.round((this.shippedBoxes() / this.totalBoxes()) * 100) : 0));

  // ---------- ภาพรวมทั้งระบบ ----------
  latestOrders = computed(() => [...this.orders()].sort((a, b) => b.order_id - a.order_id).slice(0, 5));
  topCustomers = computed(() => {
    const map = new Map<number, { name: string; boxes: number; orders: number }>();
    for (const o of this.orders()) {
      const row = map.get(o.buyer_id) ?? { name: orderCustomer(o), boxes: 0, orders: 0 };
      row.boxes += o.quantity; row.orders += 1;
      map.set(o.buyer_id, row);
    }
    return [...map.values()].sort((a, b) => b.boxes - a.boxes).slice(0, 5);
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    // แต่ละ API ถ้าพังให้ได้ null แทน เพื่อให้ส่วนอื่นของแดชบอร์ดยังแสดงได้
    forkJoin({
      orders: this.orderApi.getAll().pipe(catchError(() => of(null))),
      customers: this.customerApi.getAll().pipe(catchError(() => of(null))),
    }).subscribe(({ orders, customers }) => {
      this.ordersFailed.set(orders === null);
      this.orders.set(orders ?? []);
      this.customers.set(customers ?? []);
      this.pickDefaultDate();
      this.loading.set(false);
    });
  }

  /** วันนี้ไม่มีออเดอร์ → เลื่อนไปวันล่าสุดที่มีออเดอร์ (เช่น ข้อมูลตัวอย่างเก่า) */
  private pickDefaultDate(): void {
    const today = todayStr();
    if (this.orders().some(o => o.target_date === today)) { this.selectedDate.set(today); return; }
    const latest = this.orders().map(o => o.target_date).sort().at(-1);
    this.selectedDate.set(latest ?? today);
  }

  isToday(): boolean { return this.selectedDate() === todayStr(); }
}

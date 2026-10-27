import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { CustomersComponent } from './customers/customers.component';
import { OrdersComponent } from './orders/orders.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ToastService } from '../../shared/ui/toast.service';

const API = environment.apiBaseUrl;
const buyer = (id: number, first: string) => ({
  buyer_id: id, first_name: first, last_name: 'ทดสอบ', phone_number: '08' + String(id).padStart(8, '0'),
  latitude: '16.1841000', longitude: '103.3005000',
});
const order = (id: number, status: 'QUEUED' | 'SHIPPED', qty: number, date = '2026-10-08T00:00:00.000Z') => ({
  order_id: id, order_number: `TKT-00${id}`, buyer_id: 1, target_date: date, quantity: qty, selling_price: '65.00', cost_price: '40.00',
  delivery_latitude: '16.1841000', delivery_longitude: '103.3005000', creation_type: 'MANUAL', order_status: status,
  created_at: '', updated_at: '', first_name: 'สมชาย', last_name: 'ใจดี', phone_number: '0812345678',
});
const rows = (f: ComponentFixture<unknown>) => (f.nativeElement as HTMLElement).querySelectorAll('tbody tr').length;

describe('หน้าเจ้าของร้านเมื่อต่อ backend จริง (จำลองคำตอบด้วย HttpTestingController)', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('ลูกค้า: แสดงรายการ, ลบลูกค้าที่มีออเดอร์ได้ข้อความจาก backend (400)', () => {
    const f = TestBed.createComponent(CustomersComponent);
    f.detectChanges();
    http.expectOne(`${API}/buyers`).flush([buyer(1, 'สมชาย'), buyer(2, 'สมหญิง')]);
    f.detectChanges();
    expect(rows(f)).toBe(2);

    const c = f.componentInstance;
    c.deleteTarget.set(c.customers()[0]);
    c.confirmDelete();
    http.expectOne(`${API}/buyers/1`).flush({ error: 'ไม่สามารถลบได้ เนื่องจากลูกค้าคนนี้มีข้อมูลเชื่อมอยู่กับตารางอื่น' }, { status: 400, statusText: 'Bad Request' });
    const toasts = TestBed.inject(ToastService).toasts();
    expect(toasts[0].kind).toBe('error');
    expect(toasts[0].text).toContain('ไม่สามารถลบได้');
  });

  it('ลูกค้า: เพิ่มเบอร์ซ้ำ (409) และแก้ไขแล้ว backend ตอบ 500 ได้ข้อความที่อ่านรู้เรื่อง', () => {
    const f = TestBed.createComponent(CustomersComponent);
    f.detectChanges();
    http.expectOne(`${API}/buyers`).flush([buyer(1, 'สมชาย')]);
    const c = f.componentInstance;

    c.openCreate();
    c.form.setValue({ first_name: 'ก', last_name: 'ข', phone_number: '0812345678', latitude: 16.1, longitude: 103.3 });
    c.save();
    http.expectOne(`${API}/buyers`).flush({ error: 'Phone number already exists' }, { status: 409, statusText: 'Conflict' });
    expect(c.formError()).toContain('เบอร์โทรนี้มีในระบบแล้ว');

    c.openEdit(c.customers()[0]);
    c.save();
    http.expectOne(`${API}/buyers/1`).flush('<html>error</html>', { status: 500, statusText: 'Server Error' });
    expect(c.formError()).toContain('เบอร์โทรซ้ำ');
  });

  it('ออเดอร์: แสดงสรุปสถานะ, สร้างออเดอร์ส่ง POST ถูกต้อง แล้วโหลดรายการใหม่', () => {
    const f = TestBed.createComponent(OrdersComponent);
    f.detectChanges();
    http.expectOne(`${API}/meal_orders`).flush([order(2, 'QUEUED', 2), order(1, 'SHIPPED', 1)]);
    f.detectChanges();
    const c = f.componentInstance;
    expect(rows(f)).toBe(2);
    expect(c.summary().QUEUED.boxes).toBe(2);
    expect(c.summary().SHIPPED.orders).toBe(1);

    c.openCreate();
    http.expectOne(`${API}/buyers`).flush([buyer(1, 'สมชาย')]);
    c.form.patchValue({ buyer_id: 1 });
    c.onBuyerChange();
    c.setQuantity(3);
    c.save();
    const post = http.expectOne(`${API}/meal_orders`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body.buyer_id).toBe(1);
    expect(post.request.body.quantity).toBe(3);
    expect(post.request.body.order_status).toBe('QUEUED');
    expect(post.request.body.delivery_latitude).toBeCloseTo(16.1841, 4);
    post.flush({ message: 'ok', order_id: 3 }, { status: 201, statusText: 'Created' });
    http.expectOne(`${API}/meal_orders`).flush([order(3, 'QUEUED', 3), order(2, 'QUEUED', 2), order(1, 'SHIPPED', 1)]);
    expect(c.orders().length).toBe(3);
  });

  it('ออเดอร์: เลขซ้ำ (409) ขึ้นข้อความ และเปลี่ยนจำนวนกล่องส่ง PATCH /:id/quantity', () => {
    const f = TestBed.createComponent(OrdersComponent);
    f.detectChanges();
    http.expectOne(`${API}/meal_orders`).flush([order(1, 'QUEUED', 1)]);
    const c = f.componentInstance;
    c.openCreate();
    http.expectOne(`${API}/buyers`).flush([buyer(1, 'สมชาย')]);
    c.form.patchValue({ buyer_id: 1, order_number: 'TKT-001' });
    c.save();
    http.expectOne(`${API}/meal_orders`).flush({ error: 'Order number already exists' }, { status: 409, statusText: 'Conflict' });
    expect(c.formError()).toContain('เลขออเดอร์นี้ถูกใช้แล้ว');
    c.formOpen.set(false);

    c.openQuantity(c.orders()[0]);
    c.qtyValue.set(2);
    c.saveQuantity();
    const patch = http.expectOne(`${API}/meal_orders/1/quantity`);
    expect(patch.request.body).toEqual({ quantity: 2 });
    patch.flush({ message: 'ok' });
    http.expectOne(`${API}/meal_orders`).flush([order(1, 'QUEUED', 2)]);
  });

  it('แดชบอร์ด: คำนวณกล่อง ยอดขาย กำไรของวันที่มีออเดอร์ล่าสุด (seed ของ backend ใช้วันที่ตายตัว)', () => {
    const f = TestBed.createComponent(DashboardComponent);
    f.detectChanges();
    http.expectOne(`${API}/meal_orders`).flush([order(2, 'QUEUED', 2), order(1, 'SHIPPED', 1), order(3, 'QUEUED', 1, '2026-10-07T00:00:00.000Z')]);
    http.expectOne(`${API}/buyers`).flush([buyer(1, 'สมชาย')]);
    f.detectChanges();
    const c = f.componentInstance;
    expect(c.selectedDate()).toBe('2026-10-08');
    expect(c.queuedBoxes()).toBe(2);
    expect(c.shippedBoxes()).toBe(1);
    expect(c.revenue()).toBe(195);
    expect(c.profit()).toBe(75);
  });
});

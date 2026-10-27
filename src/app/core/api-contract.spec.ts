import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { CustomerService } from '../features/admin/customers/customer.service';
import { OrderService } from '../features/admin/orders/order.service';
import { toOrder, orderTotal, orderProfit } from '../features/admin/orders/order.model';
import { AuthService } from '../features/auth/auth.service';

const API = environment.apiBaseUrl;

/** ทดสอบว่า "หน้าเว็บยิง API ตรงกับที่ backend เพื่อนเขียนไว้จริง" (ชื่อเส้นทาง / พารามิเตอร์ / body) */
describe('ข้อตกลง API กับ backend (ไม่มีเซิร์ฟเวอร์จำลอง)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('ลูกค้า: GET /buyers แล้วแปลงพิกัดข้อความเป็นตัวเลข', () => {
    let rows: any[] = [];
    TestBed.inject(CustomerService).getAll().subscribe(r => (rows = r));
    http.expectOne(`${API}/buyers`).flush([
      { buyer_id: 1, first_name: 'สมชาย', last_name: 'ใจดี', phone_number: '0812345678', latitude: '16.1841000', longitude: '103.3005000' },
    ]);
    expect(rows[0].latitude).toBe(16.1841);
    expect(typeof rows[0].longitude).toBe('number');
  });

  it('ลูกค้า: search ใช้ first_name / last_name / id และ nearby ใช้ latitude / longitude / radius', () => {
    const s = TestBed.inject(CustomerService);
    s.search({ first_name: 'สม' }).subscribe();
    const r1 = http.expectOne(r => r.url === `${API}/buyers/search`);
    expect(r1.request.params.get('first_name')).toBe('สม');
    r1.flush([]);

    s.nearby(16.1841, 103.3005, 2).subscribe();
    const r2 = http.expectOne(r => r.url === `${API}/buyers/nearby`);
    expect(r2.request.params.get('latitude')).toBe('16.1841');
    expect(r2.request.params.get('longitude')).toBe('103.3005');
    expect(r2.request.params.get('radius')).toBe('2');
    r2.flush([]);
  });

  it('ลูกค้า: POST / PATCH / DELETE ใช้เมธอดและเส้นทางตรงกับ backend', () => {
    const s = TestBed.inject(CustomerService);
    const body = { first_name: 'ก', last_name: 'ข', phone_number: '0800000000', latitude: 16.1, longitude: 103.3 };
    s.create(body).subscribe();
    const post = http.expectOne(`${API}/buyers`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(body);
    post.flush({ affected_row: 1, last_idx: 5 });

    s.update(5, { last_name: 'ค' }).subscribe();
    const patch = http.expectOne(`${API}/buyers/5`);
    expect(patch.request.method).toBe('PATCH');
    patch.flush({ affected_row: 1 });

    s.remove(5).subscribe();
    const del = http.expectOne(`${API}/buyers/5`);
    expect(del.request.method).toBe('DELETE');
    del.flush({ affected_row: 1 });
  });

  it('ออเดอร์: GET แปลง DECIMAL ข้อความเป็นตัวเลข วันที่เป็น yyyy-MM-dd และคำนวณยอด/กำไร', () => {
    let orders: any[] = [];
    TestBed.inject(OrderService).getAll().subscribe(r => (orders = r));
    http.expectOne(`${API}/meal_orders`).flush([{
      order_id: 1, order_number: 'TKT-001', buyer_id: 1, target_date: '2026-10-08T00:00:00.000Z', quantity: 2,
      selling_price: '65.00', cost_price: '40.00', delivery_latitude: '16.1841000', delivery_longitude: '103.3005000',
      creation_type: 'MANUAL', order_status: 'QUEUED', created_at: '', updated_at: '',
      first_name: 'สมชาย', last_name: 'ใจดี', phone_number: '0812345678',
    }]);
    expect(orders[0].target_date).toBe('2026-10-08');
    expect(orders[0].selling_price).toBe(65);
    expect(orderTotal(orders[0])).toBe(130);
    expect(orderProfit(orders[0])).toBe(50);
  });

  it('ออเดอร์: ค้นหาใกล้เคียงใช้ lat / lng / radiusKm', () => {
    TestBed.inject(OrderService).getNearby(16.1841, 103.3005, 2).subscribe();
    const r = http.expectOne(x => x.url === `${API}/meal_orders`);
    expect(r.request.params.get('lat')).toBe('16.1841');
    expect(r.request.params.get('lng')).toBe('103.3005');
    expect(r.request.params.get('radiusKm')).toBe('2');
    r.flush([]);
  });

  it('ออเดอร์: POST body มีฟิลด์ครบตามที่ backend INSERT, PATCH /:id/quantity, DELETE, seed, ล้างทั้งหมด', () => {
    const s = TestBed.inject(OrderService);
    const body = {
      order_number: 'TKT-010', buyer_id: 1, target_date: '2026-10-16', quantity: 2, selling_price: 65, cost_price: 40,
      delivery_latitude: 16.1841, delivery_longitude: 103.3005, creation_type: 'MANUAL' as const, order_status: 'QUEUED' as const,
    };
    s.create(body).subscribe();
    const post = http.expectOne(`${API}/meal_orders`);
    expect(post.request.method).toBe('POST');
    expect(Object.keys(post.request.body).sort()).toEqual(Object.keys(body).sort());
    post.flush({ message: 'ok', order_id: 9 });

    s.updateQuantity(9, 3).subscribe();
    const q = http.expectOne(`${API}/meal_orders/9/quantity`);
    expect(q.request.method).toBe('PATCH');
    expect(q.request.body).toEqual({ quantity: 3 });
    q.flush({ message: 'ok' });

    s.remove(9).subscribe();
    const delOne = http.expectOne(`${API}/meal_orders/9`);
    expect(delOne.request.method).toBe('DELETE');
    delOne.flush({ message: 'ok' });

    s.seed().subscribe();
    const seed = http.expectOne(`${API}/meal_orders/seed`);
    expect(seed.request.method).toBe('POST');
    seed.flush({ message: 'ok' });

    s.clearAll().subscribe();
    const clear = http.expectOne(`${API}/meal_orders`);
    expect(clear.request.method).toBe('DELETE');
    clear.flush({ message: 'ok' });
  });

  it('toOrder: วันที่แบบ ISO ไม่เพี้ยนวัน', () => {
    const o = toOrder({ target_date: '2026-10-08T00:00:00.000Z' } as any);
    expect(o.target_date).toBe('2026-10-08');
  });

  it('ล็อกอินทดลอง: รหัสถูกเข้าได้ รหัสผิดไม่ได้ และบทบาทถูกต้อง', () => {
    const auth = TestBed.inject(AuthService);
    expect(auth.login('OWNER', 'shop_owner', 'xxxx')).toBe(false);
    expect(auth.login('OWNER', 'rider01', '1234')).toBe(false);
    expect(auth.login('RIDER', 'rider01', '1234')).toBe(true);
    expect(auth.role()).toBe('RIDER');
    expect(auth.login('OWNER', 'shop_owner', '1234')).toBe(true);
    expect(auth.role()).toBe('OWNER');
  });
});

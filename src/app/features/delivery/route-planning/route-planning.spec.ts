import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { environment } from '../../../../environments/environment';
import { RoutePlanningComponent } from './route-planning.component';
import { RiderJobComponent } from '../rider-job/rider-job.component';
import { RoutePlanService } from './route-plan.service';
import { RoutingSessionDetail, RiderJob } from './route-plan.model';
import { ToastService } from '../../../shared/ui/toast.service';
import { todayStr } from '../../../core/utils/format';

const API = environment.apiBaseUrl;

const session = (over: Partial<RoutingSessionDetail['session']> = {}): RoutingSessionDetail['session'] => ({
  session_id: 7, session_date: todayStr(), session_status: 'DRAFT', optimization_goal: 'MIN_COST', iteration_number: 1,
  algorithm_name: 'GREEDY+LOCAL_SEARCH', total_orders: 3, total_meals: 5, total_couriers: 2, total_distance_meters: 4200,
  latest_delivery_time: '11:42:10', total_revenue: 325, total_meal_cost: 200, total_delivery_cost: 63.4, net_profit: 61.6,
  is_deadline_met: 1, processing_time_ms: 40, created_by_admin_id: 1, created_at: '', locked_at: null, ...over,
});
const node = (id: number, seq: number, qty: number) => ({
  order_id: id, order_number: `TKT-00${id}`, stop_sequence: seq, leg_distance_meters: 900, cumulative_distance_meters: 900 * seq,
  estimated_arrival_time: '11:35:00', delivered_at: null as string | null, quantity: qty, customer_name: `ลูกค้า ${id}`, phone_number: '0812345678', latitude: 16.18, longitude: 103.3,
});
const detail = (over: Partial<RoutingSessionDetail['session']> = {}, code: string | null = null): RoutingSessionDetail => ({
  session: session(over),
  store: { name: 'ร้านทดสอบ', latitude: 16.185, longitude: 103.3, dispatch_time: '11:30:00', delivery_deadline: '12:30:00', max_distance_km: 3 },
  trips: [
    { trip_id: 1, trip_number: 1, courier_id: null, route_color: '#E53935', trip_access_code: code, stop_count: 2, meal_count: 3, trip_distance_meters: 2400, estimated_duration_min: 8, completion_time: '11:38:00', delivery_wage: 39, nodes: [node(1, 1, 2), node(2, 2, 1)] },
    { trip_id: 2, trip_number: 2, courier_id: null, route_color: '#43A047', trip_access_code: code ? 'B2C3D4E5' : null, stop_count: 1, meal_count: 2, trip_distance_meters: 1800, estimated_duration_min: 5, completion_time: '11:36:00', delivery_wage: 24.4, nodes: [node(3, 1, 2)] },
  ],
  unassigned: [],
});
const text = (f: { nativeElement: unknown }) => (f.nativeElement as HTMLElement).textContent ?? '';

describe('API คำนวณเส้นทาง: หน้าเว็บยิงตรงกับ backend', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('เส้นทางและ body ของแต่ละคำสั่ง', () => {
    const s = TestBed.inject(RoutePlanService);
    s.calculate({ target_date: '2026-10-27', optimization_goal: 'MIN_TIME', max_couriers: 5 }).subscribe();
    const c = http.expectOne(`${API}/routing_sessions/calculate`);
    expect(c.request.method).toBe('POST');
    expect(c.request.body).toEqual({ target_date: '2026-10-27', optimization_goal: 'MIN_TIME', max_couriers: 5 });
    c.flush(detail());

    s.list('2026-10-27').subscribe();
    const l = http.expectOne(r => r.url === `${API}/routing_sessions`);
    expect(l.request.params.get('date')).toBe('2026-10-27');
    l.flush([]);

    s.get(7).subscribe(); http.expectOne(`${API}/routing_sessions/7`).flush(detail());
    s.lock(7).subscribe(); expect(http.expectOne(`${API}/routing_sessions/7/lock`).request.method).toBe('PATCH');
    s.void(7).subscribe(); expect(http.expectOne(`${API}/routing_sessions/7/void`).request.method).toBe('PATCH');
    s.markDelivered(' k7m2qx9a ', 2).subscribe();
    const dv = http.expectOne(`${API}/courier_trips/code/K7M2QX9A/stops/2/delivered`);
    expect(dv.request.method).toBe('PATCH'); expect(dv.request.body).toEqual({ delivered: true });
    dv.flush({});
    s.markDelivered('K7M2QX9A', 2, false).subscribe();
    const un = http.expectOne(`${API}/courier_trips/code/K7M2QX9A/stops/2/delivered`); expect(un.request.body).toEqual({ delivered: false }); un.flush({});
    s.jobByCode(' k7m2qx9a ').subscribe(); http.expectOne(`${API}/courier_trips/code/K7M2QX9A`).flush({});
  });
});

describe('หน้าวางเส้นทาง', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const listUrl = (r: { url: string }) => r.url === `${API}/routing_sessions`;

  it('ยังไม่เคยคำนวณ: แสดงข้อความว่าง แล้วกดคำนวณได้ผลสรุปและกำไร', () => {
    const f = TestBed.createComponent(RoutePlanningComponent);
    f.detectChanges();
    http.expectOne(listUrl).flush([]);
    f.detectChanges();
    expect(text(f)).toContain('ยังไม่มีผลคำนวณ');

    const c = f.componentInstance;
    c.goal.set('MIN_DISTANCE');
    c.onMaxRiders('4');
    c.calculate();
    const post = http.expectOne(`${API}/routing_sessions/calculate`);
    expect(post.request.body).toEqual({ target_date: todayStr(), optimization_goal: 'MIN_DISTANCE', max_couriers: 4 });
    post.flush(detail());
    http.expectOne(listUrl).flush([session()]);
    f.detectChanges();
    expect(text(f)).toContain('2 คน');
    expect(text(f)).toContain('61.60 ฿');
    expect(text(f)).toContain('ทันเวลา');
    expect(text(f)).toContain('รอบที่ 1');
  });

  it('ขาดทุน/ส่งไม่ทัน แสดงคำเตือนให้คำนวณใหม่', () => {
    const f = TestBed.createComponent(RoutePlanningComponent);
    f.detectChanges();
    http.expectOne(listUrl).flush([session({ net_profit: -20, is_deadline_met: 0 })]);
    http.expectOne(`${API}/routing_sessions/7`).flush(detail({ net_profit: -20, is_deadline_met: 0 }));
    f.detectChanges();
    expect(text(f)).toContain('ขาดทุน');
    expect(text(f)).toContain('เลยเวลา');
  });

  it('ยืนยันแผน: เรียก lock แล้วแสดงรหัสใบงาน และปิดปุ่มคำนวณใหม่', () => {
    const f = TestBed.createComponent(RoutePlanningComponent);
    f.detectChanges();
    http.expectOne(listUrl).flush([session()]);
    http.expectOne(`${API}/routing_sessions/7`).flush(detail());
    f.detectChanges();

    const c = f.componentInstance;
    c.confirming.set('lock');
    c.doConfirm();
    http.expectOne(`${API}/routing_sessions/7/lock`).flush(detail({ session_status: 'LOCKED' }, 'A1B2C3D4'));
    http.expectOne(listUrl).flush([session({ session_status: 'LOCKED' })]);
    f.detectChanges();
    expect(text(f)).toContain('A1B2C3D4');
    expect(c.isLocked()).toBe(true);
    expect(text(f)).toContain('ยกเลิกแผนนี้');
  });

  it('เซิร์ฟเวอร์เก่าไม่มี endpoint (404 ไม่มีข้อความ) บอกให้ deploy backend ชุดใหม่', () => {
    const f = TestBed.createComponent(RoutePlanningComponent);
    f.detectChanges();
    http.expectOne(listUrl).flush('<pre>Cannot GET /routing_sessions</pre>', { status: 404, statusText: 'Not Found' });
    f.componentInstance.calculate();
    http.expectOne(`${API}/routing_sessions/calculate`).flush('<pre>Cannot POST /routing_sessions/calculate</pre>', { status: 404, statusText: 'Not Found' });
    expect(f.componentInstance.error()).toContain('deploy backend ชุดใหม่');
  });

  it('คำนวณไม่ได้ (400) แสดงข้อความจาก backend', () => {
    const f = TestBed.createComponent(RoutePlanningComponent);
    f.detectChanges();
    http.expectOne(listUrl).flush([]);
    f.componentInstance.calculate();
    http.expectOne(`${API}/routing_sessions/calculate`).flush({ error: 'ไม่มีออเดอร์ที่รอส่ง (QUEUED) ของวันที่ 2026-10-27' }, { status: 400, statusText: 'Bad Request' });
    f.detectChanges();
    expect(f.componentInstance.error()).toContain('ไม่มีออเดอร์ที่รอส่ง');
    expect(TestBed.inject(ToastService).toasts()[0]?.kind).toBe('error');
  });
});

describe('หน้าใบงานไรเดอร์', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const job: RiderJob = {
    trip_number: 2, session_date: '2026-10-27', route_color: '#43A047', total_meals: 4, stop_count: 2, delivered_count: 0, dispatch_time: '11:30:00',
    delivery_deadline: '12:30:00', completion_time: '11:41:00', trip_distance_meters: 3100, delivery_wage: 39.8,
    store: { name: 'ร้านทดสอบ', latitude: 16.185, longitude: 103.3 }, summary: '', route_map_url: 'https://www.google.com/maps/dir/?api=1',
    stops: [
      { stop_sequence: 1, order_number: 'TKT-001', customer_name: 'สมชาย ใจดี', phone_number: '081-234-5678', quantity: 2, latitude: 16.18, longitude: 103.3, estimated_arrival_time: '11:34:00', delivered_at: null, map_url: 'https://www.google.com/maps/search/?api=1&query=16.18,103.3' },
      { stop_sequence: 2, order_number: 'TKT-002', customer_name: 'สมหญิง รักดี', phone_number: null, quantity: 2, latitude: 16.19, longitude: 103.31, estimated_arrival_time: '11:41:00', delivered_at: null, map_url: 'https://www.google.com/maps/search/?api=1&query=16.19,103.31' },
    ],
  };

  it('พิมพ์รหัสตัวเล็ก/มีช่องว่างได้ → แปลงเป็นตัวพิมพ์ใหญ่ แล้วแสดงจุดส่งตามลำดับ', () => {
    const f = TestBed.createComponent(RiderJobComponent);
    f.detectChanges();
    const c = f.componentInstance;
    c.onCode(' k7m2 qx9a ');
    expect(c.code()).toBe('K7M2QX9A');
    c.load();
    http.expectOne(`${API}/courier_trips/code/K7M2QX9A`).flush(job);
    f.detectChanges();
    const t = text(f);
    expect(t).toContain('ใบงานรอบที่ 2');
    expect(t).toContain('สมชาย ใจดี');
    expect(t.indexOf('สมชาย')).toBeLessThan(t.indexOf('สมหญิง'));
    expect(t).toContain('4');
    expect((f.nativeElement as HTMLElement).querySelectorAll('a[href^="tel:"]').length).toBe(1); // จุดที่ไม่มีเบอร์ ไม่มีปุ่มโทร
  });

  it('รหัสสั้นเกินไม่ยิง API / รหัสไม่มีจริง (404) ได้ข้อความเข้าใจง่าย', () => {
    const f = TestBed.createComponent(RiderJobComponent);
    f.detectChanges();
    const c = f.componentInstance;
    c.onCode('ABC');
    c.load();
    expect(c.error()).toContain('8 ตัว');
    c.onCode('ZZZZZZZZ');
    c.load();
    http.expectOne(`${API}/courier_trips/code/ZZZZZZZZ`).flush({ error: 'x' }, { status: 404, statusText: 'Not Found' });
    expect(c.error()).toContain('ไม่พบใบงานนี้');
    expect(c.job()).toBeNull();
  });

  it('ยืนยันว่าส่งแล้ว: กดปุ่ม → ขึ้นกล่องยืนยัน → ยืนยัน → ยิง PATCH แล้วหน้าอัปเดต, ส่งครบแล้วขึ้นข้อความขอบคุณ, กดผิดยกเลิกได้', () => {
    const f = TestBed.createComponent(RiderJobComponent);
    f.detectChanges();
    const c = f.componentInstance;
    c.onCode('K7M2QX9A'); c.load();
    http.expectOne(`${API}/courier_trips/code/K7M2QX9A`).flush(job);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelectorAll('button.deliver').length).toBe(2);
    expect(c.nextStop()?.stop_sequence).toBe(1);

    (el.querySelectorAll('button.deliver')[0] as HTMLButtonElement).click();
    f.detectChanges();
    expect(el.querySelector('app-confirm-dialog')).not.toBeNull();
    expect(text(f)).toContain('สมชาย ใจดี');
    // ยกเลิกในกล่องยืนยัน = ไม่ยิง API
    (el.querySelector('.modal-foot .btn') as HTMLButtonElement).click(); f.detectChanges();
    expect(el.querySelector('app-confirm-dialog')).toBeNull();
    http.expectNone(r => r.method === 'PATCH');

    (el.querySelectorAll('button.deliver')[0] as HTMLButtonElement).click(); f.detectChanges();
    (el.querySelector('.modal-foot .btn-primary') as HTMLButtonElement).click(); f.detectChanges();
    const r1 = http.expectOne(`${API}/courier_trips/code/K7M2QX9A/stops/1/delivered`);
    expect(r1.request.method).toBe('PATCH');
    const done1 = { ...job, delivered_count: 1, stops: [{ ...job.stops[0]!, delivered_at: '2026-10-27T05:10:00.000Z' }, job.stops[1]!] };
    r1.flush(done1); f.detectChanges();
    expect(c.deliveredCount()).toBe(1); expect(c.nextStop()?.stop_sequence).toBe(2);
    expect(text(f)).toContain('ส่งแล้วเมื่อ'); expect(el.querySelectorAll('button.deliver').length).toBe(1);
    expect(el.querySelector('app-confirm-dialog')).toBeNull();
    expect(c.allDone()).toBe(false);

    // จุดสุดท้าย -> ส่งครบ
    (el.querySelector('button.deliver') as HTMLButtonElement).click(); f.detectChanges();
    (el.querySelector('.modal-foot .btn-primary') as HTMLButtonElement).click(); f.detectChanges();
    const r2 = http.expectOne(`${API}/courier_trips/code/K7M2QX9A/stops/2/delivered`);
    r2.flush({ ...job, delivered_count: 2, stops: [done1.stops[0]!, { ...job.stops[1]!, delivered_at: '2026-10-27T05:20:00.000Z' }] }); f.detectChanges();
    expect(c.allDone()).toBe(true); expect(text(f)).toContain('ส่งครบทุกจุดแล้ว');
    expect(c.percent()).toBe(100);

    // กดผิด -> ยกเลิกการยืนยันจุดที่ 2
    c.undo(c.job()!.stops[1]!);
    const r3 = http.expectOne(`${API}/courier_trips/code/K7M2QX9A/stops/2/delivered`);
    expect(r3.request.body).toEqual({ delivered: false });
    r3.flush(done1); f.detectChanges();
    expect(c.allDone()).toBe(false); expect(c.deliveredCount()).toBe(1);
  });

  it('กดยืนยันแล้วใบงานถูกยกเลิก (404): ขึ้นข้อความบอก และไม่เปลี่ยนสถานะบนหน้าจอ', () => {
    const f = TestBed.createComponent(RiderJobComponent);
    f.detectChanges();
    const c = f.componentInstance;
    c.onCode('K7M2QX9A'); c.load();
    http.expectOne(`${API}/courier_trips/code/K7M2QX9A`).flush(job);
    c.confirmStop.set(job.stops[0]!); c.doDelivered();
    http.expectOne(`${API}/courier_trips/code/K7M2QX9A/stops/1/delivered`).flush({ error: 'x' }, { status: 404, statusText: 'Not Found' });
    expect(TestBed.inject(ToastService).toasts()[0]?.text).toContain('ถูกยกเลิกแล้ว');
    expect(c.deliveredCount()).toBe(0); expect(c.busy()).toBe(false); expect(c.confirmStop()).toBeNull();
  });
});

describe('หน้าวางเส้นทาง: ความคืบหน้าการส่ง', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('แผนที่ยืนยันแล้ว: แสดง ส่งแล้ว x/y และกดอัปเดตตอนนี้แล้วเห็นจุดที่ส่งเสร็จ', () => {
    const f = TestBed.createComponent(RoutePlanningComponent);
    f.detectChanges();
    http.expectOne(r => r.url === `${API}/routing_sessions`).flush([session({ session_status: 'LOCKED' })]);
    http.expectOne(`${API}/routing_sessions/7`).flush(detail({ session_status: 'LOCKED' }, 'A1B2C3D4'));
    f.detectChanges();
    expect(text(f)).toContain('ความคืบหน้าการส่ง: 0/3 จุด');
    expect(text(f)).toContain('ส่งแล้ว 0/2 จุด');

    const d2 = detail({ session_status: 'LOCKED' }, 'A1B2C3D4');
    d2.trips[1]!.nodes[0]!.delivered_at = '2026-10-27T05:10:00.000Z';
    d2.trips[0]!.nodes[0]!.delivered_at = '2026-10-27T05:12:00.000Z';
    f.componentInstance.refresh();
    http.expectOne(`${API}/routing_sessions/7`).flush(d2);
    f.detectChanges();
    expect(text(f)).toContain('ความคืบหน้าการส่ง: 2/3 จุด');
    expect(text(f)).toContain('✓ ส่งครบแล้ว'); // รอบ 2 มี 1 จุดและส่งแล้ว
    expect(text(f)).toContain('ส่งแล้ว 1/2 จุด');
  });

  it('แผนร่าง: ไม่แสดงความคืบหน้า', () => {
    const f = TestBed.createComponent(RoutePlanningComponent);
    f.detectChanges();
    http.expectOne(r => r.url === `${API}/routing_sessions`).flush([session()]);
    http.expectOne(`${API}/routing_sessions/7`).flush(detail());
    f.detectChanges();
    expect(text(f)).not.toContain('ความคืบหน้าการส่ง');
  });
});

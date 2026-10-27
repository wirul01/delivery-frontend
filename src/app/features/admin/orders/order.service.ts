import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { MessageResult } from '../../../core/models/api-result.model';
import { Order, OrderApi, OrderCreateBody, toOrder } from './order.model';

/**
 * เรียก API ออเดอร์ของ backend เพื่อน (ตาราง meal_orders) — ตรงกับเอกสาร API ข้อ 2.1–2.7
 *  GET    /meal_orders                              ออเดอร์ทั้งหมด (JOIN ชื่อลูกค้ามาให้แล้ว)
 *  GET    /meal_orders?lat=&lng=&radiusKm=          เฉพาะออเดอร์ในรัศมี (ค่าเริ่มต้น 2 กม.)
 *  POST   /meal_orders                              สร้างออเดอร์
 *  PATCH  /meal_orders/:id/quantity                 แก้จำนวนกล่อง (backend แก้ได้เฉพาะจำนวนกล่อง)
 *  DELETE /meal_orders/:id                          ลบ 1 ออเดอร์
 *  DELETE /meal_orders                              ล้างทั้งหมด
 *  POST   /meal_orders/seed                         สุ่มออเดอร์ตัวอย่าง 20–30 รายการ
 *
 * คนที่ 2 เรียก getAll() แล้ว filter order_status === 'QUEUED' เพื่อเลือกออเดอร์ที่พร้อมจัดส่งได้เลย
 */
@Injectable({ providedIn: 'root' })
export class OrderService {
  private http = inject(HttpClient);
  private url = `${environment.apiBaseUrl}/meal_orders`;

  getAll(): Observable<Order[]> {
    return this.http.get<OrderApi[]>(this.url).pipe(map(rows => rows.map(toOrder)));
  }

  getNearby(lat: number, lng: number, radiusKm: number): Observable<Order[]> {
    const params = new HttpParams().set('lat', lat).set('lng', lng).set('radiusKm', radiusKm);
    return this.http.get<OrderApi[]>(this.url, { params }).pipe(map(rows => rows.map(toOrder)));
  }

  create(body: OrderCreateBody): Observable<MessageResult> {
    return this.http.post<MessageResult>(this.url, body);
  }

  updateQuantity(id: number, quantity: number): Observable<MessageResult> {
    return this.http.patch<MessageResult>(`${this.url}/${id}/quantity`, { quantity });
  }

  remove(id: number): Observable<MessageResult> {
    return this.http.delete<MessageResult>(`${this.url}/${id}`);
  }

  clearAll(): Observable<MessageResult> {
    return this.http.delete<MessageResult>(this.url);
  }

  seed(): Observable<MessageResult> {
    return this.http.post<MessageResult>(`${this.url}/seed`, {});
  }
}

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CalculateBody, RiderJob, RoutingSession, RoutingSessionDetail } from './route-plan.model';

/**
 * เรียก API คำนวณเส้นทางของ backend
 *  POST  /routing_sessions/calculate       สั่งคำนวณ (ได้แผนแบบร่าง DRAFT) — คำนวณซ้ำได้ แผนร่างเก่าของวันเดียวกันจะถูกแทนที่
 *  GET   /routing_sessions?date=           ประวัติการคำนวณ (ใหม่สุดก่อน)
 *  GET   /routing_sessions/:id             ผลเต็ม: รอบ จุดส่ง สีเส้นทาง สรุปเงิน ออเดอร์ที่ไม่อยู่ในแผน
 *  PATCH /routing_sessions/:id/lock        ยืนยันแผน (ออกรหัสใบงาน, ออเดอร์เป็น SHIPPED)
 *  PATCH /routing_sessions/:id/void        ยกเลิกแผน (ถ้ายืนยันแล้ว ออเดอร์กลับเป็น QUEUED)
 *  GET   /courier_trips/code/:code         ใบงานไรเดอร์ (เปิดด้วยรหัส 8 ตัว ไม่ต้องล็อกอิน)
 *  PATCH /courier_trips/code/:code/stops/:seq/delivered   ไรเดอร์กดยืนยันว่าส่งจุดนี้แล้ว (delivered:false = ยกเลิกการยืนยัน) ตอบใบงานล่าสุด
 */
@Injectable({ providedIn: 'root' })
export class RoutePlanService {
  private http = inject(HttpClient);
  private sessionUrl = `${environment.apiBaseUrl}/routing_sessions`;
  private tripUrl = `${environment.apiBaseUrl}/courier_trips`;

  calculate(body: CalculateBody): Observable<RoutingSessionDetail> {
    return this.http.post<RoutingSessionDetail>(`${this.sessionUrl}/calculate`, body);
  }

  list(date?: string): Observable<RoutingSession[]> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return this.http.get<RoutingSession[]>(this.sessionUrl, { params });
  }

  get(id: number): Observable<RoutingSessionDetail> {
    return this.http.get<RoutingSessionDetail>(`${this.sessionUrl}/${id}`);
  }

  lock(id: number): Observable<RoutingSessionDetail> {
    return this.http.patch<RoutingSessionDetail>(`${this.sessionUrl}/${id}/lock`, {});
  }

  void(id: number): Observable<RoutingSessionDetail> {
    return this.http.patch<RoutingSessionDetail>(`${this.sessionUrl}/${id}/void`, {});
  }

  jobByCode(code: string): Observable<RiderJob> {
    return this.http.get<RiderJob>(`${this.tripUrl}/code/${encodeURIComponent(code.trim().toUpperCase())}`);
  }

  /** กดยืนยันว่าส่งจุดที่ seq แล้ว (delivered=false คือยกเลิกการยืนยันเมื่อกดผิด) */
  markDelivered(code: string, seq: number, delivered = true): Observable<RiderJob> {
    return this.http.patch<RiderJob>(
      `${this.tripUrl}/code/${encodeURIComponent(code.trim().toUpperCase())}/stops/${seq}/delivered`,
      { delivered },
    );
  }
}

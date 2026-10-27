import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { WriteResult } from '../../../core/models/api-result.model';
import { Customer, CustomerApi, CustomerForm, toCustomer } from './customer.model';

/**
 * เรียก API ลูกค้าของ backend เพื่อน (ตาราง buyers) — ชื่อเส้นทางตรงกับเอกสาร API ข้อ 1.1–1.8
 *  GET    /buyers                         ลูกค้าทั้งหมด
 *  GET    /buyers/search?id=&first_name=&last_name=   ค้นหา (ชื่อ/นามสกุลค้นแบบบางส่วนได้)
 *  GET    /buyers/nearby?latitude=&longitude=&radius=  ลูกค้าในรัศมี (กม.)
 *  POST   /buyers        เพิ่ม   |  PATCH /buyers/:id  แก้ไข   |  DELETE /buyers/:id  ลบ
 */
@Injectable({ providedIn: 'root' })
export class CustomerService {
  private http = inject(HttpClient);
  private url = `${environment.apiBaseUrl}/buyers`;

  getAll(): Observable<Customer[]> {
    return this.http.get<CustomerApi[]>(this.url).pipe(map(rows => rows.map(toCustomer)));
  }

  search(filter: { id?: string; first_name?: string; last_name?: string }): Observable<Customer[]> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filter)) {
      if (value) params = params.set(key, value);
    }
    return this.http.get<CustomerApi[]>(`${this.url}/search`, { params }).pipe(map(rows => rows.map(toCustomer)));
  }

  nearby(latitude: number, longitude: number, radiusKm: number): Observable<Customer[]> {
    const params = new HttpParams().set('latitude', latitude).set('longitude', longitude).set('radius', radiusKm);
    return this.http.get<CustomerApi[]>(`${this.url}/nearby`, { params }).pipe(map(rows => rows.map(toCustomer)));
  }

  create(form: CustomerForm): Observable<WriteResult> {
    return this.http.post<WriteResult>(this.url, form);
  }

  update(id: number, form: Partial<CustomerForm>): Observable<WriteResult> {
    return this.http.patch<WriteResult>(`${this.url}/${id}`, form);
  }

  remove(id: number): Observable<WriteResult> {
    return this.http.delete<WriteResult>(`${this.url}/${id}`);
  }
}

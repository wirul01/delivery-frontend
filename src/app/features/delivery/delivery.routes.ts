import { Routes } from '@angular/router';

// ฝั่งไรเดอร์ที่ล็อกอิน: มีหน้าเดียวคือใบงาน (กรอกรหัสใบงานเพื่อดูรอบวิ่งของตัวเอง)
// ไรเดอร์ที่ได้ลิงก์จากร้านเปิดที่ /job/<รหัส> ได้เลยโดยไม่ต้องล็อกอิน (ดู app.routes.ts)
export const DELIVERY_ROUTES: Routes = [
  {
    path: 'rider-job',
    title: 'ใบงานของฉัน',
    data: { embedded: true },
    loadComponent: () => import('./rider-job/rider-job.component').then(m => m.RiderJobComponent),
  },
  { path: '**', redirectTo: 'rider-job' },
];

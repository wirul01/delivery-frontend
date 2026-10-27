import { Routes } from '@angular/router';
import { AUTH_ROUTES } from './features/auth/auth.routes';
import { ADMIN_ROUTES } from './features/admin/admin.routes';
import { DELIVERY_ROUTES } from './features/delivery/delivery.routes';
import { authGuard, ownerGuard, riderGuard } from './features/auth/auth.guard';
import { ShellComponent } from './shared/layout/shell.component';

export const routes: Routes = [
  ...AUTH_ROUTES,
  // ใบงานไรเดอร์: เปิดได้โดยไม่ต้องล็อกอิน (ใช้รหัสใบงาน 8 ตัวแทน)
  { path: 'job', title: 'ใบงานไรเดอร์', loadComponent: () => import('./features/delivery/rider-job/rider-job.component').then(m => m.RiderJobComponent) },
  { path: 'job/:code', title: 'ใบงานไรเดอร์', loadComponent: () => import('./features/delivery/rider-job/rider-job.component').then(m => m.RiderJobComponent) },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: 'admin', canActivate: [ownerGuard], children: ADMIN_ROUTES },
      { path: 'delivery', canActivate: [riderGuard], children: DELIVERY_ROUTES },
      { path: '', pathMatch: 'full', redirectTo: 'admin/dashboard' },
    ],
  },
  { path: '**', redirectTo: '' },
];

import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  { path: 'dashboard', title: 'ภาพรวมร้าน', loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'customers', title: 'ลูกค้า', loadComponent: () => import('./customers/customers.component').then(m => m.CustomersComponent) },
  { path: 'orders', title: 'ออเดอร์', loadComponent: () => import('./orders/orders.component').then(m => m.OrdersComponent) },
  { path: 'route-planning', title: 'วางเส้นทาง', loadComponent: () => import('../delivery/route-planning/route-planning.component').then(m => m.RoutePlanningComponent) },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
];

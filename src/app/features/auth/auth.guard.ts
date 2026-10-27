import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** ยามหน้าประตู: ยังไม่ล็อกอิน → ไปหน้า /login */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login']);
};

/** หน้าเจ้าของร้าน (/admin): ต้องเป็น OWNER ถ้าเป็นไรเดอร์ส่งไปใบงานของตัวเอง */
export const ownerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);
  return auth.role() === 'OWNER' ? true : router.createUrlTree(['/delivery/rider-job']);
};

/** หน้าไรเดอร์ (/delivery): ต้องเป็น RIDER ถ้าเป็นเจ้าของร้านส่งกลับแดชบอร์ด */
export const riderGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);
  return auth.role() === 'RIDER' ? true : router.createUrlTree(['/admin/dashboard']);
};

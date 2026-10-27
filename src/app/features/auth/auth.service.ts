import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

export type PortalRole = 'OWNER' | 'RIDER';

export interface SessionUser {
  username: string;
  display_name: string;
  role: PortalRole;
}

/**
 * บัญชีทดลองที่ตรวจในหน้าเว็บ — backend ของเพื่อนยังไม่มี /auth/login จึงยังยืนยันตัวตนกับเซิร์ฟเวอร์ไม่ได้
 * ใช้เพื่อแยกหน้าตามบทบาทเท่านั้น (ไม่ใช่ความปลอดภัยจริง)
 * เมื่อเพื่อนทำ /auth/login แล้ว: แก้เมธอด login() ให้ POST ไปที่ backend แล้วเก็บ token แทน
 */
const DEMO_ACCOUNTS: Record<PortalRole, { username: string; password: string; display_name: string }> = {
  OWNER: { username: 'shop_owner', password: '1234', display_name: 'คุณเอก เจ้าของร้าน' },
  RIDER: { username: 'rider01', password: '1234', display_name: 'ณัฐพล ขยันส่ง' },
};

const STORAGE_KEY = 'delivery_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);

  // signal = ตัวแปรที่เมื่อค่าเปลี่ยน หน้าจอที่ใช้มันจะอัปเดตเองอัตโนมัติ
  private session = signal<SessionUser | null>(this.restore());

  readonly user = computed(() => this.session());
  readonly isLoggedIn = computed(() => !!this.session());
  /** บทบาทปัจจุบัน (ยังไม่ล็อกอินให้เป็น OWNER ไว้ก่อนเพื่อไม่ให้เมนูพัง) */
  readonly role = computed<PortalRole>(() => this.session()?.role ?? 'OWNER');

  /** ตรวจชื่อผู้ใช้/รหัสผ่านกับบัญชีทดลองของบทบาทที่เลือก — สำเร็จคืน true */
  login(role: PortalRole, username: string, password: string): boolean {
    const acc = DEMO_ACCOUNTS[role];
    if (username !== acc.username || password !== acc.password) return false;
    const user: SessionUser = { username: acc.username, display_name: acc.display_name, role };
    this.session.set(user);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(user)); } catch { /* บล็อกที่เก็บข้อมูล: ใช้ได้ต่อจนรีเฟรช */ }
    return true;
  }

  demoHint(role: PortalRole): string { return DEMO_ACCOUNTS[role].username; }

  logout(): void {
    this.session.set(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ข้ามได้ */ }
    this.router.navigate(['/login']);
  }

  private restore(): SessionUser | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SessionUser) : null;
    } catch {
      return null;
    }
  }
}

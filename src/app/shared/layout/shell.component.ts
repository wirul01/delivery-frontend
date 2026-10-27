import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../features/auth/auth.service';
import { ToastHostComponent } from '../ui/toast-host.component';

interface NavItem { path: string; label: string; }

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastHostComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  auth = inject(AuthService);
  menuOpen = signal(false);

  ownerNav: NavItem[] = [
    { path: '/admin/dashboard', label: 'ภาพรวมร้าน' },
    { path: '/admin/orders', label: 'ออเดอร์' },
    { path: '/admin/customers', label: 'ลูกค้า' },
    { path: '/admin/route-planning', label: 'วางเส้นทาง' },
  ];

  riderNav: NavItem[] = [
    { path: '/delivery/rider-job', label: 'ใบงานของฉัน' },
  ];

  closeMenu(): void { this.menuOpen.set(false); }
}

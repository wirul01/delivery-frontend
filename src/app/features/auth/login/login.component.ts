import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, PortalRole } from '../auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly boxes = Array.from({ length: 24 }, (_, i) => i + 1);
  selectedRole = signal<PortalRole>('OWNER');
  errorMsg = signal('');

  form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  constructor() {
    if (this.auth.isLoggedIn()) this.goToHome();
  }

  selectRole(role: PortalRole): void {
    this.selectedRole.set(role);
    this.errorMsg.set('');
    this.form.reset();
    this.fillDemo();
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const { username, password } = this.form.getRawValue();
    const role = this.selectedRole();
    // ตรวจกับบัญชีทดลองในหน้าเว็บ (backend ยังไม่มีระบบ login) ดูเหตุผลใน auth.service.ts
    if (this.auth.login(role, username.trim(), password)) {
      this.router.navigate([role === 'RIDER' ? '/delivery/rider-job' : '/admin/dashboard']);
    } else {
      this.errorMsg.set('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
  }

  fillDemo(): void {
    this.form.setValue({ username: this.auth.demoHint(this.selectedRole()), password: '1234' });
  }

  private goToHome(): void {
    this.router.navigate([this.auth.role() === 'RIDER' ? '/delivery/rider-job' : '/admin/dashboard']);
  }
}

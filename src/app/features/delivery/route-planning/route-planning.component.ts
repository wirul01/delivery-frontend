import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RoutePlanService } from './route-plan.service';
import {
  CourierTrip, GOAL_HINT, GOAL_LABEL, OptimizationGoal, RoutingSession, RoutingSessionDetail, STATUS_LABEL,
  baht, clock, hhmm, km,
} from './route-plan.model';
import { RouteMapComponent } from './route-map.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { ToastService } from '../../../shared/ui/toast.service';
import { apiErrorMessage, thaiDate, todayStr } from '../../../core/utils/format';

/**
 * หน้าวางเส้นทางจัดส่ง (เจ้าของร้าน)
 *  1) เลือกวันที่ + เป้าหมาย (+ จำกัดจำนวนไรเดอร์ได้) แล้วกด "คำนวณเส้นทาง" -> ได้แผนแบบร่าง
 *  2) ดูแผนที่ (แต่ละรอบคนละสี) + สรุปค่าใช้จ่าย/กำไร/เวลา — ไม่พอใจกดคำนวณใหม่ได้ (เปลี่ยนเป้าหมายได้)
 *  3) พอใจแล้วกด "ยืนยันแผน" -> ได้รหัสใบงาน 8 ตัวต่อรอบ ส่งให้ไรเดอร์ไปกรอกที่หน้า /job
 */
@Component({
  selector: 'app-route-planning',
  imports: [RouterLink, RouteMapComponent, ConfirmDialogComponent],
  templateUrl: './route-planning.component.html',
  styleUrl: './route-planning.component.css',
})
export class RoutePlanningComponent implements OnInit {
  private api = inject(RoutePlanService);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  // ตัวช่วยให้ template เรียกใช้
  readonly goals: OptimizationGoal[] = ['MIN_COST', 'MIN_DISTANCE', 'MIN_TIME'];
  readonly goalLabel = GOAL_LABEL;
  readonly goalHint = GOAL_HINT;
  readonly statusLabel = STATUS_LABEL;
  readonly baht = baht;
  readonly km = km;
  readonly hhmm = hhmm;
  readonly clock = clock;
  readonly thaiDate = thaiDate;

  // ---------- ค่าที่เจ้าของร้านเลือก ----------
  date = signal(todayStr());
  goal = signal<OptimizationGoal>('MIN_COST');
  maxRiders = signal<number | null>(null);

  // ---------- ข้อมูล ----------
  history = signal<RoutingSession[]>([]);
  detail = signal<RoutingSessionDetail | null>(null);
  selectedTrip = signal<number | null>(null);
  loading = signal(true);
  calculating = signal(false);
  busy = signal(false);
  error = signal('');
  confirming = signal<'lock' | 'void' | null>(null);

  session = computed(() => this.detail()?.session ?? null);
  isDraft = computed(() => this.session()?.session_status === 'DRAFT');
  isLocked = computed(() => this.session()?.session_status === 'LOCKED');
  isVoided = computed(() => this.session()?.session_status === 'VOIDED');
  lossMaking = computed(() => (this.session()?.net_profit ?? 0) < 0);

  /** ความคืบหน้าการส่งรวมทุกรอบ (นับจากที่ไรเดอร์กดยืนยันว่าส่งแล้ว) */
  deliveredStats = computed(() => {
    const trips = this.detail()?.trips ?? [];
    return {
      done: trips.reduce((s, t) => s + this.doneIn(t), 0),
      total: trips.reduce((s, t) => s + t.nodes.length, 0),
    };
  });
  refreshedAt = signal('');

  doneIn(t: CourierTrip): number {
    return t.nodes.filter(n => !!n.delivered_at).length;
  }

  ngOnInit(): void {
    this.loadHistory(true);
    // แผนที่ยืนยันแล้ว: ดึงความคืบหน้าล่าสุดทุก 30 วินาที (เฉพาะตอนเปิดหน้านี้ค้างไว้และมองเห็นอยู่)
    const timer = setInterval(() => {
      if (this.isLocked() && !document.hidden) this.refresh();
    }, 30000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  /** โหลดแผนที่เปิดอยู่ใหม่แบบเงียบ ๆ (ไม่แสดงหน้าโหลด) เพื่อดูว่าไรเดอร์ส่งไปกี่จุดแล้ว */
  refresh(): void {
    const id = this.session()?.session_id;
    if (id === undefined || this.busy() || this.calculating()) return;
    this.api.get(id).subscribe({
      next: d => {
        if (this.session()?.session_id !== id) return; // ระหว่างรอ เจ้าของร้านเปลี่ยนไปดูแผนอื่นแล้ว
        this.detail.set(d);
        this.refreshedAt.set(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }));
      },
      error: () => { /* ครั้งนี้ไม่ได้ก็ไม่เป็นไร รอบหน้าลองใหม่ */ },
    });
  }

  /** ข้อความ error ที่อ่านรู้เรื่อง: 404 แบบไม่มีข้อความจาก backend = เซิร์ฟเวอร์ที่เชื่อมอยู่ยังไม่มีระบบคำนวณเส้นทาง */
  private failText(err: any, fallback: string): string {
    const body = err?.error;
    const hasMessage = body && typeof body === 'object' && (body.error || body.message);
    if (err?.status === 404 && !hasMessage) {
      return 'เซิร์ฟเวอร์ที่เชื่อมอยู่ยังไม่มีระบบคำนวณเส้นทาง (ต้อง deploy backend ชุดใหม่ หรือแก้ apiBaseUrl ใน environment.ts ให้ชี้ไปที่ backend ใหม่)';
    }
    return apiErrorMessage(err, fallback);
  }

  // ---------- โหลดข้อมูล ----------
  /** โหลดประวัติของวันที่เลือก; pickLatest = เปิดแผนล่าสุดที่ยังใช้ได้ (ร่าง/ยืนยันแล้ว) ให้เลย */
  loadHistory(pickLatest: boolean): void {
    this.loading.set(true);
    this.error.set('');
    this.api.list(this.date()).subscribe({
      next: rows => {
        this.history.set(rows);
        const current = rows.find(r => r.session_status !== 'VOIDED');
        if (pickLatest && current) {
          this.open(current.session_id);
        } else {
          if (pickLatest) this.detail.set(null);
          this.loading.set(false);
        }
      },
      error: err => {
        this.error.set(this.failText(err, 'โหลดประวัติการคำนวณไม่สำเร็จ'));
        this.loading.set(false);
      },
    });
  }

  open(id: number): void {
    this.loading.set(true);
    this.api.get(id).subscribe({
      next: d => {
        this.detail.set(d);
        this.selectedTrip.set(null);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(this.failText(err, 'โหลดผลคำนวณไม่สำเร็จ'));
        this.loading.set(false);
      },
    });
  }

  onDateChange(value: string): void {
    this.date.set(value);
    if (value) this.loadHistory(true);
  }

  onMaxRiders(value: string): void {
    const n = parseInt(value, 10);
    this.maxRiders.set(Number.isFinite(n) && n > 0 ? n : null);
  }

  // ---------- คำนวณ ----------
  calculate(): void {
    if (this.calculating()) return;
    this.calculating.set(true);
    this.error.set('');
    const max = this.maxRiders();
    this.api.calculate({
      target_date: this.date(),
      optimization_goal: this.goal(),
      ...(max !== null ? { max_couriers: max } : {}),
    }).subscribe({
      next: d => {
        this.detail.set(d);
        this.selectedTrip.set(null);
        this.calculating.set(false);
        this.toast.success(`คำนวณเสร็จ: ใช้ไรเดอร์ ${d.session.total_couriers} คน`);
        this.loadHistory(false);
      },
      error: err => {
        this.calculating.set(false);
        const msg = this.failText(err, 'คำนวณไม่สำเร็จ');
        this.error.set(msg);
        this.toast.error(msg);
      },
    });
  }

  // ---------- ยืนยัน / ยกเลิก ----------
  doConfirm(): void {
    const id = this.session()?.session_id;
    const action = this.confirming();
    if (id === undefined || !action) return;
    this.busy.set(true);
    const call = action === 'lock' ? this.api.lock(id) : this.api.void(id);
    call.subscribe({
      next: d => {
        this.detail.set(d);
        this.busy.set(false);
        this.confirming.set(null);
        this.toast.success(action === 'lock' ? 'ยืนยันแผนแล้ว ส่งรหัสใบงานให้ไรเดอร์ได้เลย' : 'ยกเลิกแผนแล้ว ออเดอร์กลับไปรอจัดส่ง');
        this.loadHistory(false);
      },
      error: err => {
        this.busy.set(false);
        this.confirming.set(null);
        this.toast.error(this.failText(err, 'ทำรายการไม่สำเร็จ'));
        // เช่น 409 ออเดอร์เปลี่ยนไปหลังคำนวณ: โหลดสถานะล่าสุดมาแสดง
        this.loadHistory(false);
      },
    });
  }

  // ---------- เลือกรอบ / คัดลอกรหัส ----------
  toggleTrip(t: CourierTrip): void {
    this.selectedTrip.set(this.selectedTrip() === t.trip_number ? null : t.trip_number);
  }

  jobLink(code: string): string {
    return `${location.origin}/job/${code}`;
  }

  async copy(text: string, what: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success(`คัดลอก${what}แล้ว`);
    } catch {
      this.toast.error('คัดลอกไม่สำเร็จ ให้เลือกข้อความแล้วคัดลอกเอง');
    }
  }

  /** ข้อความช่วยตัดสินใจสั้น ๆ ใต้แผน */
  readonly confirmText = computed(() => {
    const s = this.session();
    if (this.confirming() === 'lock') {
      return `ยืนยันแผนครั้งที่ ${s?.iteration_number} ใช่ไหม? ระบบจะออกรหัสใบงานให้ไรเดอร์ ${s?.total_couriers} คน และเปลี่ยนออเดอร์ ${s?.total_orders} รายการเป็น "จัดส่งแล้ว"`;
    }
    return s?.session_status === 'LOCKED'
      ? 'ยกเลิกแผนที่ยืนยันแล้ว? รหัสใบงานจะใช้ไม่ได้ และออเดอร์จะกลับไปเป็น "รอจัดส่ง" เพื่อให้คำนวณใหม่ได้'
      : 'ยกเลิกแผนร่างนี้ใช่ไหม?';
  });
}

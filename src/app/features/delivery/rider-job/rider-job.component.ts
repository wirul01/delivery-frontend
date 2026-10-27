import { Component, ElementRef, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { RoutePlanService } from '../route-planning/route-plan.service';
import { RiderJob, RiderJobStop, baht, clock, hhmm, jobToMapData, km } from '../route-planning/route-plan.model';
import { RouteMapComponent } from '../route-planning/route-map.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { ToastService } from '../../../shared/ui/toast.service';
import { apiErrorMessage, thaiDate } from '../../../core/utils/format';

/**
 * หน้าใบงานไรเดอร์ (ดูผ่านมือถือ) — ไรเดอร์พิมพ์รหัสใบงาน 8 ตัวที่เจ้าของร้านส่งให้
 *  GET /courier_trips/code/:code
 * เปิดได้ 3 ทาง: /job (พิมพ์รหัสเอง), /job/ABCD2345 (ลิงก์ตรงที่เจ้าของร้านส่งให้) และ /delivery/rider-job (หลังล็อกอินไรเดอร์)
 * ไม่ต้องล็อกอิน เพราะรหัสใบงานเดาไม่ได้และใช้ได้เฉพาะแผนที่ยืนยันแล้ว
 *
 * ในหน้านี้ไรเดอร์ทำได้ครบโดยไม่ต้องออกจากเว็บ:
 *  - ดูแผนที่เส้นทางของรอบตัวเอง (กด "ดูบนแผนที่" ที่จุดไหนแผนที่ก็เลื่อนไปที่จุดนั้น, กด "แสดงตำแหน่งฉัน" เพื่อดูจุดสีฟ้าของตัวเอง)
 *  - ส่งเสร็จแต่ละจุดแล้วกด "ยืนยันว่าส่งแล้ว" -> PATCH /courier_trips/code/:code/stops/:seq/delivered (เจ้าของร้านเห็นความคืบหน้าทันที)
 */
@Component({
  selector: 'app-rider-job',
  imports: [RouteMapComponent, ConfirmDialogComponent],
  templateUrl: './rider-job.component.html',
  styleUrl: './rider-job.component.css',
})
export class RiderJobComponent implements OnInit, OnDestroy {
  private api = inject(RoutePlanService);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private toast = inject(ToastService);

  readonly baht = baht;
  readonly km = km;
  readonly hhmm = hhmm;
  readonly thaiDate = thaiDate;
  readonly clock = clock;

  /** true = เปิดอยู่ในโครงหน้าหลัก (มีเมนูของระบบอยู่แล้ว) ไม่ต้องแสดงหัวหน้าเว็บของตัวเอง */
  embedded = !!this.route.snapshot.data['embedded'];

  code = signal('');
  job = signal<RiderJob | null>(null);
  loading = signal(false);
  error = signal('');

  // ---------- แผนที่ / ความคืบหน้า ----------
  private mapCard = viewChild<ElementRef<HTMLElement>>('mapCard');
  mapData = computed(() => { const j = this.job(); return j ? jobToMapData(j) : null; });
  focus = signal<{ trip: number; seq: number } | null>(null);
  me = signal<{ lat: number; lng: number; accuracy?: number } | null>(null);
  locating = signal(false);
  locateError = signal('');
  private watchId: number | null = null;

  /** จุดที่ต้องไปต่อไป = จุดแรกที่ยังไม่กดยืนยัน */
  nextStop = computed(() => this.job()?.stops.find(s => !s.delivered_at) ?? null);
  allDone = computed(() => { const j = this.job(); return !!j && j.stops.length > 0 && j.stops.every(s => !!s.delivered_at); });
  deliveredCount = computed(() => this.job()?.stops.filter(s => !!s.delivered_at).length ?? 0);
  percent = computed(() => { const j = this.job(); return j && j.stops.length ? Math.round((this.deliveredCount() / j.stops.length) * 100) : 0; });

  // ---------- ยืนยันว่าส่งแล้ว ----------
  confirmStop = signal<RiderJobStop | null>(null);
  busy = signal(false);

  ngOnInit(): void {
    const fromUrl = this.route.snapshot.paramMap.get('code');
    if (fromUrl) {
      this.code.set(fromUrl.toUpperCase());
      this.load();
    }
  }

  onCode(value: string): void {
    // รหัสเป็นตัวพิมพ์ใหญ่และตัวเลข ไม่มีช่องว่าง
    this.code.set(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8));
  }

  load(): void {
    const code = this.code();
    if (code.length !== 8) {
      this.error.set('รหัสใบงานมี 8 ตัว กรุณาตรวจอีกครั้ง');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.api.jobByCode(code).subscribe({
      next: job => {
        this.job.set(job);
        this.loading.set(false);
        if (!this.embedded) this.location.replaceState(`/job/${code}`); // เปลี่ยนที่อยู่หน้าเป็นลิงก์ตรง (ไม่โหลดหน้าใหม่)
      },
      error: err => {
        this.job.set(null);
        this.loading.set(false);
        this.error.set(err?.status === 404 ? 'ไม่พบใบงานนี้ หรือแผนถูกยกเลิกแล้ว ให้ถามเจ้าของร้านอีกครั้ง' : apiErrorMessage(err, 'เปิดใบงานไม่สำเร็จ'));
      },
    });
  }

  ngOnDestroy(): void {
    this.stopLocate();
  }

  // ---------- แผนที่ ----------
  /** เลื่อนแผนที่ไปที่จุดส่ง (และเลื่อนหน้าจอขึ้นไปให้เห็นแผนที่) */
  showOnMap(s: RiderJobStop): void {
    const j = this.job();
    if (!j) return;
    this.focus.set({ trip: j.trip_number, seq: s.stop_sequence });
    this.mapCard()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** เปิด/ปิดการแสดงตำแหน่งของไรเดอร์บนแผนที่ (ต้องกดอนุญาตตำแหน่งในเบราว์เซอร์; ใช้ได้เฉพาะเว็บแบบ https หรือ localhost) */
  toggleLocate(): void {
    if (this.watchId !== null) {
      this.stopLocate();
      return;
    }
    if (!('geolocation' in navigator)) {
      this.locateError.set('เครื่องนี้ไม่รองรับการหาตำแหน่ง');
      return;
    }
    this.locating.set(true);
    this.locateError.set('');
    this.watchId = navigator.geolocation.watchPosition(
      pos => {
        this.me.set({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        this.locating.set(false);
      },
      err => {
        this.stopLocate();
        this.locateError.set(err.code === err.PERMISSION_DENIED
          ? 'ยังไม่ได้อนุญาตให้เว็บใช้ตำแหน่ง ให้เปิดการอนุญาตตำแหน่งของเบราว์เซอร์ แล้วกดอีกครั้ง'
          : 'หาตำแหน่งของคุณไม่เจอ ลองไปที่โล่งแล้วกดอีกครั้ง');
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
  }

  private stopLocate(): void {
    if (this.watchId !== null && 'geolocation' in navigator) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
    this.locating.set(false);
    this.me.set(null);
  }

  get locateOn(): boolean {
    return this.watchId !== null;
  }

  // ---------- ยืนยันว่าส่งแล้ว ----------
  doDelivered(): void {
    const s = this.confirmStop();
    if (!s) return;
    this.send(s, true, `บันทึกแล้ว: ส่งจุดที่ ${s.stop_sequence} เรียบร้อย`);
  }

  /** กดผิด: ยกเลิกการยืนยันของจุดนี้ */
  undo(s: RiderJobStop): void {
    this.send(s, false, `ยกเลิกการยืนยันจุดที่ ${s.stop_sequence} แล้ว`);
  }

  private send(s: RiderJobStop, delivered: boolean, okText: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.api.markDelivered(this.code(), s.stop_sequence, delivered).subscribe({
      next: job => {
        this.job.set(job); // ใบงานล่าสุดจากเซิร์ฟเวอร์
        this.busy.set(false);
        this.confirmStop.set(null);
        this.toast.success(okText);
      },
      error: err => {
        this.busy.set(false);
        this.confirmStop.set(null);
        this.toast.error(err?.status === 404
          ? 'ใบงานนี้ถูกยกเลิกแล้ว ให้ถามเจ้าของร้านอีกครั้ง'
          : apiErrorMessage(err, 'บันทึกไม่สำเร็จ ลองกดอีกครั้ง'));
      },
    });
  }

  /** กลับไปพิมพ์รหัสใหม่ */
  reset(): void {
    this.stopLocate();
    this.job.set(null);
    this.code.set('');
    this.error.set('');
    this.focus.set(null);
    if (!this.embedded) this.location.replaceState('/job');
  }

  telHref(phone: string): string {
    return `tel:${phone.replace(/[^0-9+]/g, '')}`;
  }
}

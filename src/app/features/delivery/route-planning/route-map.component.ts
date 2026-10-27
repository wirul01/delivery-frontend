import { Component, ElementRef, OnDestroy, effect, input, signal, untracked, viewChild, AfterViewInit } from '@angular/core';
import type * as Leaflet from 'leaflet';
import { MapData, clock, hhmm } from './route-plan.model';

/**
 * แผนที่แสดงร้าน + เส้นทางแต่ละรอบ (คนละสี) + ลำดับจุดส่ง + ออเดอร์ที่ไม่อยู่ในแผน
 * ใช้ Leaflet กับแผนที่ OpenStreetMap (ฟรี ไม่ต้องใช้ API key)
 *
 * วิธีใช้:  <app-route-map [detail]="detail()" [focusTrip]="selectedTrip()" [focusStop]="..." [myPosition]="..." />
 *  - detail     = ผลคำนวณจาก GET /routing_sessions/:id (หรือ jobToMapData(ใบงานไรเดอร์))
 *  - focusTrip  = trip_number ที่อยากเน้น (รอบอื่นจะจางลง) ไม่ใส่ = แสดงทุกรอบเท่ากัน
 *  - focusStop  = จุดส่งที่อยากให้แผนที่เลื่อนไปหาและเปิดป้ายข้อมูล (ส่งออบเจกต์ใหม่ทุกครั้งที่ต้องการให้เลื่อนอีก)
 *  - myPosition = ตำแหน่งของคนดูตอนนี้ (จุดสีฟ้า) ไม่ใส่ = ไม่แสดง
 * จุดที่ส่งแล้วจะเป็นสีเขียวมีเครื่องหมายถูก จุดที่ต้องไปต่อไปจะมีวงเรืองแสง
 * เส้นที่วาดเป็นเส้นตรงระหว่างจุด (ระบบคำนวณระยะแบบเส้นตรง x ตัวคูณทางถนนของร้าน ไม่ได้ใช้ถนนจริง)
 */
@Component({
  selector: 'app-route-map',
  template: `<div #host class="route-map" role="img" [attr.aria-label]="label()"></div>`,
  styles: `
    :host { display: block; }
    .route-map { height: 460px; width: 100%; border-radius: 10px; border: 1px solid var(--line); background: #e9efe8; z-index: 0; }
    @media (max-width: 640px) { .route-map { height: 340px; } }
  `,
})
export class RouteMapComponent implements AfterViewInit, OnDestroy {
  detail = input<MapData | null>(null);
  focusTrip = input<number | null>(null);
  focusStop = input<{ trip: number; seq: number } | null>(null);
  myPosition = input<{ lat: number; lng: number; accuracy?: number } | null>(null);

  private host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private L?: typeof Leaflet;
  private map?: Leaflet.Map;
  private layer?: Leaflet.LayerGroup;
  private meLayer?: Leaflet.LayerGroup;
  private markers = new Map<string, Leaflet.Marker>(); // key = "รอบ-ลำดับ"
  private ready = signal(false);
  private fitted: number | null = null; // session_id ที่ปรับมุมมองแผนที่ไปแล้ว (ไม่ให้แผนที่กระโดดทุกครั้งที่เลือกรอบ)

  label = () => {
    const d = this.detail();
    return d ? `แผนที่เส้นทาง ${d.trips.length} รอบ` : 'แผนที่ว่าง ยังไม่มีผลคำนวณ';
  };

  constructor() {
    effect(() => {
      const d = this.detail();
      const focus = this.focusTrip();
      if (!this.ready()) return;
      this.draw(d, focus);
    });
    effect(() => {
      const f = this.focusStop();
      if (!this.ready() || !f) return;
      untracked(() => this.goTo(f.trip, f.seq));
    });
    effect(() => {
      const p = this.myPosition();
      if (!this.ready()) return;
      this.drawMe(p);
    });
  }

  async ngAfterViewInit(): Promise<void> {
    try {
      const mod: any = await import('leaflet');
      this.L = (mod.default ?? mod) as typeof Leaflet;
      const L = this.L;
      this.map = L.map(this.host().nativeElement, { zoomControl: true, attributionControl: true }).setView([16.1841, 103.3005], 14);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(this.map);
      this.layer = L.layerGroup().addTo(this.map);
      this.meLayer = L.layerGroup().addTo(this.map);
      this.ready.set(true);
    } catch (e) {
      console.error('โหลดแผนที่ไม่สำเร็จ', e);
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  /** ป้ายวงกลมเลขลำดับ (วงขอบสีของรอบ ตัวเลขสีเข้ม อ่านง่ายบนแผนที่) */
  private pin(text: string, color: string, extra = ''): Leaflet.DivIcon {
    const L = this.L!;
    const el = document.createElement('span');
    el.className = `rm-pin ${extra}`.trim();
    el.style.borderColor = color;
    el.textContent = text;
    return L.divIcon({ html: el, className: 'rm-pin-wrap', iconSize: [30, 30], iconAnchor: [15, 15] });
  }

  private popup(lines: string[]): HTMLElement {
    const box = document.createElement('div');
    lines.forEach((t, i) => {
      const p = document.createElement(i === 0 ? 'strong' : 'div');
      p.textContent = t; // ใช้ textContent เพื่อไม่ให้ชื่อลูกค้าถูกตีความเป็น HTML
      box.appendChild(p);
    });
    return box;
  }

  /** เลื่อนแผนที่ไปที่จุดส่ง แล้วเปิดป้ายข้อมูล */
  private goTo(trip: number, seq: number): void {
    const m = this.markers.get(`${trip}-${seq}`);
    if (!m || !this.map) return;
    this.map.invalidateSize();
    this.map.setView(m.getLatLng(), Math.max(this.map.getZoom(), 16), { animate: true });
    m.openPopup();
  }

  /** จุดสีฟ้า = ตำแหน่งของคนดูตอนนี้ (วงจางรอบจุด = ความคลาดเคลื่อนของ GPS) */
  private drawMe(p: { lat: number; lng: number; accuracy?: number } | null): void {
    const L = this.L, layer = this.meLayer;
    if (!L || !layer) return;
    layer.clearLayers();
    if (!p) return;
    if (p.accuracy && p.accuracy < 500) {
      L.circle([p.lat, p.lng], { radius: p.accuracy, color: '#1e6fd9', weight: 1, fillOpacity: 0.1, interactive: false }).addTo(layer);
    }
    const dot = L.divIcon({ html: '<span class="rm-me"></span>', className: 'rm-pin-wrap', iconSize: [22, 22], iconAnchor: [11, 11] });
    L.marker([p.lat, p.lng], { icon: dot, title: 'ตำแหน่งของฉัน', zIndexOffset: 2000 }).bindPopup(this.popup(['คุณอยู่ที่นี่'])).addTo(layer);
  }

  private draw(d: MapData | null, focus: number | null): void {
    const L = this.L, map = this.map, layer = this.layer;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    this.markers.clear();
    if (!d) return;

    const store: Leaflet.LatLngTuple = [d.store.latitude, d.store.longitude];
    const bounds: Leaflet.LatLngTuple[] = [store];

    // วงระยะส่งสูงสุดของร้าน
    if (d.store.max_distance_km) {
      L.circle(store, { radius: d.store.max_distance_km * 1000, color: '#5a6b68', weight: 2, dashArray: '7 6', fill: false, interactive: false }).addTo(layer);
    }

    for (const trip of d.trips) {
      const dim = focus !== null && focus !== trip.trip_number;
      const pts: Leaflet.LatLngTuple[] = [store, ...trip.nodes.map(n => [n.latitude, n.longitude] as Leaflet.LatLngTuple)];
      // เส้นขาวรองใต้เส้นสี ให้เห็นชัดบนแผนที่
      L.polyline(pts, { color: '#ffffff', weight: dim ? 6 : 9, opacity: dim ? 0.35 : 0.9, interactive: false }).addTo(layer);
      L.polyline(pts, { color: trip.route_color, weight: dim ? 3 : 5, opacity: dim ? 0.4 : 1, interactive: false }).addTo(layer);
      pts.slice(1).forEach(p => bounds.push(p));

      const nextSeq = trip.nodes.find(n => !n.delivered_at)?.stop_sequence; // จุดที่ต้องไปต่อไป
      for (const n of trip.nodes) {
        const done = !!n.delivered_at;
        const cls = [dim ? 'rm-dim' : '', done ? 'rm-done' : '', !done && n.stop_sequence === nextSeq && !dim ? 'rm-next' : ''].filter(Boolean).join(' ');
        const m = L.marker([n.latitude, n.longitude], {
          icon: this.pin(done ? '✓' : String(n.stop_sequence), trip.route_color, cls),
          title: `รอบ ${trip.trip_number} จุดที่ ${n.stop_sequence}`,
          zIndexOffset: dim ? 0 : 500,
        });
        m.bindPopup(this.popup([
          `รอบ ${trip.trip_number} · จุดที่ ${n.stop_sequence}`,
          `${n.customer_name || '-'} (${n.order_number})`,
          `${n.quantity} กล่อง · ถึงประมาณ ${hhmm(n.estimated_arrival_time)}`,
          ...(done ? [`ส่งแล้วเมื่อ ${clock(n.delivered_at)} น.`] : []),
        ]));
        m.addTo(layer);
        this.markers.set(`${trip.trip_number}-${n.stop_sequence}`, m);
      }
    }

    for (const u of d.unassigned) {
      const m = L.marker([u.latitude, u.longitude], { icon: this.pin('!', '#5a6b68', 'rm-off'), title: `${u.order_number} ไม่อยู่ในแผน` });
      m.bindPopup(this.popup([`${u.order_number} ไม่อยู่ในแผน`, `${u.quantity} กล่อง`, u.reason]));
      m.addTo(layer); // ไม่นับรวมตอนปรับมุมมอง เพราะออเดอร์ที่ไกลเกินจะทำให้แผนที่ซูมออกจนเส้นทางเล็กมาก
    }

    const storeIcon = L.divIcon({ html: '<span class="rm-store">ร้าน</span>', className: 'rm-pin-wrap', iconSize: [44, 28], iconAnchor: [22, 14] });
    L.marker(store, { icon: storeIcon, title: d.store.name, zIndexOffset: 1000 }).bindPopup(this.popup([d.store.name])).addTo(layer);

    // ปรับมุมมองครั้งเดียวต่อผลคำนวณ 1 ชุด
    if (this.fitted !== d.session.session_id) {
      this.fitted = d.session.session_id;
      map.invalidateSize();
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 16 });
    }
  }
}

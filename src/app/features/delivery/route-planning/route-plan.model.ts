// ชนิดข้อมูลของ API คำนวณเส้นทาง (backend: /routing_sessions และ /courier_trips)
// หน้าเว็บใช้ชื่อฟิลด์ตรงกับที่ backend ตอบกลับ ตัวเลขทั้งหมดเป็น number อยู่แล้ว (backend แปลงมาให้)

export type OptimizationGoal = 'MIN_COST' | 'MIN_DISTANCE' | 'MIN_TIME';
export type SessionStatus = 'DRAFT' | 'LOCKED' | 'VOIDED';

export const GOAL_LABEL: Record<OptimizationGoal, string> = {
  MIN_COST: 'ต้นทุนต่ำสุด',
  MIN_DISTANCE: 'ระยะทางรวมสั้นสุด',
  MIN_TIME: 'ส่งเสร็จเร็วสุด',
};

export const GOAL_HINT: Record<OptimizationGoal, string> = {
  MIN_COST: 'จ่ายค่าส่งรวมน้อยที่สุด (เหมาะเป็นค่าเริ่มต้น)',
  MIN_DISTANCE: 'วิ่งรวมกันน้อยที่สุด ประหยัดน้ำมัน',
  MIN_TIME: 'ลูกค้าได้ของเร็วที่สุด แต่มักใช้ไรเดอร์เยอะและค่าส่งแพงขึ้น',
};

export const STATUS_LABEL: Record<SessionStatus, string> = {
  DRAFT: 'แบบร่าง (ยังไม่ยืนยัน)',
  LOCKED: 'ยืนยันแล้ว',
  VOIDED: 'ยกเลิก / ถูกแทนที่',
};

/** 1 แถวของประวัติการคำนวณ */
export interface RoutingSession {
  session_id: number;
  session_date: string; // yyyy-MM-dd
  session_status: SessionStatus;
  optimization_goal: OptimizationGoal;
  iteration_number: number; // คำนวณครั้งที่เท่าไรของวันนั้น
  algorithm_name: string;
  total_orders: number;
  total_meals: number;
  total_couriers: number; // จำนวนรอบ = จำนวนไรเดอร์ที่ต้องใช้
  total_distance_meters: number;
  latest_delivery_time: string; // HH:MM:SS เวลาที่ส่งเสร็จช้าสุด
  total_revenue: number;
  total_meal_cost: number;
  total_delivery_cost: number;
  net_profit: number;
  is_deadline_met: number; // 1 = ส่งทันทุกรอบ
  processing_time_ms: number | null;
  created_by_admin_id: number;
  created_at: string;
  locked_at: string | null;
}

export interface TripNode {
  order_id: number;
  order_number: string;
  stop_sequence: number;
  leg_distance_meters: number;
  cumulative_distance_meters: number;
  estimated_arrival_time: string;
  delivered_at: string | null; // เวลาที่ไรเดอร์กดยืนยันว่าส่งแล้ว (ISO) ยังไม่ส่ง = null
  quantity: number;
  customer_name: string;
  phone_number: string | null;
  latitude: number;
  longitude: number;
}

/** 1 รอบวิ่ง = ไรเดอร์ 1 คน (1–3 จุดส่ง) */
export interface CourierTrip {
  trip_id: number;
  trip_number: number;
  courier_id: number | null;
  route_color: string; // เช่น #E53935
  trip_access_code: string | null; // มีหลังยืนยันแผน
  stop_count: number;
  meal_count: number;
  trip_distance_meters: number;
  estimated_duration_min: number;
  completion_time: string;
  delivery_wage: number;
  nodes: TripNode[];
}

export interface UnassignedOrder {
  order_id: number;
  order_number: string;
  quantity: number;
  latitude: number;
  longitude: number;
  reason: string;
}

export interface RoutingSessionDetail {
  session: RoutingSession;
  store: {
    name: string;
    latitude: number;
    longitude: number;
    dispatch_time: string;
    delivery_deadline: string;
    max_distance_km: number;
  };
  trips: CourierTrip[];
  unassigned: UnassignedOrder[];
}

/** body ของ POST /routing_sessions/calculate (ไม่ส่งอะไรเลยก็ได้) */
export interface CalculateBody {
  target_date?: string;
  optimization_goal?: OptimizationGoal;
  max_couriers?: number;
}

// ---------- ใบงานไรเดอร์ (GET /courier_trips/code/:code) ----------
export interface RiderJobStop {
  stop_sequence: number;
  order_number: string;
  customer_name: string;
  phone_number: string | null;
  quantity: number;
  latitude: number;
  longitude: number;
  estimated_arrival_time: string;
  delivered_at: string | null; // เวลาที่กดยืนยันว่าส่งแล้ว (ISO) ยังไม่ส่ง = null
  map_url: string;
}

export interface RiderJob {
  trip_number: number;
  session_date: string;
  route_color: string;
  total_meals: number;
  stop_count: number;
  delivered_count: number; // ส่งเสร็จแล้วกี่จุด
  dispatch_time: string;
  delivery_deadline: string;
  completion_time: string;
  trip_distance_meters: number;
  delivery_wage: number;
  store: { name: string; latitude: number; longitude: number };
  summary: string;
  route_map_url: string;
  stops: RiderJobStop[];
}

// ---------- ข้อมูลที่แผนที่ต้องใช้ (ใช้ได้ทั้งผลคำนวณของเจ้าของร้านและใบงานของไรเดอร์) ----------
export interface MapNode {
  stop_sequence: number;
  order_number: string;
  customer_name: string;
  quantity: number;
  estimated_arrival_time: string;
  delivered_at: string | null;
  latitude: number;
  longitude: number;
}

export interface MapTrip {
  trip_number: number;
  route_color: string;
  nodes: MapNode[];
}

export interface MapData {
  session: { session_id: number }; // ใช้แยกว่าเป็นผลคำนวณชุดไหน (ปรับมุมมองแผนที่ครั้งเดียวต่อชุด)
  store: { name: string; latitude: number; longitude: number; max_distance_km?: number };
  trips: MapTrip[];
  unassigned: UnassignedOrder[];
}

/** แปลงใบงานไรเดอร์เป็นข้อมูลให้แผนที่วาด (1 รอบ) */
export function jobToMapData(job: RiderJob): MapData {
  return {
    session: { session_id: 0 },
    store: job.store,
    trips: [{
      trip_number: job.trip_number,
      route_color: job.route_color,
      nodes: job.stops.map(s => ({
        stop_sequence: s.stop_sequence, order_number: s.order_number, customer_name: s.customer_name, quantity: s.quantity,
        estimated_arrival_time: s.estimated_arrival_time, delivered_at: s.delivered_at, latitude: s.latitude, longitude: s.longitude,
      })),
    }],
    unassigned: [],
  };
}

// ---------- ตัวช่วยแสดงผล ----------
/** "2026-10-27T05:12:00.000Z" -> "12:12" (เวลาท้องถิ่นของเครื่องที่เปิดดู) */
export function clock(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** "11:42:27" -> "11:42" */
export function hhmm(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : '-';
}

/** เมตร -> "2.4 กม." */
export function km(meters: number): string {
  return `${(meters / 1000).toFixed(1)} กม.`;
}

/** 1234.5 -> "1,234.50" */
export function baht(n: number): string {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

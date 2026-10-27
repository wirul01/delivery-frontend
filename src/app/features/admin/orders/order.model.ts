import { CreationType, OrderStatus } from '../../../core/models/order-status';
import { toDateInput, toNum } from '../../../core/utils/format';

/** หน้าตาข้อมูลที่ backend ส่งมาจริง (meal_orders JOIN buyers) — ตัวเลขทศนิยมเป็นข้อความ */
export interface OrderApi {
  order_id: number;
  order_number: string;
  buyer_id: number;
  target_date: string;           // "2026-10-08T00:00:00.000Z"
  quantity: number;
  selling_price: string | number;
  cost_price: string | number;
  delivery_latitude: string | number;
  delivery_longitude: string | number;
  creation_type: CreationType;
  order_status: OrderStatus;
  created_at: string;
  updated_at: string;
  first_name: string | null;     // มาจากการ JOIN ตาราง buyers
  last_name: string | null;
  phone_number: string | null;
  distance_km?: number;          // มีเฉพาะตอนค้นหาด้วย lat/lng/radiusKm
}

/** ข้อมูลออเดอร์ที่ใช้ในหน้าเว็บ (แปลงเป็นตัวเลข และวันที่เป็น yyyy-MM-dd แล้ว) */
export interface Order {
  order_id: number;
  order_number: string;
  buyer_id: number;
  target_date: string;           // yyyy-MM-dd
  quantity: number;
  selling_price: number;
  cost_price: number;
  delivery_latitude: number;
  delivery_longitude: number;
  creation_type: CreationType;
  order_status: OrderStatus;
  created_at: string;
  updated_at: string;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  distance_km?: number;
}

/** ข้อมูลที่ส่งไปตอนสร้างออเดอร์ใหม่ (POST /meal_orders) ตามเอกสาร API ข้อ 2.2 */
export interface OrderCreateBody {
  order_number: string;
  buyer_id: number;
  target_date: string;           // yyyy-MM-dd
  quantity: number;              // 1–3 (ฐานข้อมูลมี CHECK quantity BETWEEN 1 AND 3)
  selling_price: number;
  cost_price: number;
  delivery_latitude: number;
  delivery_longitude: number;
  creation_type?: CreationType;
  order_status?: OrderStatus;
}

export function toOrder(row: OrderApi): Order {
  return {
    ...row,
    target_date: toDateInput(row.target_date),
    selling_price: toNum(row.selling_price),
    cost_price: toNum(row.cost_price),
    delivery_latitude: toNum(row.delivery_latitude),
    delivery_longitude: toNum(row.delivery_longitude),
  };
}

/** ยอดขายของออเดอร์ = จำนวนกล่อง × ราคาขาย */
export const orderTotal = (o: Pick<Order, 'quantity' | 'selling_price'>) => o.quantity * o.selling_price;
/** กำไรก่อนหักค่าส่ง = จำนวนกล่อง × (ราคาขาย − ต้นทุน) */
export const orderProfit = (o: Pick<Order, 'quantity' | 'selling_price' | 'cost_price'>) => o.quantity * (o.selling_price - o.cost_price);
export const orderCustomer = (o: Pick<Order, 'first_name' | 'last_name'>) => `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim() || '(ไม่พบลูกค้า)';

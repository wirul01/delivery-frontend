import { toNum } from '../../../core/utils/format';

/** หน้าตาข้อมูลที่ backend ส่งมาจริง (ตาราง buyers) — latitude/longitude เป็นข้อความเพราะเป็น DECIMAL */
export interface CustomerApi {
  buyer_id: number;
  first_name: string;
  last_name: string;
  phone_number: string;
  latitude: string | number;
  longitude: string | number;
  distance_km?: number; // มีเฉพาะผลลัพธ์จาก /buyers/nearby
}

/** ข้อมูลลูกค้าที่ใช้ในหน้าเว็บ (แปลงพิกัดเป็นตัวเลขแล้ว) */
export interface Customer {
  buyer_id: number;
  first_name: string;
  last_name: string;
  phone_number: string;
  latitude: number;
  longitude: number;
  distance_km?: number;
}

/** ข้อมูลที่ส่งไปตอนเพิ่ม/แก้ไข (POST/PATCH /buyers) */
export interface CustomerForm {
  first_name: string;
  last_name: string;
  phone_number: string;
  latitude: number;
  longitude: number;
}

export function toCustomer(row: CustomerApi): Customer {
  return { ...row, latitude: toNum(row.latitude), longitude: toNum(row.longitude) };
}

export const customerFullName = (c: { first_name?: string | null; last_name?: string | null }) =>
  `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim();

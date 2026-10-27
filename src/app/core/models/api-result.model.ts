/** ผลลัพธ์จาก POST/PATCH/DELETE ของ /buyers (ตามเอกสาร API ของเพื่อน) */
export interface WriteResult {
  affected_row: number;
  last_idx?: number; // มีเฉพาะตอน POST = id ที่เพิ่งสร้าง
}

/** ผลลัพธ์แบบข้อความ ใช้กับ /meal_orders */
export interface MessageResult {
  message: string;
  order_id?: number;
}

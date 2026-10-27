// ตั้งค่าการเชื่อมต่อ backend จริง — แก้ที่ไฟล์นี้ไฟล์เดียว
// โปรเจกต์นี้ "ไม่มีเซิร์ฟเวอร์จำลอง" ทุกหน้าที่ใช้ข้อมูล (ลูกค้า/ออเดอร์/แดชบอร์ด) ยิง API ไปที่ apiBaseUrl โดยตรง
export const environment = {
  // URL ของ backend ที่เพื่อนขึ้นเซิร์ฟเวอร์แล้ว (ไม่ต้องมี / ปิดท้าย) — ถ้าเพื่อนเปลี่ยนที่อยู่ ให้แก้บรรทัดนี้
  apiBaseUrl: 'https://delivery-backend-41vs.onrender.com',
  // apiBaseUrl:  'http://localhost:3000',
  // true = ใช้ URL แบบ #/admin/orders (เหมาะกับโฮสต์ที่ไม่ตั้ง rewrite) | false = URL ปกติ /admin/orders
  useHashRouting: false,
};

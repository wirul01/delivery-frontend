# ระบบข้าวกล่องมื้อเที่ยง — Front end (ต่อ backend จริง ไม่มีเซิร์ฟเวอร์จำลอง)

Angular 21 · ยิง API ไปที่ backend ที่เพื่อนขึ้นเซิร์ฟเวอร์แล้วโดยตรง ไม่ต้องรวมไฟล์กับ backend และไม่ต้องรัน backend เอง

## วิธีรัน
```bash
npm install
npm start          # เปิด http://localhost:4200
```
ที่อยู่ backend ตั้งที่ไฟล์เดียว: `src/environments/environment.ts` → `apiBaseUrl`
(เซิร์ฟเวอร์ฟรีอาจ “หลับ” คำขอแรกรอได้ประมาณ 30 วินาที หน้าจะแสดงสถานะกำลังโหลด)

## บัญชีเข้าสู่ระบบ (ทดลอง)
| บทบาท | ชื่อผู้ใช้ | รหัสผ่าน |
|---|---|---|
| เจ้าของร้าน | shop_owner | 1234 |
| ไรเดอร์ | rider01 | 1234 |

backend ยังไม่มี `/auth/login` จึงตรวจบัญชีในหน้าเว็บ (ไว้แยกหน้าตามบทบาท ไม่ใช่ความปลอดภัยจริง) เมื่อเพื่อนทำ login แล้ว แก้เมธอด `login()` ใน `src/app/features/auth/auth.service.ts` ให้ POST ไป backend

## หน้าไหนใช้ข้อมูลจริง
| หน้า | API ที่เรียก (ตรงกับ backend) |
|---|---|
| ลูกค้า `/admin/customers` | GET `/buyers`, GET `/buyers/search?first_name=&last_name=&id=`, GET `/buyers/nearby?latitude=&longitude=&radius=`, POST `/buyers`, PATCH `/buyers/:id`, DELETE `/buyers/:id` |
| ออเดอร์ `/admin/orders` | GET `/meal_orders` (+ `?lat=&lng=&radiusKm=`), POST `/meal_orders`, PATCH `/meal_orders/:id/quantity`, DELETE `/meal_orders/:id`, DELETE `/meal_orders`, POST `/meal_orders/seed` |
| ภาพรวมร้าน `/admin/dashboard` | GET `/meal_orders` และ GET `/buyers` (คำนวณยอดขาย/กำไรในหน้าเว็บ) |
| วางเส้นทาง · หน้าไรเดอร์ทั้ง 3 | ต้นแบบหน้าจอ ใช้ข้อมูลตัวอย่างในหน้าเว็บ (backend ยังไม่มี API ส่วนนี้) |

ตัดหน้า “เมนูอาหาร” และ “จัดการไรเดอร์” ออกจากโปรเจกต์ เพราะ backend ไม่มี `/menu_items` และ `/couriers` (ราคาเริ่มต้นออเดอร์ 65/40 แก้ได้ในฟอร์ม)

## ข้อสังเกตเรื่อง backend ที่ควรบอกเพื่อน
- `PATCH /buyers/:id` ถ้าแก้เบอร์เป็นเบอร์ที่ซ้ำ จะตอบ 500 (ไม่ได้ดัก ER_DUP_ENTRY เหมือน POST) หน้าเว็บแสดงข้อความแนะนำให้แล้ว
- `POST /meal_orders/seed` ใช้วันที่ตายตัว `2026-10-08` แดชบอร์ดจึงเลือกวันที่ล่าสุดที่มีออเดอร์ให้อัตโนมัติ
- `quantity` นอก 1–3 ฐานข้อมูลปฏิเสธและ backend ตอบ 500 (หน้าเว็บจำกัด 1–3 ไว้แล้ว)
- `model/meal_orders.ts` เขียน `AUTO_MATCHED` แต่ฐานข้อมูลเป็น `AUTO_MOCK`

## ทดสอบ
```bash
npm test     # 13 ข้อ: ตรวจว่าหน้าเว็บยิง API ตรงตามที่ backend เขียนไว้ (ชื่อเส้นทาง/พารามิเตอร์/body)
npm run build   # ได้ไฟล์ใน dist/delivery-admin/browser สำหรับขึ้นเซิร์ฟเวอร์
```

## โครงสร้าง
- `features/admin/` — dashboard, customers, orders, route-planning
- `features/delivery/` — หน้าไรเดอร์ (ต้นแบบ)
- `features/auth/` — login, guard (แยกบทบาท)
- `core/` — models, utils · `shared/` — layout, ui

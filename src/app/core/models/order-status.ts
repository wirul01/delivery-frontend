// สถานะออเดอร์ที่ "มีอยู่จริง" ในฐานข้อมูล: meal_orders.order_status ENUM('QUEUED','SHIPPED')
// ตกลงกับเพื่อนคนที่ 2 ให้ใช้ป้ายชื่อและสีชุดเดียวกัน (CSS class: badge badge-queued / badge-shipped ใน styles.css)
export type OrderStatus = 'QUEUED' | 'SHIPPED';
export type CreationType = 'MANUAL' | 'AUTO_MATCHED';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  QUEUED: 'รอจัดส่ง',
  SHIPPED: 'จัดส่งแล้ว',
};

export const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
  QUEUED: 'badge-queued',
  SHIPPED: 'badge-shipped',
};

export const CREATION_TYPE_LABEL: Record<CreationType, string> = {
  MANUAL: 'สั่งเอง',
  AUTO_MATCHED: 'จำลอง',
};

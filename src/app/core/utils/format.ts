// ฟังก์ชันช่วยเล็ก ๆ ที่ใช้ร่วมกันทั้งโปรเจกต์ (ทั้งคนที่ 1 และคนที่ 2 ใช้ได้)

/**
 * MySQL ส่งคอลัมน์ DECIMAL มาเป็น "ข้อความ" เช่น "65.00" และ "16.1841000"
 * ถ้าเอาไปบวกลบตรง ๆ จะกลายเป็นการต่อข้อความ ("65.00" + 1 = "65.001")
 * จึงต้องแปลงเป็นตัวเลขก่อนเสมอ
 */
export function toNum(value: string | number | null | undefined): number {
  const n = typeof value === 'number' ? value : parseFloat(value ?? '');
  return Number.isFinite(n) ? n : 0;
}

/** วันที่วันนี้ในรูปแบบ yyyy-MM-dd (เวลาเครื่องผู้ใช้) — ใช้กับ <input type="date"> */
export function todayStr(): string {
  return toDateInput(new Date());
}

/**
 * แปลงวันที่จาก API (เช่น "2026-10-08T00:00:00.000Z") เป็น yyyy-MM-dd ตามเวลาท้องถิ่น
 * ใช้ getFullYear/getMonth/getDate (เวลาท้องถิ่น) เพื่อไม่ให้วันที่เพี้ยนข้ามเขตเวลา
 */
export function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** แสดงวันที่แบบไทย เช่น 8 ต.ค. 2569 */
export function thaiDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** ดึงข้อความ error จากผลตอบกลับของ backend (backend เพื่อนใช้ทั้ง { error } และ { message }) */
export function apiErrorMessage(err: any, fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่'): string {
  const body = err?.error;
  if (body && typeof body === 'object') return body.error || body.message || fallback;
  if (err?.status === 0) return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้';
  return fallback;
}

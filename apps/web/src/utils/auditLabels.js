// ---------------------------------------------------------------------------
// ป้ายภาษาไทยของ action/entityType ใน Audit Log — Milestone 9
// ใช้ร่วมกันระหว่าง pages/AuditLog.jsx และ pages/Dashboard.jsx (การ์ด "กิจกรรม audit ล่าสุด")
// ต้องตรงกับ AUDIT_ACTIONS/AUDIT_ENTITY_TYPES ฝั่ง backend (apps/api/src/utils/auditLog.js)
// ---------------------------------------------------------------------------
export const ACTION_LABELS = {
  CREATE: 'สร้าง',
  UPDATE: 'แก้ไข',
  DELETE: 'ลบ',
  ASSIGN: 'มอบหมาย',
  RETURN: 'รับคืน',
  OPEN: 'เปิดใหม่',
  START_PROGRESS: 'เริ่มดำเนินการ',
  ON_HOLD: 'พักงาน',
  RESOLVE: 'แก้ไขสำเร็จ',
  CLOSE: 'ปิดงาน',
  LOGIN: 'เข้าสู่ระบบ',
  EXPORT_REPORT: 'ส่งออกรายงาน',
}

export const ENTITY_TYPE_LABELS = {
  Asset: 'ครุภัณฑ์',
  Assignment: 'การมอบหมาย',
  Ticket: 'ใบแจ้งซ่อม',
  Category: 'หมวดหมู่',
  Department: 'แผนก',
  Location: 'สถานที่ตั้ง',
  Vendor: 'ผู้ขาย/ผู้ผลิต',
  User: 'ผู้ใช้',
  Report: 'รายงาน',
}

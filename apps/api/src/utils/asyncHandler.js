// ---------------------------------------------------------------------------
// asyncHandler — ห่อ route handler ที่เป็น async ไว้ ไม่ต้องเขียน try/catch ซ้ำทุกที่
// ถ้าฟังก์ชันข้างในโยน error ออกมา จะถูกส่งต่อให้ error-handling middleware ใน index.js
// จัดการแปลงเป็นข้อความที่เป็นมิตรกับผู้ใช้แทนการโชว์ error ดิบ ๆ
// ---------------------------------------------------------------------------
export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

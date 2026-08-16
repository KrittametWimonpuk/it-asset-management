// ---------------------------------------------------------------------------
// CORS configuration — RC2: Production Hardening (Milestone 11)
//
// เดิม (ก่อน RC2) ใช้ cors() เฉย ๆ ซึ่งเท่ากับอนุญาตทุก origin แบบไม่มีเงื่อนไข — RC2 เปลี่ยนให้อ่าน
// origin ที่อนุญาตจาก environment variable แทน (ไม่ hardcode ชื่อ domain ไว้ในโค้ดเด็ดขาด)
//
//   CORS_ORIGIN — รายชื่อ origin ที่อนุญาต คั่นด้วยจุลภาค เช่น
//                 "http://localhost:5173,https://asset.example.com"
//
// ถ้าไม่ตั้งค่า CORS_ORIGIN ไว้เลย:
//   - NODE_ENV !== 'production' (ค่าเริ่มต้นตอน dev): reflect origin ที่ขอมา (เหมือนพฤติกรรมเดิมก่อน
//     RC2 ทุกประการ) — สะดวกตอนพัฒนาที่ frontend/backend คนละพอร์ต ไม่ต้องตั้งค่าอะไรเพิ่ม
//   - NODE_ENV === 'production': ปิดไปเลย (fail closed) — ปลอดภัยกว่าเปิดกว้างทุก origin โดยไม่ตั้งใจ
//     (ในทางปฏิบัติ production จริงของโปรเจกต์นี้ deploy ผ่าน ALB ที่ path-based route /api/* กับ /
//     ไปคนละ target group แต่ origin เดียวกันอยู่แล้ว — ดู deploy/02-infra.sh — จึงไม่นับเป็น
//     cross-origin request ตั้งแต่ต้น การตั้งค่านี้จึงมีผลจริงเฉพาะกรณีมี client อื่นเรียกข้าม origin)
// ---------------------------------------------------------------------------

export function buildCorsOptions() {
  const nodeEnv = process.env.NODE_ENV || 'development'
  const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (allowedOrigins.length > 0) {
    return { origin: allowedOrigins }
  }
  if (nodeEnv === 'production') {
    return { origin: false }
  }
  return { origin: true }
}

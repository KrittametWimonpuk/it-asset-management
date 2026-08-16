// ---------------------------------------------------------------------------
// Rate limiting — RC2: Production Hardening (Milestone 11)
//
// จำกัดจำนวนครั้งที่ยิง POST /api/auth/login และ /api/auth/register ได้ต่อช่วงเวลา ป้องกัน
// brute-force รหัสผ่านและการสแปมสร้างบัญชี — ไม่แตะ logic การตรวจสอบ credential/สมัครสมาชิกเดิม
// เลยแม้แต่บรรทัดเดียว (ทำงานเป็น middleware ชั้นนอกสุด ก่อนถึง route handler)
//
// ปรับค่าได้ผ่าน environment variable (ไม่ได้ hardcode ค่าตัวเลขไว้ในโค้ด):
//   AUTH_RATE_LIMIT_WINDOW_MS — ความยาวหน้าต่างเวลานับ (ms) ค่าเริ่มต้น 900000 (15 นาที)
//   AUTH_RATE_LIMIT_MAX       — จำนวนครั้งสูงสุดต่อ IP ในหน้าต่างเวลานั้น ค่าเริ่มต้น 10
// ---------------------------------------------------------------------------
import rateLimit from 'express-rate-limit'
import { fail } from '../utils/response.js'

const WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000
const MAX_REQUESTS = Number(process.env.AUTH_RATE_LIMIT_MAX) || 10

// ใช้ response envelope เดียวกับทุก endpoint ในระบบ ({success:false, message}) แทน default ของ
// express-rate-limit เอง ให้ frontend อ่าน err.message ได้แบบเดียวกับ error อื่น ๆ ทุกจุด
export const authRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS,
  standardHeaders: true, // แนบ RateLimit-* header มาตรฐานให้ client เช็กโควตาที่เหลือได้
  legacyHeaders: false,
  handler: (req, res) => {
    fail(res, 429, 'พยายามเข้าสู่ระบบ/สมัครสมาชิกบ่อยเกินไป กรุณาลองใหม่อีกครั้งในภายหลัง')
  },
})

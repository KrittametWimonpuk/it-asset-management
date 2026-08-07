// ---------------------------------------------------------------------------
// Middleware ตรวจสอบ JWT
// ใส่ไว้หน้า route ไหน = route นั้นต้อง "ล็อกอินก่อน" ถึงจะเข้าได้
//
// วิธีทำงาน:
//   1. อ่าน token จาก header  ->  Authorization: Bearer <token>
//   2. ตรวจว่า token ถูกต้องและยังไม่หมดอายุ ด้วย JWT_SECRET
//   3. ถ้าผ่าน แนบ req.user แล้วเรียก next() ไปทำงานต่อ
//   4. ถ้าไม่ผ่าน ตอบ 401 (Unauthorized)
// ---------------------------------------------------------------------------
import jwt from 'jsonwebtoken'
import { fail } from '../utils/response.js'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    return fail(res, 401, 'กรุณาเข้าสู่ระบบก่อน')
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = { id: payload.sub, email: payload.email, role: payload.role }
    next()
  } catch {
    return fail(res, 401, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง')
  }
}

// ---------------------------------------------------------------------------
// Middleware ตรวจสอบสิทธิ์ (RBAC) — Milestone 4
// ใช้ต่อจาก requireAuth เสมอ (พึ่งพา req.user.role ที่ requireAuth แนบไว้จาก JWT)
//
// ตัวอย่าง:
//   router.post('/', requireRole('ADMIN', 'IT_STAFF'), ...)
//   router.delete('/:id', requireRole('ADMIN'), ...)
// ---------------------------------------------------------------------------
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return fail(res, 403, 'คุณไม่มีสิทธิ์ทำรายการนี้')
    }
    next()
  }
}

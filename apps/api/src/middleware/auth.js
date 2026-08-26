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
import { prisma } from '../db.js'

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    return fail(res, 401, 'กรุณาเข้าสู่ระบบก่อน')
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    // อ่าน role ปัจจุบันจากฐานข้อมูลทุก request เพื่อให้การเลื่อน/ลดสิทธิ์โดย ADMIN มีผลทันที
    // แม้ JWT เดิมจะยังพก role เก่าอยู่ และยังคง enrich employeeId ให้ token รุ่นก่อน RC2
    const account = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, employeeId: true },
    })
    if (!account) return fail(res, 401, 'ไม่พบบัญชีผู้ใช้นี้ กรุณาเข้าสู่ระบบใหม่')

    let employeeId = account.employeeId || null
    if (!employeeId) {
      if (!employeeId && account?.email) {
        const [accounts, employees] = await Promise.all([
          prisma.user.findMany({
            where: { email: { equals: account.email, mode: 'insensitive' } }, select: { id: true }, take: 2,
          }),
          prisma.employee.findMany({
            where: {
              email: { equals: account.email, mode: 'insensitive' }, deletedAt: null,
            },
            select: { id: true }, take: 2,
          }),
        ])
        if (accounts.length === 1 && employees.length === 1) employeeId = employees[0].id
      }
    }
    req.user = { id: account.id, email: account.email, role: account.role, employeeId }
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

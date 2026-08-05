// ---------------------------------------------------------------------------
// Route: /api/auth  — สมัครสมาชิก / เข้าสู่ระบบ / ดูข้อมูลตัวเอง
// ---------------------------------------------------------------------------
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { ok, fail, fromZodError } from '../utils/response.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// กติกาการตรวจข้อมูลที่ส่งเข้ามา (validation) ด้วย zod
// .trim() ตัดช่องว่างหัว-ท้ายก่อนตรวจ กันไม่ให้ผ่านด้วยค่าที่เป็นช่องว่างล้วน
const registerSchema = z.object({
  email: z.string().trim().email('อีเมลไม่ถูกต้อง'),
  password: z.string().min(6, 'รหัสผ่านอย่างน้อย 6 ตัวอักษร'),
  name: z.string().trim().min(1).optional(),
})

const loginSchema = z.object({
  email: z.string().trim().email('อีเมลไม่ถูกต้อง'),
  password: z.string().min(1, 'กรุณาใส่รหัสผ่าน'),
})

// สร้าง JWT ที่หมดอายุใน 7 วัน
function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
}

// ---- สมัครสมาชิก ----
router.post('/register', asyncHandler(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    return fail(res, 400, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบฟอร์ม', fromZodError(parsed.error))
  }
  const { email, password, name } = parsed.data

  // ห้ามอีเมลซ้ำ
  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) {
    return fail(res, 409, 'อีเมลนี้ถูกใช้ไปแล้ว', [{ field: 'email', message: 'อีเมลนี้ถูกใช้ไปแล้ว' }])
  }

  // เข้ารหัสรหัสผ่านก่อนเก็บ (ห้ามเก็บรหัสจริง!)
  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { email, password: hash, name },
  })

  const token = signToken(user)
  ok(res, { token, user: { id: user.id, email: user.email, name: user.name } }, 201)
}))

// ---- เข้าสู่ระบบ ----
router.post('/login', asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return fail(res, 400, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบฟอร์ม', fromZodError(parsed.error))
  }
  const { email, password } = parsed.data

  const user = await prisma.user.findUnique({ where: { email } })
  // เช็ก user + รหัสผ่านพร้อมกัน และตอบข้อความเดียว เพื่อไม่บอกใบ้ว่าอีเมลมีอยู่ไหม
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return fail(res, 401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')
  }

  const token = signToken(user)
  ok(res, { token, user: { id: user.id, email: user.email, name: user.name } })
}))

// ---- ดูข้อมูลตัวเอง (ต้องล็อกอิน) ----
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, name: true, createdAt: true },
  })
  ok(res, { user })
}))

export default router

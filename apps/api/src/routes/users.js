// ---------------------------------------------------------------------------
// Route: /api/users — รายชื่อบัญชีและการจัดการ RBAC โดย ADMIN
//
// ADMIN/IT_STAFF อ่านรายชื่อได้เพื่อใช้กับ workflow เดิม แต่การเปลี่ยน role จำกัดเฉพาะ ADMIN
// และมี guard ป้องกันเปลี่ยนสิทธิ์ตัวเอง/ลดสิทธิ์ ADMIN คนสุดท้าย
// ---------------------------------------------------------------------------
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { ok, fail, fromZodError } from '../utils/response.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { parsePagination, parseSort, buildPageMeta } from '../utils/queryParams.js'
import { auditContext, logAudit } from '../utils/auditLog.js'

const router = Router()

// ADMIN/IT_STAFF ดูรายชื่อผู้ใช้ได้ (EMPLOYEE เข้าไม่ได้ — ไม่มีเหตุผลต้องเห็นรายชื่อผู้ใช้ทั้งระบบ)
router.use(requireAuth, requireRole('ADMIN', 'IT_STAFF'))

const SORTABLE_FIELDS = ['email', 'name', 'role', 'createdAt']
export const USER_ROLES = ['ADMIN', 'IT_STAFF', 'EMPLOYEE']
export const userRoleUpdateSchema = z.object({
  role: z.enum(USER_ROLES, { errorMap: () => ({ message: 'สิทธิ์ผู้ใช้ไม่ถูกต้อง' }) }),
}).strict()

export function buildUserListWhere(query) {
  const where = {}
  if (USER_ROLES.includes(query.role)) where.role = query.role
  const search = (query.search || '').trim()
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
      { employee: { is: { employeeCode: { contains: search, mode: 'insensitive' } } } },
      { employee: { is: { fullName: { contains: search, mode: 'insensitive' } } } },
    ]
  }
  return where
}

const USER_SELECT = {
  id: true, email: true, name: true, role: true, createdAt: true,
  employee: { select: { id: true, employeeCode: true, fullName: true, position: true } },
}

// ---- READ: รายชื่อผู้ใช้ทั้งหมด (แบ่งหน้า + เรียงลำดับ) — ไม่ส่ง password กลับไปเด็ดขาด ----
router.get('/', asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query)
  const orderBy = parseSort(req.query, SORTABLE_FIELDS, 'createdAt')
  const where = buildUserListWhere(req.query)

  const [items, totalItems] = await Promise.all([
    prisma.user.findMany({
      where, orderBy,
      skip: pagination.skip,
      take: pagination.take,
      select: USER_SELECT,
    }),
    prisma.user.count({ where }),
  ])

  ok(res, { items, ...buildPageMeta(pagination, totalItems) })
}))

// ---- UPDATE ROLE: ADMIN only ----
// ห้ามแก้ role ตัวเองและห้ามลดสิทธิ์ ADMIN คนสุดท้าย เพื่อลดความเสี่ยงล็อกระบบโดยไม่ตั้งใจ
router.patch('/:id/role', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const parsed = userRoleUpdateSchema.safeParse(req.body)
  if (!parsed.success) return fail(res, 400, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบสิทธิ์ที่เลือก', fromZodError(parsed.error))
  if (req.params.id === req.user.id) return fail(res, 400, 'ไม่สามารถเปลี่ยนสิทธิ์ของบัญชีที่กำลังใช้งานอยู่ได้')

  try {
    const user = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { id: req.params.id }, select: USER_SELECT })
      if (!existing) {
        const error = new Error('USER_NOT_FOUND')
        error.code = 'USER_NOT_FOUND'
        throw error
      }
      if (existing.role === parsed.data.role) return existing

      if (existing.role === 'ADMIN' && parsed.data.role !== 'ADMIN') {
        const adminCount = await tx.user.count({ where: { role: 'ADMIN' } })
        if (adminCount <= 1) {
          const error = new Error('LAST_ADMIN')
          error.code = 'LAST_ADMIN'
          throw error
        }
      }

      const updated = await tx.user.update({
        where: { id: existing.id }, data: { role: parsed.data.role }, select: USER_SELECT,
      })
      await logAudit({
        ...auditContext(req), action: 'UPDATE', entityType: 'User', entityId: existing.id,
        description: `เปลี่ยนสิทธิ์ผู้ใช้ ${existing.email}: ${existing.role} → ${updated.role}`,
        oldValues: { role: existing.role }, newValues: { role: updated.role },
      }, tx)
      return updated
    }, { isolationLevel: 'Serializable' })

    ok(res, user)
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') return fail(res, 404, 'ไม่พบบัญชีผู้ใช้นี้')
    if (error.code === 'LAST_ADMIN') return fail(res, 409, 'ไม่สามารถลดสิทธิ์ ADMIN คนสุดท้ายของระบบได้')
    if (error.code === 'P2034') return fail(res, 409, 'มีการเปลี่ยนสิทธิ์พร้อมกัน กรุณาลองใหม่อีกครั้ง')
    throw error
  }
}))

export default router

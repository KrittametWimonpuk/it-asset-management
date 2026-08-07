// ---------------------------------------------------------------------------
// Route: /api/audit — Milestone 9: Audit Log
//
// อ่านอย่างเดียว (immutable) — ไม่มี endpoint สร้าง/แก้ไข/ลบ audit record เลย บันทึกทำผ่าน
// utils/auditLog.js: logAudit() จากภายในโค้ดฝั่งอื่น ๆ เท่านั้น (ดูจุดที่เรียกใช้ใน routes/assets.js,
// utils/masterDataRouter.js, routes/assignments.js, routes/tickets.js, routes/reports.js, routes/auth.js)
//
// สิทธิ์: ADMIN/IT_STAFF อ่านได้ทั้งหมด, EMPLOYEE เข้าไม่ได้เลย (403) — ประวัติการทำรายการทั้งระบบไม่ใช่
// ข้อมูลที่พนักงานทั่วไปควรเห็น
//
// AuditLog.performedById ไม่ได้ผูก Prisma relation กับ User (ดูเหตุผลที่ schema.prisma) จึง join เอง
// ด้วยมือตรงนี้: ดึง id ที่ไม่ซ้ำจากหน้าที่กำลังแสดง มา query User ครั้งเดียว แล้ว map กลับ (ไม่ N+1)
// ---------------------------------------------------------------------------
import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { ok, fail } from '../utils/response.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { parsePagination, buildPageMeta } from '../utils/queryParams.js'
import { dateRangeWhere } from '../utils/reportHelpers.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, attachPerformer } from '../utils/auditLog.js'

const router = Router()

// เฉพาะ ADMIN/IT_STAFF เท่านั้นที่เข้าถึง audit log ได้ (EMPLOYEE ไม่มีสิทธิ์เลย)
router.use(requireAuth, requireRole('ADMIN', 'IT_STAFF'))

const NOT_FOUND_MESSAGE = 'ไม่พบ audit log รายการนี้'

// ---- READ: รายการ audit log (แบ่งหน้า + กรอง) — เรียงใหม่สุดก่อนเสมอ (performedAt desc) ----
router.get('/', asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query)

  const where = { ...dateRangeWhere('performedAt', parseDate(req.query.dateFrom), parseDate(req.query.dateTo)) }

  if (AUDIT_ACTIONS.includes(req.query.action)) where.action = req.query.action
  if (AUDIT_ENTITY_TYPES.includes(req.query.entityType)) where.entityType = req.query.entityType
  if (req.query.performedBy) where.performedById = req.query.performedBy

  const search = (req.query.search || '').trim()
  if (search) {
    where.OR = [
      { description: { contains: search, mode: 'insensitive' } },
      { entityId: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [rawItems, totalItems] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { performedAt: 'desc' }, skip: pagination.skip, take: pagination.take }),
    prisma.auditLog.count({ where }),
  ])

  const items = await attachPerformer(rawItems)
  ok(res, { items, ...buildPageMeta(pagination, totalItems) })
}))

// ---- READ: audit log รายการเดียว ----
router.get('/:id', asyncHandler(async (req, res) => {
  const item = await prisma.auditLog.findUnique({ where: { id: req.params.id } })
  if (!item) return fail(res, 404, NOT_FOUND_MESSAGE)

  const [withPerformer] = await attachPerformer([item])
  ok(res, withPerformer)
}))

// แปลงค่าจาก query string เป็น Date หรือ null — เหมือนแพทเทิร์นเดียวกับ reportHelpers.js: parseReportQuery
function parseDate(v) {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export default router

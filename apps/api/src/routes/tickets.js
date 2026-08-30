// ---------------------------------------------------------------------------
// Route: /api/tickets — Milestone 7: ใบแจ้งซ่อม/ปัญหาครุภัณฑ์ (Helpdesk & Maintenance)
//
// หนึ่งแถว = ปัญหาหนึ่งเรื่องของครุภัณฑ์หนึ่งชิ้น ห้ามลบ/เขียนทับประวัติเก่า (เหมือนแพทเทิร์น Assignment)
//
// Workflow (บังคับจริงที่นี่ ดู utils/ticketHelpers.js: TICKET_TRANSITIONS):
//   OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED
//   IN_PROGRESS <-> ON_HOLD (พักงานระหว่างทาง แล้วกลับมาทำต่อได้)
// RESOLVED ตั้งได้ทางเดียวคือผ่าน POST /:id/resolve (ต้องมาจาก IN_PROGRESS เท่านั้น + บังคับกรอก resolution)
// CLOSED ตั้งได้ทางเดียวคือผ่าน POST /:id/close (ต้องมาจาก RESOLVED เท่านั้น)
// PUT ทั่วไปแก้ได้เฉพาะตอนยัง OPEN/IN_PROGRESS/ON_HOLD เท่านั้น (คล้าย Assignment ที่แก้ไม่ได้หลังคืนแล้ว)
//
// สิทธิ์:
//   - GET (list/one): ทุก role เข้าได้ แต่ EMPLOYEE เห็นเฉพาะตั๋วที่ตัวเองเป็นผู้แจ้ง (reportedById ตรงกับตัวเอง)
//   - POST / (แจ้งปัญหาใหม่): ทุก role แจ้งได้ (รวม EMPLOYEE) — reportedById ตั้งจาก req.user.id เสมอ ไม่รับจาก
//     client (กันแอบอ้างเป็นคนอื่น) — EMPLOYEE แจ้งได้เฉพาะครุภัณฑ์ที่ตัวเองถือครองอยู่เท่านั้น (กันเห็น
//     asset ID ของทั้งระบบผ่านช่องทางอ้อมนี้ — ตรงกับขอบเขตเดียวกับที่ GET /api/assets ให้ EMPLOYEE เห็น)
//   - PUT /:id (แก้รายละเอียด/มอบหมาย), POST /:id/resolve, POST /:id/close: เฉพาะ ADMIN, IT_STAFF
//     (EMPLOYEE แจ้งปัญหาได้อย่างเดียว มอบหมาย/ปิดงานเองไม่ได้ ตามที่ spec ระบุ)
//   - assignedToId ต้องเป็นผู้ใช้ที่มี role ADMIN หรือ IT_STAFF เท่านั้น (มอบหมายให้ EMPLOYEE ดูแลไม่ได้)
// ---------------------------------------------------------------------------
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { ok, fail, fromZodError } from '../utils/response.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { parsePagination, parseSort, buildPageMeta } from '../utils/queryParams.js'
import { optionalEnum } from '../utils/zodHelpers.js'
import { ACTIVE_ASSIGNMENT_WHERE } from '../utils/assignmentHelpers.js'
import {
  nextTicketNumber, TICKET_WITH_RELATIONS, isValidTransition, PUT_EDITABLE_STATUSES,
} from '../utils/ticketHelpers.js'
import { logAudit, auditContext } from '../utils/auditLog.js'
import { createNotificationSafe, notifyStaff } from '../services/notificationService.js'

// ป้าย action ของ audit log ตามสถานะเป้าหมายที่ PUT ทั่วไปเปลี่ยนได้ (ไม่รวม RESOLVED/CLOSED — ใช้ action
// คงที่ RESOLVE/CLOSE ที่ endpoint เฉพาะของมันเองแทน ดูด้านล่าง)
const STATUS_TO_AUDIT_ACTION = { IN_PROGRESS: 'START_PROGRESS', ON_HOLD: 'ON_HOLD' }

const router = Router()

// requireAuth ครอบทุก route ในไฟล์นี้ — PUT/resolve/close ยังต้องผ่าน manageTickets เพิ่มอีกชั้น
router.use(requireAuth)

// เฉพาะ ADMIN/IT_STAFF ที่แก้ไข/มอบหมาย/ปิดงานตั๋วได้ — ใช้ซ้ำทั้ง 3 endpoint กันไม่ให้เขียนเงื่อนไขซ้ำ
const manageTickets = requireRole('ADMIN', 'IT_STAFF')

// ค่าที่อนุญาต — ต้องตรงกับ enum ใน schema.prisma
export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED']
export const TICKET_CATEGORIES = ['HARDWARE', 'SOFTWARE', 'NETWORK', 'PRINTER', 'ACCOUNT', 'OTHER']

const SORTABLE_FIELDS = ['ticketNumber', 'openedAt', 'resolvedAt', 'closedAt', 'priority', 'status', 'createdAt']

// ค้นหาข้าม ticket/asset/ผู้แจ้ง/ผู้ดูแล ตาม spec: Ticket Number, Title, Asset Tag, Asset Name,
// Hostname, Reporter Name, Assigned Staff
// export ทั้งคู่ไว้ให้ routes/reports.js ใช้ร่วมกัน (Milestone 8)
export const SEARCHABLE_TICKET_FIELDS = ['ticketNumber', 'title']
export const SEARCHABLE_ASSET_FIELDS = ['assetTag', 'name', 'hostname']

// EMPLOYEE เห็นเฉพาะตั๋วที่ตัวเองเป็นผู้แจ้ง — ADMIN/IT_STAFF เห็นทุกตั๋ว
// export ไว้ให้ routes/reports.js ใช้ร่วมกัน (Milestone 8) — ดูเหตุผลเดียวกับที่ assets.js: scopeForRead ทำไว้
export function scopeForRead(user) {
  if (user.role === 'EMPLOYEE') return { reportedById: user.id }
  return {}
}

const NOT_FOUND_MESSAGE = 'ไม่พบใบแจ้งซ่อมนี้ หรือคุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้'

// วันที่ "หลัก" ของตั๋ว (resolvedAt ตอน resolve, closedAt ตอน close) — บังคับมีค่า แต่ยอมไม่ส่งมา
// เพื่อให้ backend ใช้ now() แทน (เหมือนแพทเทิร์นเดียวกับ routes/assignments.js: requiredDateOptional)
function requiredDateOptional(message) {
  return z.string().trim().min(1, message)
    .refine((v) => !Number.isNaN(Date.parse(v)), { message })
    .transform((v) => new Date(v))
    .optional()
}

// ตรวจว่า assignedToId ที่ส่งมา (ถ้ามี) ชี้ไปยังผู้ใช้ที่มีอยู่จริงและเป็น ADMIN/IT_STAFF เท่านั้น
// (มอบหมายให้ EMPLOYEE ดูแลตั๋วไม่ได้ — ตาม business rule)
async function findInvalidAssignee(assignedToId) {
  if (!assignedToId) return null
  const staff = await prisma.user.findFirst({ where: { id: assignedToId, role: { in: ['ADMIN', 'IT_STAFF'] } } })
  if (!staff) return { field: 'assignedToId', message: 'ผู้ดูแลที่เลือกไม่ถูกต้อง หรือไม่มีสิทธิ์รับเรื่อง' }
  return null
}

// ---- CREATE: แจ้งปัญหาใหม่ (ทุก role แจ้งได้) ----
const createSchema = z.object({
  assetId: z.string().trim().min(1, 'กรุณาเลือกครุภัณฑ์'),
  title: z.string().trim().min(1, 'กรุณาใส่หัวข้อปัญหา'),
  description: z.string().trim().min(1, 'กรุณาใส่รายละเอียดปัญหา'),
  priority: optionalEnum(TICKET_PRIORITIES, 'ระดับความสำคัญไม่ถูกต้อง'),
  category: z.enum(TICKET_CATEGORIES, { errorMap: () => ({ message: 'กรุณาเลือกหมวดหมู่ปัญหา' }) }),
})

// ---- UPDATE: แก้ไขรายละเอียด/มอบหมาย (เฉพาะตอนยัง OPEN/IN_PROGRESS/ON_HOLD) ----
const updateSchema = z.object({
  title: z.string().trim().min(1, 'กรุณาใส่หัวข้อปัญหา').optional(),
  description: z.string().trim().min(1, 'กรุณาใส่รายละเอียดปัญหา').optional(),
  priority: optionalEnum(TICKET_PRIORITIES, 'ระดับความสำคัญไม่ถูกต้อง'),
  category: optionalEnum(TICKET_CATEGORIES, 'หมวดหมู่ปัญหาไม่ถูกต้อง'),
  assignedToId: z.string().trim().min(1).optional().nullable(),
  status: optionalEnum(PUT_EDITABLE_STATUSES, 'สถานะไม่ถูกต้อง'),
})

// ---- RESOLVE: แก้ไขปัญหาสำเร็จ (เฉพาะจาก IN_PROGRESS) — บังคับสรุปวิธีแก้ไข ----
const resolveSchema = z.object({
  resolution: z.string().trim().min(1, 'กรุณาสรุปวิธีแก้ไขปัญหา'),
  resolvedAt: requiredDateOptional('วันที่แก้ไขเสร็จไม่ถูกต้อง'),
})

// ---- CLOSE: ปิดงาน (เฉพาะจาก RESOLVED) ----
const closeSchema = z.object({
  closedAt: requiredDateOptional('วันที่ปิดงานไม่ถูกต้อง'),
})

// ---- READ: ดึงรายการตั๋ว (แบ่งหน้า + เรียงลำดับ + ค้นหา + กรอง) — ขอบเขตขึ้นกับ role ----
router.get('/', asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query)
  const orderBy = parseSort(req.query, SORTABLE_FIELDS, 'openedAt')

  const where = { deletedAt: null, ...scopeForRead(req.user) }

  const search = (req.query.search || '').trim()
  if (search) {
    where.OR = [
      ...SEARCHABLE_TICKET_FIELDS.map((field) => ({ [field]: { contains: search, mode: 'insensitive' } })),
      ...SEARCHABLE_ASSET_FIELDS.map((field) => ({ asset: { [field]: { contains: search, mode: 'insensitive' } } })),
      { reportedBy: { name: { contains: search, mode: 'insensitive' } } },
      { assignedTo: { name: { contains: search, mode: 'insensitive' } } },
    ]
  }

  if (TICKET_PRIORITIES.includes(req.query.priority)) where.priority = req.query.priority
  if (TICKET_STATUSES.includes(req.query.status)) where.status = req.query.status
  if (TICKET_CATEGORIES.includes(req.query.category)) where.category = req.query.category
  if (req.query.assetId) where.assetId = req.query.assetId
  if (req.query.assignedToId) where.assignedToId = req.query.assignedToId
  // filter ตาม "ผู้แจ้ง" — เฉพาะ ADMIN/IT_STAFF มีประโยชน์ (EMPLOYEE ถูกจำกัด reportedById ของตัวเองอยู่แล้ว)
  if (req.query.reportedById && req.user.role !== 'EMPLOYEE') where.reportedById = req.query.reportedById

  const [items, totalItems] = await Promise.all([
    prisma.ticket.findMany({ where, orderBy, skip: pagination.skip, take: pagination.take, ...TICKET_WITH_RELATIONS }),
    prisma.ticket.count({ where }),
  ])

  ok(res, { items, ...buildPageMeta(pagination, totalItems) })
}))

// ---- READ: ดึงตั๋วชิ้นเดียว — ขอบเขตขึ้นกับ role ----
router.get('/:id', asyncHandler(async (req, res) => {
  const ticket = await prisma.ticket.findFirst({
    where: { id: req.params.id, deletedAt: null, ...scopeForRead(req.user) },
    ...TICKET_WITH_RELATIONS,
  })
  if (!ticket) return fail(res, 404, NOT_FOUND_MESSAGE)
  ok(res, ticket)
}))

router.post('/', asyncHandler(async (req, res) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    return fail(res, 400, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบฟอร์ม', fromZodError(parsed.error))
  }
  const { assetId, ...rest } = parsed.data

  const asset = await prisma.asset.findFirst({ where: { id: assetId, deletedAt: null } })
  if (!asset) {
    return fail(res, 400, 'ครุภัณฑ์นี้ไม่ถูกต้อง หรือถูกลบไปแล้ว', [{ field: 'assetId', message: 'ครุภัณฑ์นี้ไม่ถูกต้อง หรือถูกลบไปแล้ว' }])
  }

  // EMPLOYEE แจ้งปัญหาได้เฉพาะครุภัณฑ์ที่ตัวเองถือครองอยู่ (active assignment) — กันเปิดช่องให้เห็น/อ้างอิง
  // asset ID ของทั้งระบบผ่านฟอร์มแจ้งปัญหา (ต้องขอบเขตเดียวกับที่ GET /api/assets ให้ EMPLOYEE เห็น)
  if (req.user.role === 'EMPLOYEE') {
    const held = await prisma.assignment.findFirst({ where: { assetId, userId: req.user.id, ...ACTIVE_ASSIGNMENT_WHERE } })
    if (!held) {
      return fail(res, 403, 'คุณสามารถแจ้งปัญหาได้เฉพาะครุภัณฑ์ที่ตัวเองถือครองอยู่เท่านั้น')
    }
  }

  const ticketNumber = await nextTicketNumber()

  const ticket = await prisma.ticket.create({
    data: { ticketNumber, assetId, reportedById: req.user.id, ...rest },
    ...TICKET_WITH_RELATIONS,
  })

  await logAudit({
    ...auditContext(req), action: 'OPEN', entityType: 'Ticket', entityId: ticket.id,
    description: `แจ้งปัญหาใหม่ ${ticket.ticketNumber} — ${ticket.title} (${ticket.asset.assetTag})`,
    newValues: { assetId, ...rest },
  })

  const notificationContext = auditContext(req)
  await notifyStaff({
    excludeUserIds: [req.user.id],
    title: `ใบแจ้งปัญหาใหม่ ${ticket.ticketNumber}`,
    message: `${ticket.title} · ${ticket.asset.assetTag} — ${ticket.asset.name}`,
    type: 'SYSTEM',
    priority: ticket.priority === 'CRITICAL' ? 'CRITICAL' : (ticket.priority === 'HIGH' ? 'HIGH' : 'NORMAL'),
    preferenceField: 'helpdeskEnabled',
    templateKey: 'HELPDESK_NEW',
    dedupeKey: `ticket:${ticket.id}:new:staff`,
    auditContext: notificationContext,
  })
  await createNotificationSafe({
    userId: req.user.id,
    title: `รับแจ้งปัญหา ${ticket.ticketNumber} แล้ว`,
    message: `ระบบได้รับเรื่อง “${ticket.title}” และจะแจ้งความคืบหน้าผ่านศูนย์การสื่อสาร`,
    type: 'SYSTEM',
    priority: 'NORMAL',
    preferenceField: 'helpdeskEnabled',
    templateKey: 'HELPDESK_CONFIRMATION',
    dedupeKey: `ticket:${ticket.id}:confirmation:user:${req.user.id}`,
    auditContext: notificationContext,
  })

  ok(res, ticket, 201)
}))

router.put('/:id', manageTickets, asyncHandler(async (req, res) => {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    return fail(res, 400, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบฟอร์ม', fromZodError(parsed.error))
  }

  const existing = await prisma.ticket.findFirst({ where: { id: req.params.id, deletedAt: null } })
  if (!existing) return fail(res, 404, NOT_FOUND_MESSAGE)

  // แก้ได้เฉพาะตอนยัง OPEN/IN_PROGRESS/ON_HOLD เท่านั้น — RESOLVED/CLOSED ถือเป็นประวัติที่แก้ไม่ได้อีก
  // (เหมือนแพทเทิร์น Assignment ที่แก้ไม่ได้หลังคืนแล้ว)
  if (!PUT_EDITABLE_STATUSES.includes(existing.status)) {
    return fail(res, 400, 'ตั๋วนี้ถูกแก้ไขปัญหา หรือปิดงานไปแล้ว ไม่สามารถแก้ไขได้อีก')
  }

  const invalidAssignee = await findInvalidAssignee(parsed.data.assignedToId)
  if (invalidAssignee) return fail(res, 400, invalidAssignee.message, [invalidAssignee])

  if (parsed.data.status !== undefined && parsed.data.status !== existing.status
    && !isValidTransition(existing.status, parsed.data.status)) {
    const message = `ไม่สามารถเปลี่ยนสถานะจาก ${existing.status} เป็น ${parsed.data.status} ได้`
    return fail(res, 400, message, [{ field: 'status', message }])
  }

  const data = { ...parsed.data }
  // มอบหมายผู้ดูแลครั้งแรก (จากที่ยังว่างอยู่) ขณะตั๋วยัง OPEN และไม่ได้ระบุสถานะมาเอง -> ขยับเป็น IN_PROGRESS
  // อัตโนมัติ (การมอบหมายคือจุดเริ่มต้นของ "กำลังดำเนินการ" ตาม workflow ที่กำหนด)
  if (data.status === undefined && existing.assignedToId == null && data.assignedToId && existing.status === 'OPEN') {
    data.status = 'IN_PROGRESS'
  }

  const ticket = await prisma.ticket.update({
    where: { id: req.params.id },
    data,
    ...TICKET_WITH_RELATIONS,
  })

  // ถ้า status เปลี่ยน (รวมกรณีขยับเป็น IN_PROGRESS อัตโนมัติจากการมอบหมายครั้งแรก) ใช้ action ตามสถานะเป้าหมาย
  // (START_PROGRESS/ON_HOLD) ไม่งั้นถือเป็นการแก้ไขรายละเอียดทั่วไป (UPDATE)
  const statusChanged = data.status !== undefined && data.status !== existing.status
  const action = statusChanged ? (STATUS_TO_AUDIT_ACTION[data.status] || 'UPDATE') : 'UPDATE'

  await logAudit({
    ...auditContext(req), action, entityType: 'Ticket', entityId: ticket.id,
    description: `แก้ไข/มอบหมายตั๋ว ${ticket.ticketNumber} — ${ticket.title}`,
    oldValues: Object.fromEntries(Object.keys(data).map((k) => [k, existing[k]])),
    newValues: data,
  })

  ok(res, ticket)
}))

// ---- RESOLVE: แก้ไขปัญหาสำเร็จ — เฉพาะจากสถานะ IN_PROGRESS ----
router.post('/:id/resolve', manageTickets, asyncHandler(async (req, res) => {
  const parsed = resolveSchema.safeParse(req.body)
  if (!parsed.success) {
    return fail(res, 400, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบฟอร์ม', fromZodError(parsed.error))
  }

  const existing = await prisma.ticket.findFirst({ where: { id: req.params.id, deletedAt: null } })
  if (!existing) return fail(res, 404, NOT_FOUND_MESSAGE)

  if (!isValidTransition(existing.status, 'RESOLVED')) {
    return fail(res, 400, 'ตั๋วต้องอยู่ในสถานะ "กำลังดำเนินการ" ก่อน จึงจะบันทึกว่าแก้ไขสำเร็จได้')
  }

  const resolvedAt = parsed.data.resolvedAt || new Date()
  const resolveData = { status: 'RESOLVED', resolution: parsed.data.resolution, resolvedAt }
  const ticket = await prisma.ticket.update({
    where: { id: req.params.id },
    data: resolveData,
    ...TICKET_WITH_RELATIONS,
  })

  await logAudit({
    ...auditContext(req), action: 'RESOLVE', entityType: 'Ticket', entityId: ticket.id,
    description: `แก้ไขปัญหาสำเร็จ ${ticket.ticketNumber} — ${ticket.title}`,
    oldValues: { status: existing.status, resolution: existing.resolution, resolvedAt: existing.resolvedAt },
    newValues: resolveData,
  })

  ok(res, ticket)
}))

// ---- CLOSE: ปิดงาน — เฉพาะจากสถานะ RESOLVED ----
router.post('/:id/close', manageTickets, asyncHandler(async (req, res) => {
  const parsed = closeSchema.safeParse(req.body)
  if (!parsed.success) {
    return fail(res, 400, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบฟอร์ม', fromZodError(parsed.error))
  }

  const existing = await prisma.ticket.findFirst({ where: { id: req.params.id, deletedAt: null } })
  if (!existing) return fail(res, 404, NOT_FOUND_MESSAGE)

  if (!isValidTransition(existing.status, 'CLOSED')) {
    return fail(res, 400, 'ตั๋วต้องแก้ไขปัญหาสำเร็จ (RESOLVED) ก่อน จึงจะปิดงานได้')
  }

  const closedAt = parsed.data.closedAt || new Date()
  const closeData = { status: 'CLOSED', closedAt }
  const ticket = await prisma.ticket.update({
    where: { id: req.params.id },
    data: closeData,
    ...TICKET_WITH_RELATIONS,
  })

  await logAudit({
    ...auditContext(req), action: 'CLOSE', entityType: 'Ticket', entityId: ticket.id,
    description: `ปิดงาน ${ticket.ticketNumber} — ${ticket.title}`,
    oldValues: { status: existing.status, closedAt: existing.closedAt },
    newValues: closeData,
  })

  ok(res, ticket)
}))

export default router

// ---------------------------------------------------------------------------
// Route: /api/assignments — Milestone 5: มอบหมาย/รับคืนครุภัณฑ์ (ประวัติการถือครอง)
//
// หนึ่งแถว = การมอบหมายหนึ่งรอบ (ตั้งแต่มอบจนกว่าจะคืน) ห้ามลบ/เขียนทับประวัติเก่า
// "ผู้ถือครองปัจจุบัน" ของ asset = แถวล่าสุดที่ returnedAt IS NULL (ดู utils/assignmentHelpers.js)
// asset หนึ่งชิ้นมีแถว active แบบนี้ได้สูงสุด 1 แถว บังคับจริงด้วย partial unique index ใน migration.sql
//
// สิทธิ์:
//   - GET (list/one): ทุก role เข้าได้ แต่ EMPLOYEE เห็นเฉพาะรายการที่ Employee email หรือ legacy userId ตรงกับบัญชี
//   - POST / (มอบหมาย), PUT /:id (แก้รายละเอียด), POST /:id/return (รับคืน): เฉพาะ ADMIN, IT_STAFF
//   - PUT แก้ได้เฉพาะ expectedReturnDate/conditionBefore/remark — ไม่แก้ asset/ผู้ถือครอง/วันที่มอบหมาย
//     (ข้อมูลหลักของประวัติต้องคงที่) และแก้ได้เฉพาะตอนยัง active เท่านั้น (คืนแล้ว = ปิดประวัติ)
//   - Phase 5 เพิ่ม /return/start และ /return/inspect; /return เดิมยังอยู่เป็น atomic compatibility API
// ---------------------------------------------------------------------------
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { ok, fail, fromZodError } from '../utils/response.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { parsePagination, parseSort, buildPageMeta } from '../utils/queryParams.js'
import { optionalText, optionalDate, optionalEnum } from '../utils/zodHelpers.js'
import {
  ACTIVE_ASSIGNMENT_WHERE,
  EMPLOYEE_SUMMARY_SELECT,
  LEGACY_HOLDER_SELECT,
  assignmentHolderName,
  assignmentHolderScopeForAccount,
} from '../utils/assignmentHelpers.js'
import { ASSET_CONDITIONS } from './assets.js'
import { logAudit, auditContext } from '../utils/auditLog.js'

const router = Router()

// requireAuth ครอบทุก route ในไฟล์นี้ — POST/PUT/return ยังต้องผ่าน manageAssignments เพิ่มอีกชั้น
router.use(requireAuth)

// เฉพาะ ADMIN/IT_STAFF ที่มอบหมาย/แก้ไข/รับคืนได้ — ใช้ซ้ำทั้ง 3 endpoint กันไม่ให้เขียนเงื่อนไขซ้ำ
const manageAssignments = requireRole('ADMIN', 'IT_STAFF')

// สถานะที่อนุญาต — ต้องตรงกับ enum AssignmentStatus ใน schema.prisma
// export ไว้ให้ routes/dashboard.js ใช้ร่วมกัน (สร้าง breakdown ให้ครบทุกสถานะแม้บางสถานะจะนับได้ 0)
export const ASSIGNMENT_STATUSES = ['ASSIGNED', 'RETURNED', 'LOST', 'DAMAGED']
// ผลลัพธ์ที่ยอมให้ตั้งตอน "รับคืน" ได้ — ไม่รวม ASSIGNED (นั่นคือสถานะตอนเริ่มมอบหมาย ไม่ใช่ผลตอนปิดรายการ)
const RETURN_STATUSES = ['RETURNED', 'LOST', 'DAMAGED']
export const RETURN_WORKFLOW_STATUSES = ['PENDING_INSPECTION', 'PASSED', 'FAILED', ...RETURN_STATUSES]

const SORTABLE_FIELDS = ['assignedAt', 'returnedAt', 'createdAt', 'status']

// ค้นหาข้าม asset/ผู้ถือครอง ตาม spec: Asset Tag, Asset Name, Employee Name, Hostname, Serial Number
// export ไว้ให้ routes/reports.js ใช้ร่วมกัน (Milestone 8)
export const SEARCHABLE_ASSET_FIELDS = ['assetTag', 'name', 'hostname', 'serialNumber']

const WITH_RELATIONS = {
  include: {
    asset: { select: { id: true, assetTag: true, name: true, hostname: true, serialNumber: true, assetCondition: true } },
    employee: { select: EMPLOYEE_SUMMARY_SELECT },
    user: { select: LEGACY_HOLDER_SELECT },
    assignedBy: { select: { id: true, name: true, email: true } },
    inspectedBy: { select: { id: true, name: true, email: true } },
    returnEvents: {
      orderBy: { createdAt: 'asc' },
      include: { actorUser: { select: { id: true, name: true, email: true } } },
    },
  },
}

// EMPLOYEE เห็นเฉพาะรายการที่ตัวเองเป็นผู้ถือครอง (ทั้งอดีต+ปัจจุบัน) — ADMIN/IT_STAFF เห็นทุกรายการ
// export ไว้ให้ routes/reports.js ใช้ร่วมกัน (Milestone 8) — ดูเหตุผลเดียวกับที่ assets.js: scopeForRead ทำไว้
export function scopeForRead(user) {
  if (user.role === 'EMPLOYEE') return assignmentHolderScopeForAccount(user)
  return {}
}

const NOT_FOUND_MESSAGE = 'ไม่พบรายการมอบหมายนี้ หรือคุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้'

// วันที่ "หลัก" ของ assignment (assignedAt ตอนสร้าง, returnedAt ตอนคืน) — บังคับมีค่า แต่ยอมไม่ส่งมา
// เพื่อให้ backend ใช้ default ของ DB แทน (แตกต่างจาก optionalDate ที่ใช้กับคอลัมน์ nullable จริง ๆ)
function requiredDateOptional(message) {
  return z.string().trim().min(1, message)
    .refine((v) => !Number.isNaN(Date.parse(v)), { message })
    .transform((v) => new Date(v))
    .optional()
}

// ---- CREATE: มอบหมายครุภัณฑ์ ----
export const createSchema = z.object({
  assetId: z.string().trim().min(1, 'กรุณาเลือกครุภัณฑ์'),
  employeeId: z.string().trim().min(1, 'กรุณาเลือกพนักงาน').optional(),
  // รองรับ client เดิมระหว่างช่วงเปลี่ยนผ่าน โดย API จะ resolve User -> Employee ทางอีเมล
  userId: z.string().trim().min(1, 'กรุณาเลือกพนักงาน').optional(),
  assignedAt: requiredDateOptional('วันที่มอบหมายไม่ถูกต้อง'),
  expectedReturnDate: optionalDate('วันที่คาดว่าจะคืนไม่ถูกต้อง'),
  conditionBefore: optionalEnum(ASSET_CONDITIONS, 'สภาพก่อนมอบหมายไม่ถูกต้อง'),
  remark: optionalText(),
}).refine((data) => data.employeeId || data.userId, {
  message: 'กรุณาเลือกพนักงาน', path: ['employeeId'],
}).refine((data) => {
  if (!data.assignedAt || !data.expectedReturnDate) return true
  return data.expectedReturnDate >= data.assignedAt
}, { message: 'วันที่คาดว่าจะคืนต้องไม่ก่อนวันที่มอบหมาย', path: ['expectedReturnDate'] })

// ---- UPDATE: แก้ไขรายละเอียด (เฉพาะตอนยัง active) — ไม่แก้ asset/ผู้ถือครอง/วันที่มอบหมาย/สถานะ ----
const updateSchema = z.object({
  expectedReturnDate: optionalDate('วันที่คาดว่าจะคืนไม่ถูกต้อง'),
  conditionBefore: optionalEnum(ASSET_CONDITIONS, 'สภาพก่อนมอบหมายไม่ถูกต้อง'),
  remark: optionalText(),
})

// ---- RETURN compatibility payload — ผลลัพธ์เป็น RETURNED/LOST/DAMAGED (default RETURNED) ----
const returnSchema = z.object({
  conditionAfter: optionalEnum(ASSET_CONDITIONS, 'สภาพหลังคืนไม่ถูกต้อง'),
  remark: optionalText(),
  returnedAt: requiredDateOptional('วันที่คืนไม่ถูกต้อง'),
  status: optionalEnum(RETURN_STATUSES, 'สถานะไม่ถูกต้อง'),
})

export const returnStartSchema = z.object({ notes: optionalText() })

export const returnInspectionSchema = z.object({
  status: z.enum(RETURN_STATUSES, { message: 'กรุณาเลือกผลลัพธ์การรับคืน' }),
  conditionAfter: optionalEnum(ASSET_CONDITIONS, 'สภาพหลังคืนไม่ถูกต้อง'),
  inspectionNotes: z.string().trim().min(1, 'กรุณาระบุบันทึกการตรวจรับ').max(2000, 'บันทึกการตรวจรับยาวเกินไป'),
  inspectedAt: requiredDateOptional('วันที่ตรวจรับไม่ถูกต้อง'),
  returnedAt: requiredDateOptional('วันที่คืนไม่ถูกต้อง'),
}).superRefine((data, ctx) => {
  if (data.status !== 'LOST' && !data.conditionAfter) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['conditionAfter'], message: 'กรุณาระบุสภาพครุภัณฑ์หลังคืน' })
  }
})

function inspectionResultFor(status) {
  return status === 'RETURNED' ? 'PASSED' : 'FAILED'
}

function finalAuditActionFor(status) {
  if (status === 'DAMAGED') return 'RETURN_DAMAGED'
  if (status === 'LOST') return 'RETURN_LOST'
  return 'RETURN_COMPLETED'
}

function ensureReturnDateIsValid(res, date, assignedAt, field = 'returnedAt') {
  if (date >= assignedAt) return true
  const message = field === 'inspectedAt' ? 'วันที่ตรวจรับต้องไม่ก่อนวันที่มอบหมาย' : 'วันที่คืนต้องไม่ก่อนวันที่มอบหมาย'
  fail(res, 400, message, [{ field, message }])
  return false
}

async function finalizeReturn({ assignmentId, existing, req, status, conditionAfter, inspectionNotes, inspectedAt, returnedAt, remark }) {
  const inspectionResult = inspectionResultFor(status)
  const startedAt = existing.returnStartedAt || inspectedAt
  const needsStartedEvent = existing.returnStatus !== 'PENDING_INSPECTION'

  return prisma.$transaction(async (tx) => {
    const changed = await tx.assignment.updateMany({
      where: { id: assignmentId, returnedAt: null, deletedAt: null },
      data: {
        returnedAt,
        status,
        conditionAfter,
        returnStatus: status,
        returnStartedAt: startedAt,
        inspectionResult,
        inspectedById: req.user.id,
        inspectionNotes,
        inspectedAt,
        ...(remark !== undefined ? { remark } : {}),
      },
    })
    if (changed.count !== 1) throw Object.assign(new Error('RETURN_ALREADY_CLOSED'), { code: 'RETURN_ALREADY_CLOSED' })

    if (conditionAfter) {
      await tx.asset.update({
        where: { id: existing.assetId },
        data: { assetCondition: status === 'DAMAGED' ? 'DAMAGED' : conditionAfter },
      })
    } else if (status === 'DAMAGED') {
      await tx.asset.update({ where: { id: existing.assetId }, data: { assetCondition: 'DAMAGED' } })
    }

    const events = []
    if (needsStartedEvent) events.push({
      assignmentId, status: 'PENDING_INSPECTION', actorUserId: req.user.id,
      notes: 'เริ่มกระบวนการตรวจรับคืน', createdAt: startedAt,
    })
    events.push({
      assignmentId, status: inspectionResult, actorUserId: req.user.id,
      condition: conditionAfter, notes: inspectionNotes, createdAt: inspectedAt,
    })
    events.push({
      assignmentId, status, actorUserId: req.user.id,
      condition: conditionAfter, notes: inspectionNotes, createdAt: returnedAt,
    })
    await tx.assignmentReturnEvent.createMany({ data: events })

    return tx.assignment.findUnique({ where: { id: assignmentId }, ...WITH_RELATIONS })
  })
}

function logInspectionAudit(req, assignment, status, inspectionResult, conditionAfter, inspectionNotes, inspectedAt, returnedAt) {
  const base = { ...auditContext(req), entityType: 'Assignment', entityId: assignment.id }
  logAudit({
    ...base,
    action: 'RETURN_INSPECTED',
    description: `ตรวจรับคืน ${assignment.asset.assetTag} — ${assignment.asset.name}: ${inspectionResult}`,
    newValues: { inspectionResult, conditionAfter: conditionAfter || null, inspectionNotes, inspectedAt, inspectorId: req.user.id },
  })
  logAudit({
    ...base,
    action: finalAuditActionFor(status),
    description: `${status === 'RETURNED' ? 'รับคืนสำเร็จ' : status === 'DAMAGED' ? 'รับคืนแบบชำรุด' : 'บันทึกสูญหาย'} ${assignment.asset.assetTag} — ${assignment.asset.name}`,
    newValues: { status, returnStatus: status, returnedAt, employeeId: assignment.employeeId },
  })
}

// ---- READ: ดึงรายการมอบหมาย (แบ่งหน้า + เรียงลำดับ + ค้นหา + กรอง) — ขอบเขตขึ้นกับ role ----
router.get('/', asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query)
  const orderBy = parseSort(req.query, SORTABLE_FIELDS, 'assignedAt')

  const where = { deletedAt: null }
  const constraints = []
  const readScope = scopeForRead(req.user)
  if (Object.keys(readScope).length) constraints.push(readScope)

  const search = (req.query.search || '').trim()
  if (search) {
    constraints.push({ OR: [
      ...SEARCHABLE_ASSET_FIELDS.map((field) => ({
        asset: { [field]: { contains: search, mode: 'insensitive' } },
      })),
      { employee: { employeeCode: { contains: search, mode: 'insensitive' } } },
      { employee: { fullName: { contains: search, mode: 'insensitive' } } },
      { employee: { department: { name: { contains: search, mode: 'insensitive' } } } },
      // legacy holder search keeps old assignments discoverable
      { user: { name: { contains: search, mode: 'insensitive' } } },
    ] })
  }

  if (constraints.length) where.AND = constraints

  if (ASSIGNMENT_STATUSES.includes(req.query.status)) where.status = req.query.status
  if (req.query.assetId) where.assetId = req.query.assetId
  if (req.query.employeeId && req.user.role !== 'EMPLOYEE') where.employeeId = req.query.employeeId
  // legacy filter ตามบัญชีผู้ถือครอง — เก็บไว้เพื่อ backward compatibility
  if (req.query.userId && req.user.role !== 'EMPLOYEE') where.userId = req.query.userId

  const [items, totalItems] = await Promise.all([
    prisma.assignment.findMany({ where, orderBy, skip: pagination.skip, take: pagination.take, ...WITH_RELATIONS }),
    prisma.assignment.count({ where }),
  ])

  ok(res, { items, ...buildPageMeta(pagination, totalItems) })
}))

// ---- READ: ดึงรายการมอบหมายชิ้นเดียว — ขอบเขตขึ้นกับ role ----
router.get('/:id', asyncHandler(async (req, res) => {
  const assignment = await prisma.assignment.findFirst({
    where: { id: req.params.id, deletedAt: null, ...scopeForRead(req.user) },
    ...WITH_RELATIONS,
  })
  if (!assignment) return fail(res, 404, NOT_FOUND_MESSAGE)
  ok(res, assignment)
}))

router.post('/', manageAssignments, asyncHandler(async (req, res) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    return fail(res, 400, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบฟอร์ม', fromZodError(parsed.error))
  }
  const { assetId, employeeId: requestedEmployeeId, userId: requestedUserId, ...rest } = parsed.data

  const asset = await prisma.asset.findFirst({ where: { id: assetId, deletedAt: null } })
  if (!asset) {
    return fail(res, 400, 'ครุภัณฑ์นี้ไม่ถูกต้อง หรือถูกลบไปแล้ว', [{ field: 'assetId', message: 'ครุภัณฑ์นี้ไม่ถูกต้อง หรือถูกลบไปแล้ว' }])
  }

  let legacyUser = null
  if (requestedUserId) {
    legacyUser = await prisma.user.findUnique({ where: { id: requestedUserId } })
    if (!legacyUser) {
      return fail(res, 400, 'ไม่พบผู้ใช้นี้ในระบบ', [{ field: 'userId', message: 'ไม่พบผู้ใช้นี้ในระบบ' }])
    }
  }

  const employeeWhere = requestedEmployeeId
    ? { id: requestedEmployeeId }
    : { email: { equals: legacyUser.email, mode: 'insensitive' } }
  const targetEmployee = await prisma.employee.findFirst({
    where: { ...employeeWhere, deletedAt: null, isActive: true, status: 'ACTIVE' },
    select: { ...EMPLOYEE_SUMMARY_SELECT, email: true },
  })
  if (!targetEmployee) {
    const message = requestedEmployeeId
      ? 'ไม่พบพนักงานที่พร้อมรับมอบหมาย'
      : 'บัญชีผู้ใช้เดิมนี้ยังไม่ได้เชื่อมกับพนักงานที่พร้อมรับมอบหมาย'
    return fail(res, 400, message, [{ field: 'employeeId', message }])
  }

  // Preserve userId where a matching account exists, but do not require Employee to have a login.
  if (!legacyUser && targetEmployee.email) {
    legacyUser = await prisma.user.findFirst({
      where: { email: { equals: targetEmployee.email, mode: 'insensitive' } },
    })
  }

  const activeAssignment = await prisma.assignment.findFirst({ where: { assetId, ...ACTIVE_ASSIGNMENT_WHERE } })
  if (activeAssignment) {
    return fail(res, 409, 'ครุภัณฑ์นี้ถูกมอบหมายให้ผู้อื่นอยู่แล้ว กรุณารับคืนก่อนมอบหมายใหม่')
  }

  const assignment = await prisma.assignment.create({
    data: {
      assetId,
      employeeId: targetEmployee.id,
      userId: legacyUser?.id,
      assignedById: req.user.id,
      ...rest,
    },
    ...WITH_RELATIONS,
  })

  logAudit({
    ...auditContext(req), action: 'ASSIGN', entityType: 'Assignment', entityId: assignment.id,
    description: `มอบหมาย ${assignment.asset.assetTag} — ${assignment.asset.name} ให้ ${assignmentHolderName(assignment)} (${assignment.employee.employeeCode})`,
    newValues: { assetId, employeeId: targetEmployee.id, userId: legacyUser?.id || null, ...rest },
  })

  ok(res, assignment, 201)
}))

router.put('/:id', manageAssignments, asyncHandler(async (req, res) => {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    return fail(res, 400, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบฟอร์ม', fromZodError(parsed.error))
  }

  // แก้ได้เฉพาะตอนยัง active (returnedAt: null) — ปิดรายการแล้วถือเป็นประวัติที่แก้ไม่ได้อีก
  const existing = await prisma.assignment.findFirst({ where: { id: req.params.id, deletedAt: null, ...ACTIVE_ASSIGNMENT_WHERE } })
  if (!existing) return fail(res, 404, NOT_FOUND_MESSAGE)

  const nextExpectedReturn = parsed.data.expectedReturnDate !== undefined ? parsed.data.expectedReturnDate : existing.expectedReturnDate
  if (nextExpectedReturn && nextExpectedReturn < existing.assignedAt) {
    const message = 'วันที่คาดว่าจะคืนต้องไม่ก่อนวันที่มอบหมาย'
    return fail(res, 400, message, [{ field: 'expectedReturnDate', message }])
  }

  const assignment = await prisma.assignment.update({
    where: { id: req.params.id },
    data: parsed.data,
    ...WITH_RELATIONS,
  })

  logAudit({
    ...auditContext(req), action: 'UPDATE', entityType: 'Assignment', entityId: assignment.id,
    description: `แก้ไขรายละเอียดการมอบหมาย ${assignment.asset.assetTag} — ${assignment.asset.name}`,
    oldValues: Object.fromEntries(Object.keys(parsed.data).map((k) => [k, existing[k]])),
    newValues: parsed.data,
  })

  ok(res, assignment)
}))

// ---- RETURN PHASE 5: เริ่มตรวจรับ — Assignment ยัง active จนกว่าจะตรวจเสร็จ ----
router.post('/:id/return/start', manageAssignments, asyncHandler(async (req, res) => {
  const parsed = returnStartSchema.safeParse(req.body || {})
  if (!parsed.success) return fail(res, 400, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบฟอร์ม', fromZodError(parsed.error))

  const existing = await prisma.assignment.findFirst({
    where: { id: req.params.id, deletedAt: null, ...ACTIVE_ASSIGNMENT_WHERE },
    ...WITH_RELATIONS,
  })
  if (!existing) return fail(res, 404, 'ไม่พบรายการมอบหมายนี้ หรือถูกรับคืนไปแล้ว')
  if (existing.returnStatus === 'PENDING_INSPECTION') return fail(res, 409, 'รายการนี้อยู่ระหว่างรอตรวจรับแล้ว')

  const startedAt = new Date()
  const assignment = await prisma.$transaction(async (tx) => {
    const changed = await tx.assignment.updateMany({
      where: { id: existing.id, returnedAt: null, returnStatus: null },
      data: { returnStatus: 'PENDING_INSPECTION', returnStartedAt: startedAt },
    })
    if (changed.count !== 1) throw Object.assign(new Error('RETURN_ALREADY_STARTED'), { code: 'RETURN_ALREADY_STARTED' })
    await tx.assignmentReturnEvent.create({
      data: {
        assignmentId: existing.id,
        status: 'PENDING_INSPECTION',
        actorUserId: req.user.id,
        notes: parsed.data.notes || 'เริ่มกระบวนการตรวจรับคืน',
        createdAt: startedAt,
      },
    })
    return tx.assignment.findUnique({ where: { id: existing.id }, ...WITH_RELATIONS })
  }).catch((error) => {
    if (error.code === 'RETURN_ALREADY_STARTED') return null
    throw error
  })
  if (!assignment) return fail(res, 409, 'รายการนี้เริ่มกระบวนการรับคืนไปแล้ว')

  logAudit({
    ...auditContext(req), action: 'RETURN_STARTED', entityType: 'Assignment', entityId: assignment.id,
    description: `เริ่มตรวจรับคืน ${assignment.asset.assetTag} — ${assignment.asset.name} จาก ${assignmentHolderName(assignment)}`,
    newValues: { returnStatus: 'PENDING_INSPECTION', returnStartedAt: startedAt, employeeId: assignment.employeeId },
  })
  ok(res, assignment)
}))

// ---- ตรวจรับและปิด Assignment แบบ atomic: PASS -> RETURNED, FAIL -> DAMAGED/LOST ----
router.post('/:id/return/inspect', manageAssignments, asyncHandler(async (req, res) => {
  const parsed = returnInspectionSchema.safeParse(req.body)
  if (!parsed.success) return fail(res, 400, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบฟอร์ม', fromZodError(parsed.error))

  const existing = await prisma.assignment.findFirst({
    where: { id: req.params.id, deletedAt: null, ...ACTIVE_ASSIGNMENT_WHERE },
    ...WITH_RELATIONS,
  })
  if (!existing) return fail(res, 404, 'ไม่พบรายการมอบหมายนี้ หรือถูกรับคืนไปแล้ว')
  if (existing.returnStatus !== 'PENDING_INSPECTION') return fail(res, 409, 'กรุณาเริ่มกระบวนการตรวจรับก่อนบันทึกผล')

  const inspectedAt = parsed.data.inspectedAt || new Date()
  const returnedAt = parsed.data.returnedAt || inspectedAt
  if (!ensureReturnDateIsValid(res, inspectedAt, existing.assignedAt, 'inspectedAt')) return
  if (!ensureReturnDateIsValid(res, returnedAt, existing.assignedAt)) return

  const assignment = await finalizeReturn({
    assignmentId: existing.id,
    existing,
    req,
    status: parsed.data.status,
    conditionAfter: parsed.data.conditionAfter,
    inspectionNotes: parsed.data.inspectionNotes,
    inspectedAt,
    returnedAt,
  }).catch((error) => {
    if (error.code === 'RETURN_ALREADY_CLOSED') return null
    throw error
  })
  if (!assignment) return fail(res, 409, 'รายการนี้ถูกรับคืนไปแล้ว')

  logInspectionAudit(
    req, assignment, parsed.data.status, inspectionResultFor(parsed.data.status),
    parsed.data.conditionAfter, parsed.data.inspectionNotes, inspectedAt, returnedAt,
  )
  ok(res, assignment)
}))

// ---- API เดิม: คง contract เดิม และประมวลผลเป็น start + inspection + close ใน request เดียว ----
router.post('/:id/return', manageAssignments, asyncHandler(async (req, res) => {
  const parsed = returnSchema.safeParse(req.body)
  if (!parsed.success) {
    return fail(res, 400, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบฟอร์ม', fromZodError(parsed.error))
  }

  const existing = await prisma.assignment.findFirst({
    where: { id: req.params.id, deletedAt: null, ...ACTIVE_ASSIGNMENT_WHERE },
    ...WITH_RELATIONS,
  })
  if (!existing) return fail(res, 404, 'ไม่พบรายการมอบหมายนี้ หรือถูกรับคืนไปแล้ว')

  const returnedAt = parsed.data.returnedAt || new Date()
  if (!ensureReturnDateIsValid(res, returnedAt, existing.assignedAt)) return
  const status = parsed.data.status || 'RETURNED'
  const conditionAfter = parsed.data.conditionAfter || existing.conditionBefore || existing.asset.assetCondition
  const inspectionNotes = parsed.data.remark || 'ตรวจรับผ่าน API รุ่นเดิม'
  const assignment = await finalizeReturn({
    assignmentId: existing.id, existing, req, status, conditionAfter,
    inspectionNotes, inspectedAt: returnedAt, returnedAt, remark: parsed.data.remark,
  }).catch((error) => {
    if (error.code === 'RETURN_ALREADY_CLOSED') return null
    throw error
  })
  if (!assignment) return fail(res, 409, 'รายการนี้ถูกรับคืนไปแล้ว')

  logAudit({
    ...auditContext(req), action: 'RETURN', entityType: 'Assignment', entityId: assignment.id,
    description: `รับคืน ${assignment.asset.assetTag} — ${assignment.asset.name} จาก ${assignmentHolderName(assignment)}`,
    oldValues: { returnedAt: existing.returnedAt, status: existing.status, conditionAfter: existing.conditionAfter, remark: existing.remark },
    newValues: { returnedAt, status, conditionAfter, remark: parsed.data.remark, employeeId: assignment.employeeId, employeeCode: assignment.employee?.employeeCode || null },
  })
  logInspectionAudit(req, assignment, status, inspectionResultFor(status), conditionAfter, inspectionNotes, returnedAt, returnedAt)

  ok(res, assignment)
}))

export default router

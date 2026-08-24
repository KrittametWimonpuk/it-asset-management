// ---------------------------------------------------------------------------
// Route: /api/employees — v1.1.0 Phase 1: Employee Management Foundation
//
// Employee เป็นข้อมูลบุคลากร ไม่ใช่บัญชี User และเป็น business identity ของผู้ถือครองตั้งแต่ Phase 2
// สิทธิ์: ADMIN = CRUD + archive/restore, IT_STAFF = read/create/update, EMPLOYEE = ไม่มีสิทธิ์
// ---------------------------------------------------------------------------
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { ok, fail, fromZodError } from '../utils/response.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { parsePagination, parseSort, buildPageMeta } from '../utils/queryParams.js'
import { optionalDate, optionalEmail, optionalText } from '../utils/zodHelpers.js'
import { logAudit, auditContext } from '../utils/auditLog.js'

const router = Router()

export const EMPLOYEE_STATUSES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'RESIGNED']
export const EMPLOYEE_SORTABLE_FIELDS = [
  'employeeCode', 'firstName', 'lastName', 'fullName', 'email', 'phone',
  'position', 'status', 'hireDate', 'isActive', 'createdAt', 'updatedAt',
]
export const EMPLOYEE_SEARCHABLE_FIELDS = ['employeeCode', 'fullName', 'email', 'phone']

const requiredName = (message) => z.string().trim().min(1, message).max(100, 'ต้องไม่เกิน 100 ตัวอักษร')
const employeeCode = z.string().trim()
  .min(1, 'กรุณาใส่รหัสพนักงาน')
  .max(50, 'รหัสพนักงานต้องไม่เกิน 50 ตัวอักษร')
  .transform((value) => value.toUpperCase())
const optionalDepartmentId = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.union([z.null(), z.string().uuid('แผนกไม่ถูกต้อง')]),
).optional()

export const employeeCreateSchema = z.object({
  employeeCode,
  firstName: requiredName('กรุณาใส่ชื่อ'),
  lastName: requiredName('กรุณาใส่นามสกุล'),
  email: optionalEmail(),
  phone: optionalText(),
  departmentId: optionalDepartmentId,
  position: optionalText(),
  status: z.enum(EMPLOYEE_STATUSES, { errorMap: () => ({ message: 'สถานะพนักงานไม่ถูกต้อง' }) }).optional(),
  hireDate: optionalDate('วันที่เริ่มงานไม่ถูกต้อง'),
  remark: optionalText(),
  isActive: z.boolean().optional(),
})

export const employeeUpdateSchema = employeeCreateSchema.partial()

const WITH_DEPARTMENT = {
  include: { department: { select: { id: true, name: true, isActive: true, deletedAt: true } } },
}
const NOT_FOUND_MESSAGE = 'ไม่พบข้อมูลพนักงานนี้'

export function employeeFullName(firstName, lastName) {
  return `${firstName.trim()} ${lastName.trim()}`.trim()
}

export function buildEmployeeListWhere(query) {
  const where = {}

  if (query.scope === 'archived') where.deletedAt = { not: null }
  else if (query.scope !== 'all') where.deletedAt = null

  if (EMPLOYEE_STATUSES.includes(query.status)) where.status = query.status
  if (query.departmentId) where.departmentId = query.departmentId
  if (query.isActive === 'true') where.isActive = true
  if (query.isActive === 'false') where.isActive = false

  const search = (query.search || '').trim()
  if (search) {
    where.OR = EMPLOYEE_SEARCHABLE_FIELDS.map((field) => ({
      [field]: { contains: search, mode: 'insensitive' },
    }))
  }

  return where
}

async function employeeCodeExists(code, excludeId) {
  if (!code) return false
  const duplicate = await prisma.employee.findFirst({
    where: { employeeCode: code, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  })
  return Boolean(duplicate)
}

async function invalidDepartment(departmentId) {
  if (!departmentId) return false
  const department = await prisma.department.findFirst({
    where: { id: departmentId, deletedAt: null, isActive: true },
    select: { id: true },
  })
  return !department
}

function duplicateCodeError(res) {
  const message = 'รหัสพนักงานนี้ถูกใช้ไปแล้ว'
  return fail(res, 409, message, [{ field: 'employeeCode', message }])
}

function departmentError(res) {
  const message = 'แผนกที่เลือกไม่ถูกต้อง ถูกปิดใช้งาน หรือถูกลบไปแล้ว'
  return fail(res, 400, message, [{ field: 'departmentId', message }])
}

// EMPLOYEE ไม่มีสิทธิ์เข้าถึง route ใดในโมดูลนี้
router.use(requireAuth, requireRole('ADMIN', 'IT_STAFF'))
const adminOnly = requireRole('ADMIN')

// ---- READ: list + pagination + sorting + filters + search ----
router.get('/', asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query)
  const orderBy = parseSort(req.query, EMPLOYEE_SORTABLE_FIELDS, 'createdAt')
  const where = buildEmployeeListWhere(req.query)

  const [items, totalItems] = await Promise.all([
    prisma.employee.findMany({ where, orderBy, skip: pagination.skip, take: pagination.take, ...WITH_DEPARTMENT }),
    prisma.employee.count({ where }),
  ])

  ok(res, { items, ...buildPageMeta(pagination, totalItems) })
}))

// ---- READ: single active employee ----
router.get('/:id', asyncHandler(async (req, res) => {
  const employee = await prisma.employee.findFirst({
    where: { id: req.params.id, deletedAt: null },
    ...WITH_DEPARTMENT,
  })
  if (!employee) return fail(res, 404, NOT_FOUND_MESSAGE)
  ok(res, employee)
}))

// ---- CREATE: ADMIN / IT_STAFF ----
router.post('/', asyncHandler(async (req, res) => {
  const parsed = employeeCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    return fail(res, 400, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบฟอร์ม', fromZodError(parsed.error))
  }
  if (await employeeCodeExists(parsed.data.employeeCode)) return duplicateCodeError(res)
  if (await invalidDepartment(parsed.data.departmentId)) return departmentError(res)

  const data = {
    ...parsed.data,
    fullName: employeeFullName(parsed.data.firstName, parsed.data.lastName),
  }
  const employee = await prisma.employee.create({ data, ...WITH_DEPARTMENT })

  logAudit({
    ...auditContext(req), action: 'CREATE', entityType: 'Employee', entityId: employee.id,
    description: `สร้างพนักงาน ${employee.employeeCode} — ${employee.fullName}`,
    newValues: data,
  })

  ok(res, employee, 201)
}))

// ---- UPDATE: ADMIN / IT_STAFF (archived employee cannot be edited) ----
router.put('/:id', asyncHandler(async (req, res) => {
  const parsed = employeeUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return fail(res, 400, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบฟอร์ม', fromZodError(parsed.error))
  }

  const existing = await prisma.employee.findFirst({ where: { id: req.params.id, deletedAt: null } })
  if (!existing) return fail(res, 404, NOT_FOUND_MESSAGE)
  if (parsed.data.employeeCode && await employeeCodeExists(parsed.data.employeeCode, existing.id)) return duplicateCodeError(res)
  if (await invalidDepartment(parsed.data.departmentId)) return departmentError(res)

  const data = { ...parsed.data }
  if (parsed.data.firstName !== undefined || parsed.data.lastName !== undefined) {
    data.fullName = employeeFullName(parsed.data.firstName ?? existing.firstName, parsed.data.lastName ?? existing.lastName)
  }

  const employee = await prisma.employee.update({ where: { id: existing.id }, data, ...WITH_DEPARTMENT })

  logAudit({
    ...auditContext(req), action: 'UPDATE', entityType: 'Employee', entityId: employee.id,
    description: `แก้ไขพนักงาน ${employee.employeeCode} — ${employee.fullName}`,
    oldValues: Object.fromEntries(Object.keys(data).map((key) => [key, existing[key]])),
    newValues: data,
  })

  ok(res, employee)
}))

// ---- DELETE: ADMIN only, soft delete ----
router.delete('/:id', adminOnly, asyncHandler(async (req, res) => {
  const existing = await prisma.employee.findFirst({ where: { id: req.params.id, deletedAt: null } })
  if (!existing) return fail(res, 404, NOT_FOUND_MESSAGE)

  const archivedAt = new Date()
  await prisma.employee.update({ where: { id: existing.id }, data: { deletedAt: archivedAt } })

  logAudit({
    ...auditContext(req), action: 'DELETE', entityType: 'Employee', entityId: existing.id,
    description: `เก็บพนักงานเข้าคลัง ${existing.employeeCode} — ${existing.fullName}`,
    oldValues: { deletedAt: null }, newValues: { deletedAt: archivedAt },
  })

  ok(res, { id: existing.id, deletedAt: archivedAt })
}))

// ---- RESTORE: ADMIN only ----
router.post('/:id/restore', adminOnly, asyncHandler(async (req, res) => {
  const existing = await prisma.employee.findFirst({ where: { id: req.params.id, deletedAt: { not: null } } })
  if (!existing) return fail(res, 404, 'ไม่พบข้อมูลพนักงานที่เก็บไว้')

  const employee = await prisma.employee.update({
    where: { id: existing.id }, data: { deletedAt: null }, ...WITH_DEPARTMENT,
  })

  logAudit({
    ...auditContext(req), action: 'RESTORE', entityType: 'Employee', entityId: employee.id,
    description: `กู้คืนพนักงาน ${employee.employeeCode} — ${employee.fullName}`,
    oldValues: { deletedAt: existing.deletedAt }, newValues: { deletedAt: null },
  })

  ok(res, employee)
}))

export default router

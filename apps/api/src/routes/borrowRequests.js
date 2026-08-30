import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ok, fail, fromZodError } from '../utils/response.js'
import { buildPageMeta, parsePagination, parseSort } from '../utils/queryParams.js'
import { optionalDate, optionalText } from '../utils/zodHelpers.js'
import { ACTIVE_ASSIGNMENT_WHERE } from '../utils/assignmentHelpers.js'
import {
  activeEmployeeForAccount,
  BORROW_REQUEST_RELATIONS,
  BORROW_REQUEST_STATUSES,
  borrowRequestScopeForAccount,
  nextBorrowRequestNumber,
} from '../utils/borrowRequestHelpers.js'
import { auditContext, logAudit } from '../utils/auditLog.js'
import { notifyEmployee, notifyStaff } from '../services/notificationService.js'

const router = Router()
router.use(requireAuth)

const approveOrReject = requireRole('ADMIN', 'IT_STAFF')
const employeeOnly = requireRole('EMPLOYEE')
const SORTABLE_FIELDS = ['requestedAt', 'expectedReturnDate', 'requestNumber', 'status', 'updatedAt']

export const borrowRequestCreateSchema = z.object({
  assetId: z.string().trim().min(1, 'กรุณาเลือกครุภัณฑ์'),
  expectedReturnDate: optionalDate('วันที่คาดว่าจะคืนไม่ถูกต้อง'),
  reason: z.string().trim().min(3, 'กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร').max(1000, 'เหตุผลยาวเกินไป'),
  remark: optionalText(),
})

export const borrowRequestRejectSchema = z.object({
  rejectedReason: z.string().trim().min(3, 'กรุณาระบุเหตุผลที่ปฏิเสธอย่างน้อย 3 ตัวอักษร').max(1000, 'เหตุผลยาวเกินไป'),
  comment: z.string().trim().max(1000, 'ความคิดเห็นยาวเกินไป').nullable().transform((value) => value || null).optional(),
})

export const borrowRequestApproveSchema = z.object({
  comment: z.string().trim().max(1000, 'ความคิดเห็นยาวเกินไป').nullable().transform((value) => value || null).optional(),
})

export function buildBorrowRequestListWhere(query, user) {
  const constraints = []
  const scope = borrowRequestScopeForAccount(user)
  if (Object.keys(scope).length) constraints.push(scope)

  const search = (query.search || '').trim()
  if (search) {
    constraints.push({ OR: [
      { requestNumber: { contains: search, mode: 'insensitive' } },
      { employee: { employeeCode: { contains: search, mode: 'insensitive' } } },
      { employee: { fullName: { contains: search, mode: 'insensitive' } } },
      { employee: { department: { name: { contains: search, mode: 'insensitive' } } } },
      { asset: { assetTag: { contains: search, mode: 'insensitive' } } },
      { asset: { name: { contains: search, mode: 'insensitive' } } },
      { reason: { contains: search, mode: 'insensitive' } },
      { remark: { contains: search, mode: 'insensitive' } },
      { approvalHistory: { some: { comment: { contains: search, mode: 'insensitive' } } } },
      { approvalHistory: { some: { actorUser: { name: { contains: search, mode: 'insensitive' } } } } },
    ] })
  }

  const where = { deletedAt: null }
  if (constraints.length) where.AND = constraints
  if (BORROW_REQUEST_STATUSES.includes(query.status)) where.status = query.status
  if (query.assetId) where.assetId = query.assetId
  if (query.employeeId && user.role !== 'EMPLOYEE') where.employeeId = query.employeeId
  return where
}

router.get('/', asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query)
  const orderBy = parseSort(req.query, SORTABLE_FIELDS, 'requestedAt')
  const where = buildBorrowRequestListWhere(req.query, req.user)
  const [items, totalItems] = await Promise.all([
    prisma.borrowRequest.findMany({ where, orderBy, skip: pagination.skip, take: pagination.take, ...BORROW_REQUEST_RELATIONS }),
    prisma.borrowRequest.count({ where }),
  ])
  ok(res, { items, ...buildPageMeta(pagination, totalItems) })
}))

// รายการครุภัณฑ์ที่ EMPLOYEE ใช้ในฟอร์มคำขอ — ไม่เปลี่ยนขอบเขตของ GET /assets เดิม
router.get('/options/assets', employeeOnly, asyncHandler(async (req, res) => {
  const search = (req.query.search || '').trim()
  const where = {
    deletedAt: null,
    assignments: { none: ACTIVE_ASSIGNMENT_WHERE },
    ...(search ? { OR: [
      { assetTag: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
      { hostname: { contains: search, mode: 'insensitive' } },
    ] } : {}),
  }
  const items = await prisma.asset.findMany({
    where, orderBy: { assetTag: 'asc' }, take: 100,
    select: { id: true, assetTag: true, name: true, status: true, hostname: true },
  })
  ok(res, { items })
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const item = await prisma.borrowRequest.findFirst({
    where: { id: req.params.id, deletedAt: null, ...borrowRequestScopeForAccount(req.user) },
    ...BORROW_REQUEST_RELATIONS,
  })
  if (!item) return fail(res, 404, 'ไม่พบคำขอยืมนี้ หรือคุณไม่มีสิทธิ์เข้าถึง')
  ok(res, item)
}))

router.post('/', employeeOnly, asyncHandler(async (req, res) => {
  const parsed = borrowRequestCreateSchema.safeParse(req.body)
  if (!parsed.success) return fail(res, 400, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบฟอร์ม', fromZodError(parsed.error))

  const employee = await activeEmployeeForAccount(req.user)
  if (!employee) {
    return fail(res, 403, 'บัญชีนี้ยังไม่ได้เชื่อมกับพนักงานสถานะ ACTIVE จึงไม่สามารถส่งคำขอได้')
  }

  const [asset, activeAssignment] = await Promise.all([
    prisma.asset.findFirst({ where: { id: parsed.data.assetId, deletedAt: null }, select: { id: true, assetTag: true, name: true } }),
    prisma.assignment.findFirst({ where: { assetId: parsed.data.assetId, ...ACTIVE_ASSIGNMENT_WHERE }, select: { id: true } }),
  ])
  if (!asset) return fail(res, 400, 'ไม่พบครุภัณฑ์ที่เลือก')
  if (activeAssignment) return fail(res, 409, 'ครุภัณฑ์นี้มีผู้ถือครองอยู่แล้ว')

  const requestedAt = new Date()
  const requestedDay = new Date(requestedAt)
  requestedDay.setUTCHours(0, 0, 0, 0)
  if (parsed.data.expectedReturnDate && parsed.data.expectedReturnDate < requestedDay) {
    const message = 'วันที่คาดว่าจะคืนต้องไม่ก่อนวันที่ส่งคำขอ'
    return fail(res, 400, message, [{ field: 'expectedReturnDate', message }])
  }

  const item = await prisma.$transaction(async (tx) => {
    const requestNumber = await nextBorrowRequestNumber(tx)
    return tx.borrowRequest.create({
      data: {
        ...parsed.data, requestNumber, requestedAt, employeeId: employee.id,
        approvalHistory: { create: { action: 'STARTED', actorUserId: req.user.id } },
      },
      ...BORROW_REQUEST_RELATIONS,
    })
  })

  await logAudit({
    ...auditContext(req), action: 'BORROW_REQUEST_CREATED', entityType: 'BorrowRequest', entityId: item.id,
    description: `สร้างคำขอยืม ${item.requestNumber}: ${asset.assetTag} — ${asset.name}`,
    newValues: { requestNumber: item.requestNumber, employeeId: employee.id, assetId: asset.id, status: 'PENDING' },
  })
  await logAudit({
    ...auditContext(req), action: 'APPROVAL_STARTED', entityType: 'BorrowRequest', entityId: item.id,
    description: `เริ่มกระบวนการอนุมัติ ${item.requestNumber}`,
    newValues: { requestNumber: item.requestNumber, status: 'PENDING' },
  })
  await notifyStaff({
    title: `คำขอยืมใหม่ ${item.requestNumber}`,
    message: `${item.employee.fullName} ขอใช้ ${item.asset.assetTag} — ${item.asset.name}`,
    type: 'BORROW_REQUEST', priority: 'HIGH', templateKey: 'BORROW_REQUEST_SUBMITTED', auditContext: auditContext(req),
  })
  await notifyEmployee(item.employeeId, {
    title: `รับคำขอยืม ${item.requestNumber} แล้ว`,
    message: `ระบบได้รับคำขอใช้ ${item.asset.assetTag} — ${item.asset.name} และกำลังรอการพิจารณา`,
    type: 'BORROW_REQUEST', priority: 'NORMAL', templateKey: 'BORROW_REQUEST_SUBMITTED', auditContext: auditContext(req),
  })
  ok(res, item, 201)
}))

router.post('/:id/approve', approveOrReject, asyncHandler(async (req, res) => {
  const parsed = borrowRequestApproveSchema.safeParse(req.body || {})
  if (!parsed.success) return fail(res, 400, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบความคิดเห็น', fromZodError(parsed.error))
  let result
  try {
    result = await prisma.$transaction(async (tx) => {
      const request = await tx.borrowRequest.findFirst({
        where: { id: req.params.id, status: 'PENDING', deletedAt: null },
        ...BORROW_REQUEST_RELATIONS,
      })
      if (!request) return { error: [404, 'ไม่พบคำขอที่รออนุมัติ หรือคำขอนี้ถูกดำเนินการแล้ว'] }

      const employee = await tx.employee.findFirst({
        where: { id: request.employeeId, status: 'ACTIVE', isActive: true, deletedAt: null },
        select: { id: true, email: true },
      })
      if (!employee) return { error: [409, 'พนักงานไม่อยู่ในสถานะ ACTIVE แล้ว จึงไม่สามารถอนุมัติได้'] }

      const activeAssignment = await tx.assignment.findFirst({
        where: { assetId: request.assetId, ...ACTIVE_ASSIGNMENT_WHERE }, select: { id: true },
      })
      if (activeAssignment) return { error: [409, 'ครุภัณฑ์นี้ถูกมอบหมายไปแล้ว ไม่สามารถอนุมัติคำขอนี้ได้'] }

      let legacyUser = await tx.user.findUnique({ where: { employeeId: employee.id }, select: { id: true } })
      if (!legacyUser && employee.email) {
        const accounts = await tx.user.findMany({
          where: { email: { equals: employee.email, mode: 'insensitive' } },
          select: { id: true },
          take: 2,
        })
        legacyUser = accounts.length === 1 ? accounts[0] : null
      }
      const assetChanged = await tx.asset.updateMany({
        where: { id: request.assetId, deletedAt: null, status: 'AVAILABLE' },
        data: { status: 'IN_USE' },
      })
      if (assetChanged.count !== 1) return { error: [409, 'ครุภัณฑ์ไม่อยู่ในสถานะพร้อมใช้งานแล้ว'] }
      const assignment = await tx.assignment.create({
        data: {
          assetId: request.assetId, employeeId: request.employeeId, userId: legacyUser?.id,
          assignedById: req.user.id, assignedAt: new Date(),
          expectedReturnDate: request.expectedReturnDate,
          remark: request.remark || `สร้างจากคำขอยืม ${request.requestNumber}`,
        },
      })
      const item = await tx.borrowRequest.update({
        where: { id: request.id },
        data: { status: 'COMPLETED', approvedByUserId: req.user.id, approvedAt: new Date() },
        ...BORROW_REQUEST_RELATIONS,
      })
      await tx.borrowRequestApproval.create({
        data: {
          borrowRequestId: request.id, action: 'APPROVED', actorUserId: req.user.id,
          comment: parsed.data.comment,
        },
      })
      const itemWithHistory = await tx.borrowRequest.findUnique({
        where: { id: request.id }, ...BORROW_REQUEST_RELATIONS,
      })
      return { item: itemWithHistory || item, assignment }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  } catch (err) {
    if (err?.code === 'P2002' || err?.code === 'P2034') {
      return fail(res, 409, 'ครุภัณฑ์นี้เพิ่งถูกมอบหมายโดยรายการอื่น กรุณาโหลดข้อมูลใหม่')
    }
    throw err
  }

  if (result.error) return fail(res, ...result.error)
  await logAudit({
    ...auditContext(req), action: 'BORROW_REQUEST_APPROVED', entityType: 'BorrowRequest', entityId: result.item.id,
    description: `อนุมัติ ${result.item.requestNumber} และสร้างการมอบหมายอัตโนมัติ`,
    newValues: { status: 'COMPLETED', assignmentId: result.assignment.id, employeeId: result.item.employeeId, assetId: result.item.assetId },
  })
  await logAudit({
    ...auditContext(req), action: 'APPROVAL_APPROVED', entityType: 'BorrowRequest', entityId: result.item.id,
    description: `ตัดสินใจอนุมัติ ${result.item.requestNumber}`,
    oldValues: { status: 'PENDING' },
    newValues: { status: 'COMPLETED', comment: parsed.data.comment, approvedAt: result.item.approvedAt },
  })
  await logAudit({
    ...auditContext(req), action: 'ASSIGN', entityType: 'Assignment', entityId: result.assignment.id,
    description: `สร้างการมอบหมายอัตโนมัติจาก ${result.item.requestNumber}`,
    newValues: { borrowRequestId: result.item.id, employeeId: result.item.employeeId, assetId: result.item.assetId },
  })
  await notifyEmployee(result.item.employeeId, {
    title: `คำขอยืม ${result.item.requestNumber} ได้รับอนุมัติ`,
    message: `${result.item.asset.assetTag} — ${result.item.asset.name} ได้รับอนุมัติและสร้างการมอบหมายแล้ว`,
    type: 'APPROVAL', priority: 'NORMAL', templateKey: 'BORROW_REQUEST_APPROVED', auditContext: auditContext(req),
  })
  await notifyEmployee(result.item.employeeId, {
    title: `ได้รับมอบหมาย ${result.item.asset.assetTag}`,
    message: `คุณเป็นผู้ถือครอง ${result.item.asset.name} จากคำขอ ${result.item.requestNumber}`,
    type: 'ASSIGNMENT', priority: 'NORMAL', templateKey: 'ASSET_ASSIGNED', auditContext: auditContext(req),
  })
  ok(res, { ...result.item, assignmentId: result.assignment.id })
}))

router.post('/:id/reject', approveOrReject, asyncHandler(async (req, res) => {
  const parsed = borrowRequestRejectSchema.safeParse(req.body)
  if (!parsed.success) return fail(res, 400, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบฟอร์ม', fromZodError(parsed.error))
  const item = await prisma.$transaction(async (tx) => {
    const changed = await tx.borrowRequest.updateMany({
      where: { id: req.params.id, status: 'PENDING', deletedAt: null },
      data: { rejectedReason: parsed.data.rejectedReason, status: 'REJECTED' },
    })
    if (changed.count !== 1) return null
    await tx.borrowRequestApproval.create({
      data: {
        borrowRequestId: req.params.id, action: 'REJECTED', actorUserId: req.user.id,
        comment: parsed.data.comment,
      },
    })
    return tx.borrowRequest.findUnique({ where: { id: req.params.id }, ...BORROW_REQUEST_RELATIONS })
  })
  if (!item) return fail(res, 404, 'ไม่พบคำขอที่รออนุมัติ หรือคำขอนี้ถูกดำเนินการแล้ว')
  await logAudit({
    ...auditContext(req), action: 'BORROW_REQUEST_REJECTED', entityType: 'BorrowRequest', entityId: item.id,
    description: `ปฏิเสธคำขอยืม ${item.requestNumber}: ${item.rejectedReason}`,
    oldValues: { status: 'PENDING' }, newValues: { status: 'REJECTED', rejectedReason: item.rejectedReason },
  })
  await logAudit({
    ...auditContext(req), action: 'APPROVAL_REJECTED', entityType: 'BorrowRequest', entityId: item.id,
    description: `ตัดสินใจปฏิเสธ ${item.requestNumber}`,
    oldValues: { status: 'PENDING' },
    newValues: { status: 'REJECTED', rejectedReason: item.rejectedReason, comment: parsed.data.comment },
  })
  await notifyEmployee(item.employeeId, {
    title: `คำขอยืม ${item.requestNumber} ไม่ได้รับอนุมัติ`,
    message: `เหตุผล: ${item.rejectedReason}`,
    type: 'APPROVAL', priority: 'HIGH', templateKey: 'BORROW_REQUEST_REJECTED', auditContext: auditContext(req),
  })
  ok(res, item)
}))

router.post('/:id/cancel', employeeOnly, asyncHandler(async (req, res) => {
  const changed = await prisma.borrowRequest.updateMany({
    where: { id: req.params.id, status: 'PENDING', deletedAt: null, ...borrowRequestScopeForAccount(req.user) },
    data: { status: 'CANCELLED' },
  })
  if (changed.count !== 1) return fail(res, 404, 'ไม่พบคำขอที่ยกเลิกได้ หรือคำขอนี้ถูกดำเนินการแล้ว')
  const item = await prisma.borrowRequest.findUnique({ where: { id: req.params.id }, ...BORROW_REQUEST_RELATIONS })
  await logAudit({
    ...auditContext(req), action: 'BORROW_REQUEST_CANCELLED', entityType: 'BorrowRequest', entityId: item.id,
    description: `ยกเลิกคำขอยืม ${item.requestNumber}`,
    oldValues: { status: 'PENDING' }, newValues: { status: 'CANCELLED' },
  })
  ok(res, item)
}))

export default router

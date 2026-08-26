// ---------------------------------------------------------------------------
// Route: /api/reports — Milestone 8: Reports & Export
//
// ทุกรายงานอ่านข้อมูลจากตารางที่มีอยู่แล้วเท่านั้น (Asset/Assignment/Ticket/Category/Location/
// Department/Vendor) ไม่มี business logic ใหม่ — RBAC scoping ใช้ scopeForRead ตัวเดียวกับที่
// routes/assets.js, routes/assignments.js, routes/tickets.js ใช้จริง (import มาตรง ๆ) กันไม่ให้
// เขียนเงื่อนไขสิทธิ์ซ้ำแล้วพลาดไม่ตรงกัน ซึ่งจะกลายเป็นช่องโหว่รั่วข้อมูลข้ามขอบเขต
//
// สิทธิ์ (business rule ของ milestone นี้):
//   - ADMIN / IT_STAFF: ดูรายงานได้ทุกตัว แบบภาพรวมทั้งองค์กร
//   - EMPLOYEE: ดู Asset/Assignment/Warranty/Helpdesk ได้เฉพาะของตัวเอง (ใช้ scopeForRead เดิม)
//     ส่วน Department Summary/Vendor Summary เป็นสรุปภาพรวมองค์กรล้วน ๆ — EMPLOYEE เข้าไม่ได้เลย (403)
//
// โหมดการตอบกลับ:
//   - ไม่ส่ง ?format= มา (หรือส่งค่าที่ไม่รู้จัก) -> ตอบ JSON ผ่าน response envelope ปกติ พร้อมแบ่งหน้า
//     (ใช้แสดงหน้า Preview ในเว็บ)
//   - ?format=csv | xlsx | pdf -> สร้างไฟล์ส่งกลับตรง ๆ (ไม่ใช่ JSON envelope — เป็นข้อยกเว้นที่ตั้งใจ
//     เพราะเป็นการดาวน์โหลดไฟล์ ไม่ใช่ endpoint ที่ frontend เอาไป render) ดึงข้อมูลตามตัวกรองและ
//     ขอบเขตสิทธิ์ สูงสุด REPORT_EXPORT_LIMIT แถวเพื่อกัน memory exhaustion ใน production
// ---------------------------------------------------------------------------
import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { ok } from '../utils/response.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { parsePagination, parseSort, buildPageMeta } from '../utils/queryParams.js'
import {
  ACTIVE_ASSIGNMENT_WHERE,
  CURRENT_ASSIGNMENT_INCLUDE,
  EMPLOYEE_SUMMARY_SELECT,
  LEGACY_HOLDER_SELECT,
  assignmentHolderName,
} from '../utils/assignmentHelpers.js'
import { parseReportQuery, dateRangeWhere, warrantyBucketWhere, warrantyInfo, sendExport } from '../utils/reportHelpers.js'
import { logAudit, auditContext } from '../utils/auditLog.js'
import {
  ASSET_STATUSES, SEARCHABLE_FIELDS as ASSET_SEARCH_FIELDS, scopeForRead as assetScopeForRead,
} from './assets.js'
import {
  ASSIGNMENT_STATUSES, SEARCHABLE_ASSET_FIELDS as ASSIGNMENT_ASSET_SEARCH_FIELDS,
  scopeForRead as assignmentScopeForRead,
} from './assignments.js'
import {
  TICKET_PRIORITIES, TICKET_STATUSES, TICKET_CATEGORIES,
  SEARCHABLE_TICKET_FIELDS, SEARCHABLE_ASSET_FIELDS as TICKET_ASSET_SEARCH_FIELDS,
  scopeForRead as ticketScopeForRead,
} from './tickets.js'
import {
  BORROW_REQUEST_RELATIONS, BORROW_REQUEST_STATUSES, borrowRequestScopeForAccount,
} from '../utils/borrowRequestHelpers.js'
import { NOTIFICATION_PRIORITIES, NOTIFICATION_TYPES } from '../services/notificationService.js'

const router = Router()
const REPORT_EXPORT_LIMIT = 25_000

// requireAuth ครอบทุก route ในไฟล์นี้ — /departments, /vendors ยังต้องผ่าน orgWideOnly เพิ่มอีกชั้น
router.use(requireAuth)

// Department Summary / Vendor Summary เป็นภาพรวมทั้งองค์กรล้วน ๆ ไม่มีทาง scope ให้เหลือแค่ "ของตัวเอง"
// ได้อย่างมีความหมาย — กันไว้ทั้งหมดตั้งแต่ต้นทาง ไม่ใช่แค่ซ่อนปุ่มฝั่ง frontend (Never expose org-wide data)
const orgWideOnly = requireRole('ADMIN', 'IT_STAFF')

// ป้ายภาษาไทย — ให้ตรงกับที่ frontend ใช้อยู่แล้ว (AssetForm/TicketForm/ReturnAssignmentForm OPTIONS)
const ASSET_STATUS_LABELS = {
  AVAILABLE: 'พร้อมใช้งาน', IN_USE: 'กำลังใช้งาน', REPAIR: 'ซ่อมบำรุง',
  DISPOSED: 'เลิกใช้งาน', LOST: 'สูญหาย', MAINTENANCE: 'รอตรวจสอบ/ซ่อมบำรุง',
}
const ASSET_CONDITION_LABELS = { NEW: 'ใหม่', GOOD: 'สภาพดี', FAIR: 'สภาพปานกลาง', POOR: 'สภาพไม่ดี', DAMAGED: 'ชำรุด' }
const ASSIGNMENT_STATUS_LABELS = { ASSIGNED: 'กำลังถือครอง', RETURNED: 'คืนแล้ว', LOST: 'สูญหาย', DAMAGED: 'เสียหาย' }
const TICKET_PRIORITY_LABELS = { LOW: 'ต่ำ', MEDIUM: 'ปานกลาง', HIGH: 'สูง', CRITICAL: 'วิกฤต' }
const TICKET_STATUS_LABELS = { OPEN: 'เปิดใหม่', IN_PROGRESS: 'กำลังดำเนินการ', ON_HOLD: 'พักงาน', RESOLVED: 'แก้ไขสำเร็จ', CLOSED: 'ปิดงานแล้ว' }
const BORROW_REQUEST_STATUS_LABELS = {
  PENDING: 'รออนุมัติ', APPROVED: 'อนุมัติแล้ว', REJECTED: 'ปฏิเสธ', CANCELLED: 'ยกเลิก', COMPLETED: 'ดำเนินการเสร็จสิ้น',
}

// ตัด T + เวลาออก เหลือแค่ yyyy-mm-dd — เพียงพอสำหรับรายงาน (export ไม่จำเป็นต้องมีเวลาละเอียดระดับวินาที)
function fmtDate(v) {
  return v ? new Date(v).toISOString().slice(0, 10) : ''
}

// บันทึก audit log ตอน export ไฟล์สำเร็จ — ใช้ร่วมกันทั้ง 10 รายงาน กันไม่ต้องเขียนซ้ำทุก endpoint
// เรียกก่อน sendExport และ await durable outbox เพื่อไม่ให้หลักฐานการ export สูญหาย
async function logReportExport(req, reportLabel, format) {
  await logAudit({
    ...auditContext(req), action: 'EXPORT_REPORT', entityType: 'Report',
    description: `ส่งออกรายงาน${reportLabel} (${format.toUpperCase()})`,
    newValues: { format },
  })
}

// ---------------------------------------------------------------------------
// รายงานที่ 1: Asset Inventory
// ---------------------------------------------------------------------------
const ASSET_REPORT_COLUMNS = [
  { key: 'assetTag', label: 'Asset Tag' },
  { key: 'name', label: 'ชื่ออุปกรณ์' },
  { key: 'category', label: 'หมวดหมู่' },
  { key: 'location', label: 'สถานที่ตั้ง' },
  { key: 'department', label: 'แผนก' },
  { key: 'vendor', label: 'ผู้ขาย/ผู้ผลิต' },
  { key: 'status', label: 'สถานะ' },
  { key: 'currentHolder', label: 'ผู้ถือครองปัจจุบัน' },
  { key: 'warrantyExpiry', label: 'วันหมดประกัน' },
  { key: 'purchaseDate', label: 'วันที่ซื้อ' },
  { key: 'purchasePrice', label: 'ราคาซื้อ' },
]
const ASSET_REPORT_SORTABLE = ['assetTag', 'name', 'status', 'warrantyExpiry', 'purchaseDate', 'purchasePrice']

function shapeAssetRow(asset) {
  const holder = asset.assignments?.[0]
  return {
    assetTag: asset.assetTag,
    name: asset.name,
    category: asset.category?.name || '-',
    location: asset.location?.name || '-',
    department: asset.department?.name || '-',
    vendor: asset.vendor?.name || '-',
    status: ASSET_STATUS_LABELS[asset.status] || asset.status,
    currentHolder: holder ? assignmentHolderName(holder) : 'ไม่มีผู้ถือครอง',
    warrantyExpiry: fmtDate(asset.warrantyExpiry),
    purchaseDate: fmtDate(asset.purchaseDate),
    purchasePrice: asset.purchasePrice ?? '',
  }
}

function buildAssetReportWhere(req, f) {
  const where = { ...assetScopeForRead(req.user), ...dateRangeWhere('purchaseDate', f.dateFrom, f.dateTo) }
  if (f.categoryId) where.categoryId = f.categoryId
  if (f.locationId) where.locationId = f.locationId
  if (f.departmentId) where.departmentId = f.departmentId
  if (f.vendorId) where.vendorId = f.vendorId
  if (ASSET_STATUSES.includes(f.status)) where.status = f.status
  if (f.search) {
    where.OR = ASSET_SEARCH_FIELDS.map((field) => ({ [field]: { contains: f.search, mode: 'insensitive' } }))
  }
  return where
}

router.get('/assets', asyncHandler(async (req, res) => {
  const f = parseReportQuery(req.query)
  const where = buildAssetReportWhere(req, f)
  const include = {
    category: { select: { name: true } },
    location: { select: { name: true } },
    department: { select: { name: true } },
    vendor: { select: { name: true } },
    assignments: CURRENT_ASSIGNMENT_INCLUDE,
  }

  if (!f.format) {
    const pagination = parsePagination(req.query)
    const orderBy = parseSort(req.query, ASSET_REPORT_SORTABLE, 'assetTag')
    const [items, totalItems] = await Promise.all([
      prisma.asset.findMany({ where, orderBy, skip: pagination.skip, take: pagination.take, include }),
      prisma.asset.count({ where }),
    ])
    return ok(res, { items: items.map(shapeAssetRow), ...buildPageMeta(pagination, totalItems) })
  }

  const rows = await prisma.asset.findMany({ where, orderBy: { assetTag: 'asc' }, take: REPORT_EXPORT_LIMIT, include })
  await logReportExport(req, 'ครุภัณฑ์คงเหลือ', f.format)
  return sendExport(res, f.format, 'asset-inventory-report', 'รายงานครุภัณฑ์คงเหลือ', ASSET_REPORT_COLUMNS, rows.map(shapeAssetRow))
}))

// ---------------------------------------------------------------------------
// รายงานที่ 2: Asset Assignment
// ---------------------------------------------------------------------------
const ASSIGNMENT_REPORT_COLUMNS = [
  { key: 'asset', label: 'ครุภัณฑ์' },
  { key: 'employeeCode', label: 'รหัสพนักงาน' },
  { key: 'employeeName', label: 'ชื่อพนักงาน' },
  { key: 'department', label: 'แผนก' },
  { key: 'position', label: 'ตำแหน่ง' },
  { key: 'assignedDate', label: 'วันที่มอบหมาย' },
  { key: 'returnedDate', label: 'วันที่คืน' },
  { key: 'status', label: 'สถานะการมอบหมาย' },
  { key: 'conditionBefore', label: 'สภาพก่อนมอบหมาย' },
  { key: 'conditionAfter', label: 'สภาพหลังคืน' },
  { key: 'remark', label: 'หมายเหตุ' },
]
const ASSIGNMENT_REPORT_SORTABLE = ['assignedAt', 'returnedAt', 'status']

function shapeAssignmentRow(a) {
  return {
    asset: `${a.asset?.assetTag ?? ''} — ${a.asset?.name ?? ''}`,
    employeeCode: a.employee?.employeeCode || '-',
    employeeName: assignmentHolderName(a),
    department: a.employee?.department?.name || '-',
    position: a.employee?.position || '-',
    assignedDate: fmtDate(a.assignedAt),
    returnedDate: fmtDate(a.returnedAt),
    status: ASSIGNMENT_STATUS_LABELS[a.status] || a.status,
    conditionBefore: a.conditionBefore ? (ASSET_CONDITION_LABELS[a.conditionBefore] || a.conditionBefore) : '-',
    conditionAfter: a.conditionAfter ? (ASSET_CONDITION_LABELS[a.conditionAfter] || a.conditionAfter) : '-',
    remark: a.remark || '',
  }
}

function buildAssignmentReportWhere(req, f) {
  const where = { deletedAt: null, ...dateRangeWhere('assignedAt', f.dateFrom, f.dateTo) }
  const constraints = []
  const readScope = assignmentScopeForRead(req.user)
  if (Object.keys(readScope).length) constraints.push(readScope)
  const assetFilter = {}
  if (f.categoryId) assetFilter.categoryId = f.categoryId
  if (f.locationId) assetFilter.locationId = f.locationId
  if (f.departmentId) assetFilter.departmentId = f.departmentId
  if (f.vendorId) assetFilter.vendorId = f.vendorId
  if (Object.keys(assetFilter).length) where.asset = assetFilter
  if (ASSIGNMENT_STATUSES.includes(f.assignmentStatus)) where.status = f.assignmentStatus
  if (f.search) {
    constraints.push({ OR: [
      ...ASSIGNMENT_ASSET_SEARCH_FIELDS.map((field) => ({ asset: { [field]: { contains: f.search, mode: 'insensitive' } } })),
      { employee: { employeeCode: { contains: f.search, mode: 'insensitive' } } },
      { employee: { fullName: { contains: f.search, mode: 'insensitive' } } },
      { employee: { department: { name: { contains: f.search, mode: 'insensitive' } } } },
      { user: { name: { contains: f.search, mode: 'insensitive' } } },
    ] })
  }
  if (constraints.length) where.AND = constraints
  return where
}

const ASSIGNMENT_REPORT_INCLUDE = {
  include: {
    asset: { select: { assetTag: true, name: true } },
    employee: { select: EMPLOYEE_SUMMARY_SELECT },
    user: { select: LEGACY_HOLDER_SELECT },
  },
}

router.get('/assignments', asyncHandler(async (req, res) => {
  const f = parseReportQuery(req.query)
  const where = buildAssignmentReportWhere(req, f)

  if (!f.format) {
    const pagination = parsePagination(req.query)
    const orderBy = parseSort(req.query, ASSIGNMENT_REPORT_SORTABLE, 'assignedAt')
    const [items, totalItems] = await Promise.all([
      prisma.assignment.findMany({ where, orderBy, skip: pagination.skip, take: pagination.take, ...ASSIGNMENT_REPORT_INCLUDE }),
      prisma.assignment.count({ where }),
    ])
    return ok(res, { items: items.map(shapeAssignmentRow), ...buildPageMeta(pagination, totalItems) })
  }

  const rows = await prisma.assignment.findMany({ where, orderBy: { assignedAt: 'desc' }, take: REPORT_EXPORT_LIMIT, ...ASSIGNMENT_REPORT_INCLUDE })
  await logReportExport(req, 'การมอบหมายครุภัณฑ์', f.format)
  return sendExport(res, f.format, 'assignment-report', 'รายงานการมอบหมายครุภัณฑ์', ASSIGNMENT_REPORT_COLUMNS, rows.map(shapeAssignmentRow))
}))

// ---------------------------------------------------------------------------
// v1.1.0 Phase 5: Return Report
// ---------------------------------------------------------------------------
const RETURN_REPORT_COLUMNS = [
  { key: 'employee', label: 'พนักงาน' },
  { key: 'asset', label: 'ครุภัณฑ์' },
  { key: 'returnDate', label: 'วันที่คืน' },
  { key: 'inspector', label: 'ผู้ตรวจรับ' },
  { key: 'condition', label: 'สภาพหลังคืน' },
  { key: 'inspectionResult', label: 'ผลการตรวจ' },
  { key: 'returnStatus', label: 'สถานะการรับคืน' },
  { key: 'processingTimeHours', label: 'ระยะเวลาดำเนินการ (ชั่วโมง)' },
]
const RETURN_REPORT_SORTABLE = ['returnStartedAt', 'inspectedAt', 'returnedAt', 'returnStatus']
const RETURN_STATUS_LABELS = {
  PENDING_INSPECTION: 'รอตรวจรับ', PASSED: 'ผ่านการตรวจ', FAILED: 'ไม่ผ่านการตรวจ',
  RETURNED: 'คืนเสร็จสมบูรณ์', DAMAGED: 'ชำรุด', LOST: 'สูญหาย',
}

function shapeReturnRow(assignment) {
  const duration = assignment.returnStartedAt && assignment.returnedAt
    ? Math.max(0, (assignment.returnedAt - assignment.returnStartedAt) / 3600000)
    : null
  return {
    employee: `${assignment.employee?.employeeCode || '-'} — ${assignmentHolderName(assignment)}`,
    asset: `${assignment.asset?.assetTag || '-'} — ${assignment.asset?.name || '-'}`,
    returnDate: fmtDate(assignment.returnedAt),
    inspector: assignment.inspectedBy?.name || assignment.inspectedBy?.email || 'ไม่ทราบผู้ตรวจ',
    condition: assignment.conditionAfter ? (ASSET_CONDITION_LABELS[assignment.conditionAfter] || assignment.conditionAfter) : '-',
    inspectionResult: assignment.inspectionResult ? (RETURN_STATUS_LABELS[assignment.inspectionResult] || assignment.inspectionResult) : 'ไม่มีข้อมูลย้อนหลัง',
    returnStatus: RETURN_STATUS_LABELS[assignment.returnStatus] || assignment.returnStatus || '-',
    processingTimeHours: duration === null ? '-' : Math.round(duration * 10) / 10,
  }
}

function buildReturnReportWhere(req, f) {
  const constraints = [
    { OR: [{ returnStatus: { not: null } }, { returnedAt: { not: null } }] },
  ]
  const readScope = assignmentScopeForRead(req.user)
  if (Object.keys(readScope).length) constraints.push(readScope)
  if (f.search) constraints.push({ OR: [
    ...ASSIGNMENT_ASSET_SEARCH_FIELDS.map((field) => ({ asset: { [field]: { contains: f.search, mode: 'insensitive' } } })),
    { employee: { employeeCode: { contains: f.search, mode: 'insensitive' } } },
    { employee: { fullName: { contains: f.search, mode: 'insensitive' } } },
    { user: { name: { contains: f.search, mode: 'insensitive' } } },
    { inspectedBy: { name: { contains: f.search, mode: 'insensitive' } } },
  ] })
  return { deletedAt: null, ...dateRangeWhere('returnStartedAt', f.dateFrom, f.dateTo), AND: constraints }
}

const RETURN_REPORT_INCLUDE = {
  include: {
    asset: { select: { assetTag: true, name: true } },
    employee: { select: EMPLOYEE_SUMMARY_SELECT },
    user: { select: LEGACY_HOLDER_SELECT },
    inspectedBy: { select: { id: true, name: true, email: true } },
  },
}

router.get('/returns', asyncHandler(async (req, res) => {
  const f = parseReportQuery(req.query)
  const where = buildReturnReportWhere(req, f)
  if (!f.format) {
    const pagination = parsePagination(req.query)
    const orderBy = parseSort(req.query, RETURN_REPORT_SORTABLE, 'returnStartedAt')
    const [items, totalItems] = await Promise.all([
      prisma.assignment.findMany({ where, orderBy, skip: pagination.skip, take: pagination.take, ...RETURN_REPORT_INCLUDE }),
      prisma.assignment.count({ where }),
    ])
    return ok(res, { items: items.map(shapeReturnRow), ...buildPageMeta(pagination, totalItems) })
  }
  const rows = await prisma.assignment.findMany({ where, orderBy: { returnStartedAt: 'desc' }, take: REPORT_EXPORT_LIMIT, ...RETURN_REPORT_INCLUDE })
  await logReportExport(req, 'การรับคืนครุภัณฑ์', f.format)
  return sendExport(res, f.format, 'return-report', 'รายงานการรับคืนครุภัณฑ์', RETURN_REPORT_COLUMNS, rows.map(shapeReturnRow))
}))

// ---------------------------------------------------------------------------
// v1.1.0 Beta 1: Notification Summary — always scoped to the signed-in recipient.
// ---------------------------------------------------------------------------
const NOTIFICATION_REPORT_COLUMNS = [
  { key: 'type', label: 'ประเภท' },
  { key: 'priority', label: 'ความสำคัญ' },
  { key: 'total', label: 'ทั้งหมด' },
  { key: 'unread', label: 'ยังไม่อ่าน' },
  { key: 'read', label: 'อ่านแล้ว' },
]
const NOTIFICATION_TYPE_LABELS = {
  BORROW_REQUEST: 'คำขอยืม', APPROVAL: 'การอนุมัติ', ASSIGNMENT: 'การมอบหมาย',
  RETURN: 'การรับคืน', REMINDER: 'การแจ้งเตือนกำหนด', SYSTEM: 'ระบบ',
}
const NOTIFICATION_PRIORITY_LABELS = { LOW: 'ต่ำ', NORMAL: 'ปกติ', HIGH: 'สูง', CRITICAL: 'วิกฤต' }

function notificationSummaryRows(notifications) {
  const summary = new Map()
  for (const notification of notifications) {
    const key = `${notification.type}:${notification.priority}`
    const row = summary.get(key) || {
      type: NOTIFICATION_TYPE_LABELS[notification.type] || notification.type,
      priority: NOTIFICATION_PRIORITY_LABELS[notification.priority] || notification.priority,
      total: 0, unread: 0, read: 0,
    }
    const count = notification._count ?? 1
    row.total += count
    row[notification.isRead ? 'read' : 'unread'] += count
    summary.set(key, row)
  }
  return [...summary.values()].sort((a, b) => b.total - a.total || a.type.localeCompare(b.type, 'th'))
}

router.get('/notifications', asyncHandler(async (req, res) => {
  const f = parseReportQuery(req.query)
  const where = {
    userId: req.user.id,
    deletedAt: null,
    ...dateRangeWhere('createdAt', f.dateFrom, f.dateTo),
  }
  if (NOTIFICATION_TYPES.includes(f.notificationType)) where.type = f.notificationType
  if (NOTIFICATION_PRIORITIES.includes(f.notificationPriority)) where.priority = f.notificationPriority
  if (f.search) where.OR = [
    { title: { contains: f.search, mode: 'insensitive' } },
    { message: { contains: f.search, mode: 'insensitive' } },
  ]
  const notifications = await prisma.notification.groupBy({
    by: ['type', 'priority', 'isRead'], where, _count: true,
  })
  const rows = notificationSummaryRows(notifications)
  if (!f.format) return ok(res, { items: rows })
  await logReportExport(req, 'สรุปการแจ้งเตือน', f.format)
  return sendExport(res, f.format, 'notification-summary-report', 'รายงานสรุปการแจ้งเตือน', NOTIFICATION_REPORT_COLUMNS, rows)
}))

// ---------------------------------------------------------------------------
// รายงานที่ 3: Warranty
// ---------------------------------------------------------------------------
const WARRANTY_REPORT_COLUMNS = [
  { key: 'assetTag', label: 'Asset Tag' },
  { key: 'name', label: 'ชื่ออุปกรณ์' },
  { key: 'category', label: 'หมวดหมู่' },
  { key: 'department', label: 'แผนก' },
  { key: 'vendor', label: 'ผู้ขาย/ผู้ผลิต' },
  { key: 'warrantyExpiry', label: 'วันหมดประกัน' },
  { key: 'daysRemaining', label: 'จำนวนวันคงเหลือ' },
  { key: 'bucket', label: 'สถานะประกัน' },
]
const WARRANTY_REPORT_SORTABLE = ['assetTag', 'warrantyExpiry']

function shapeWarrantyRow(asset) {
  const { bucketLabel, daysRemaining } = warrantyInfo(asset.warrantyExpiry)
  return {
    assetTag: asset.assetTag,
    name: asset.name,
    category: asset.category?.name || '-',
    department: asset.department?.name || '-',
    vendor: asset.vendor?.name || '-',
    warrantyExpiry: fmtDate(asset.warrantyExpiry),
    daysRemaining: daysRemaining ?? '',
    bucket: bucketLabel,
  }
}

router.get('/warranty', asyncHandler(async (req, res) => {
  const f = parseReportQuery(req.query)
  const where = {
    ...assetScopeForRead(req.user),
    warrantyExpiry: { not: null },
    ...warrantyBucketWhere(f.bucket),
  }
  if (f.categoryId) where.categoryId = f.categoryId
  if (f.locationId) where.locationId = f.locationId
  if (f.departmentId) where.departmentId = f.departmentId
  if (f.vendorId) where.vendorId = f.vendorId
  if (f.search) {
    where.OR = ASSET_SEARCH_FIELDS.map((field) => ({ [field]: { contains: f.search, mode: 'insensitive' } }))
  }
  const include = {
    category: { select: { name: true } },
    department: { select: { name: true } },
    vendor: { select: { name: true } },
  }

  if (!f.format) {
    const pagination = parsePagination(req.query)
    const orderBy = parseSort(req.query, WARRANTY_REPORT_SORTABLE, 'warrantyExpiry')
    const [items, totalItems] = await Promise.all([
      prisma.asset.findMany({ where, orderBy, skip: pagination.skip, take: pagination.take, include }),
      prisma.asset.count({ where }),
    ])
    return ok(res, { items: items.map(shapeWarrantyRow), ...buildPageMeta(pagination, totalItems) })
  }

  const rows = await prisma.asset.findMany({ where, orderBy: { warrantyExpiry: 'asc' }, take: REPORT_EXPORT_LIMIT, include })
  await logReportExport(req, 'การรับประกัน', f.format)
  return sendExport(res, f.format, 'warranty-report', 'รายงานการรับประกัน', WARRANTY_REPORT_COLUMNS, rows.map(shapeWarrantyRow))
}))

// ---------------------------------------------------------------------------
// รายงานที่ 4: Helpdesk
// ---------------------------------------------------------------------------
const HELPDESK_REPORT_COLUMNS = [
  { key: 'ticketNumber', label: 'เลขที่ใบแจ้ง' },
  { key: 'asset', label: 'ครุภัณฑ์' },
  { key: 'priority', label: 'ความสำคัญ' },
  { key: 'status', label: 'สถานะ' },
  { key: 'assignedStaff', label: 'ผู้ดูแล' },
  { key: 'opened', label: 'วันที่แจ้ง' },
  { key: 'resolved', label: 'วันที่แก้ไขสำเร็จ' },
  { key: 'closed', label: 'วันที่ปิดงาน' },
  { key: 'resolutionTimeHours', label: 'ระยะเวลาแก้ไข (ชั่วโมง)' },
]
const HELPDESK_REPORT_SORTABLE = ['ticketNumber', 'priority', 'status', 'openedAt', 'resolvedAt', 'closedAt']

function shapeHelpdeskRow(t) {
  const resolutionTimeHours = t.resolvedAt
    ? Math.round(((new Date(t.resolvedAt) - new Date(t.openedAt)) / (1000 * 60 * 60)) * 10) / 10
    : ''
  return {
    ticketNumber: t.ticketNumber,
    asset: `${t.asset?.assetTag ?? ''} — ${t.asset?.name ?? ''}`,
    priority: TICKET_PRIORITY_LABELS[t.priority] || t.priority,
    status: TICKET_STATUS_LABELS[t.status] || t.status,
    assignedStaff: t.assignedTo ? (t.assignedTo.name || t.assignedTo.email) : 'ยังไม่มอบหมาย',
    opened: fmtDate(t.openedAt),
    resolved: fmtDate(t.resolvedAt),
    closed: fmtDate(t.closedAt),
    resolutionTimeHours,
  }
}

const HELPDESK_REPORT_INCLUDE = {
  include: {
    asset: { select: { assetTag: true, name: true } },
    assignedTo: { select: { name: true, email: true } },
  },
}

router.get('/helpdesk', asyncHandler(async (req, res) => {
  const f = parseReportQuery(req.query)
  const where = { deletedAt: null, ...ticketScopeForRead(req.user), ...dateRangeWhere('openedAt', f.dateFrom, f.dateTo) }
  const assetFilter = {}
  if (f.categoryId) assetFilter.categoryId = f.categoryId
  if (f.locationId) assetFilter.locationId = f.locationId
  if (f.departmentId) assetFilter.departmentId = f.departmentId
  if (f.vendorId) assetFilter.vendorId = f.vendorId
  if (Object.keys(assetFilter).length) where.asset = assetFilter
  if (TICKET_STATUSES.includes(f.ticketStatus)) where.status = f.ticketStatus
  if (TICKET_CATEGORIES.includes(f.ticketCategory)) where.category = f.ticketCategory
  if (TICKET_PRIORITIES.includes(req.query.priority)) where.priority = req.query.priority
  if (f.search) {
    where.OR = [
      ...SEARCHABLE_TICKET_FIELDS.map((field) => ({ [field]: { contains: f.search, mode: 'insensitive' } })),
      ...TICKET_ASSET_SEARCH_FIELDS.map((field) => ({ asset: { [field]: { contains: f.search, mode: 'insensitive' } } })),
      { assignedTo: { name: { contains: f.search, mode: 'insensitive' } } },
    ]
  }

  if (!f.format) {
    const pagination = parsePagination(req.query)
    const orderBy = parseSort(req.query, HELPDESK_REPORT_SORTABLE, 'openedAt')
    const [items, totalItems] = await Promise.all([
      prisma.ticket.findMany({ where, orderBy, skip: pagination.skip, take: pagination.take, ...HELPDESK_REPORT_INCLUDE }),
      prisma.ticket.count({ where }),
    ])
    return ok(res, { items: items.map(shapeHelpdeskRow), ...buildPageMeta(pagination, totalItems) })
  }

  const rows = await prisma.ticket.findMany({ where, orderBy: { openedAt: 'desc' }, take: REPORT_EXPORT_LIMIT, ...HELPDESK_REPORT_INCLUDE })
  await logReportExport(req, 'ใบแจ้งซ่อม', f.format)
  return sendExport(res, f.format, 'helpdesk-report', 'รายงานใบแจ้งซ่อม', HELPDESK_REPORT_COLUMNS, rows.map(shapeHelpdeskRow))
}))

// ---------------------------------------------------------------------------
// รายงานคำขอยืม — จำกัดขอบเขต EMPLOYEE ให้เห็นเฉพาะคำขอของตัวเองเหมือนหน้าคำขอยืม
// ---------------------------------------------------------------------------
const BORROW_REQUEST_REPORT_COLUMNS = [
  { key: 'requestNumber', label: 'เลขที่คำขอ' },
  { key: 'employeeCode', label: 'รหัสพนักงาน' },
  { key: 'employeeName', label: 'ชื่อพนักงาน' },
  { key: 'department', label: 'แผนก' },
  { key: 'position', label: 'ตำแหน่ง' },
  { key: 'asset', label: 'ครุภัณฑ์' },
  { key: 'requestedAt', label: 'วันที่ขอ' },
  { key: 'expectedReturnDate', label: 'วันที่คาดว่าจะคืน' },
  { key: 'status', label: 'สถานะ' },
  { key: 'approvedBy', label: 'ผู้อนุมัติ' },
  { key: 'approvedAt', label: 'วันที่อนุมัติ' },
  { key: 'reason', label: 'เหตุผลที่ขอ' },
  { key: 'rejectedReason', label: 'เหตุผลที่ปฏิเสธ' },
  { key: 'remark', label: 'หมายเหตุ' },
]
const BORROW_REQUEST_REPORT_SORTABLE = ['requestNumber', 'requestedAt', 'expectedReturnDate', 'status', 'updatedAt']

function shapeBorrowRequestRow(item) {
  return {
    requestNumber: item.requestNumber,
    employeeCode: item.employee?.employeeCode || '-',
    employeeName: item.employee?.fullName || 'Unknown Employee',
    department: item.employee?.department?.name || '-',
    position: item.employee?.position || '-',
    asset: `${item.asset?.assetTag ?? ''} — ${item.asset?.name ?? ''}`,
    requestedAt: fmtDate(item.requestedAt),
    expectedReturnDate: fmtDate(item.expectedReturnDate),
    status: BORROW_REQUEST_STATUS_LABELS[item.status] || item.status,
    approvedBy: item.approvedByUser ? (item.approvedByUser.name || item.approvedByUser.email) : '-',
    approvedAt: fmtDate(item.approvedAt),
    reason: item.reason,
    rejectedReason: item.rejectedReason || '',
    remark: item.remark || '',
  }
}

router.get('/borrow-requests', asyncHandler(async (req, res) => {
  const f = parseReportQuery(req.query)
  const constraints = []
  const scope = borrowRequestScopeForAccount(req.user)
  if (Object.keys(scope).length) constraints.push(scope)
  if (f.search) constraints.push({ OR: [
    { requestNumber: { contains: f.search, mode: 'insensitive' } },
    { employee: { employeeCode: { contains: f.search, mode: 'insensitive' } } },
    { employee: { fullName: { contains: f.search, mode: 'insensitive' } } },
    { employee: { department: { name: { contains: f.search, mode: 'insensitive' } } } },
    { asset: { assetTag: { contains: f.search, mode: 'insensitive' } } },
    { asset: { name: { contains: f.search, mode: 'insensitive' } } },
    { reason: { contains: f.search, mode: 'insensitive' } },
    { remark: { contains: f.search, mode: 'insensitive' } },
  ] })
  const where = { deletedAt: null, ...dateRangeWhere('requestedAt', f.dateFrom, f.dateTo) }
  if (constraints.length) where.AND = constraints
  if (BORROW_REQUEST_STATUSES.includes(f.borrowRequestStatus)) where.status = f.borrowRequestStatus

  if (!f.format) {
    const pagination = parsePagination(req.query)
    const orderBy = parseSort(req.query, BORROW_REQUEST_REPORT_SORTABLE, 'requestedAt')
    const [items, totalItems] = await Promise.all([
      prisma.borrowRequest.findMany({ where, orderBy, skip: pagination.skip, take: pagination.take, ...BORROW_REQUEST_RELATIONS }),
      prisma.borrowRequest.count({ where }),
    ])
    return ok(res, { items: items.map(shapeBorrowRequestRow), ...buildPageMeta(pagination, totalItems) })
  }

  const rows = await prisma.borrowRequest.findMany({ where, orderBy: { requestedAt: 'desc' }, take: REPORT_EXPORT_LIMIT, ...BORROW_REQUEST_RELATIONS })
  await logReportExport(req, 'คำขอยืมครุภัณฑ์', f.format)
  return sendExport(res, f.format, 'borrow-request-report', 'รายงานคำขอยืมครุภัณฑ์', BORROW_REQUEST_REPORT_COLUMNS, rows.map(shapeBorrowRequestRow))
}))

// ---------------------------------------------------------------------------
// รายงานการอนุมัติ — เฉพาะ ADMIN/IT_STAFF พร้อมระยะเวลาตัดสินใจและ Top Approvers
// ---------------------------------------------------------------------------
const APPROVAL_REPORT_COLUMNS = [
  { key: 'requestNumber', label: 'เลขที่คำขอ' },
  { key: 'employeeName', label: 'พนักงาน' },
  { key: 'department', label: 'แผนก' },
  { key: 'asset', label: 'ครุภัณฑ์' },
  { key: 'decision', label: 'ผลการตัดสินใจ' },
  { key: 'reviewer', label: 'ผู้พิจารณา' },
  { key: 'requestedAt', label: 'วันที่ส่งคำขอ' },
  { key: 'decisionAt', label: 'วันที่ตัดสินใจ' },
  { key: 'approvalDurationHours', label: 'ระยะเวลาพิจารณา (ชั่วโมง)' },
  { key: 'comment', label: 'ความคิดเห็น' },
  { key: 'rejectedReason', label: 'เหตุผลที่ปฏิเสธ' },
]
const APPROVAL_REPORT_SORTABLE = ['requestNumber', 'requestedAt', 'approvedAt', 'status', 'updatedAt']

function approvalDecision(item) {
  return item.approvalHistory?.findLast?.((entry) => entry.action === 'APPROVED' || entry.action === 'REJECTED')
    || [...(item.approvalHistory || [])].reverse().find((entry) => entry.action === 'APPROVED' || entry.action === 'REJECTED')
}

function shapeApprovalRow(item) {
  const decision = approvalDecision(item)
  const decisionAt = item.approvedAt || decision?.createdAt || (item.status === 'REJECTED' ? item.updatedAt : null)
  const duration = decisionAt ? (new Date(decisionAt).getTime() - new Date(item.requestedAt).getTime()) / 3600000 : null
  return {
    requestNumber: item.requestNumber,
    employeeName: `${item.employee?.employeeCode || '-'} — ${item.employee?.fullName || 'Unknown Employee'}`,
    department: item.employee?.department?.name || '-',
    asset: `${item.asset?.assetTag ?? ''} — ${item.asset?.name ?? ''}`,
    decision: decision?.action === 'REJECTED' || item.status === 'REJECTED' ? 'ปฏิเสธ' : 'อนุมัติ',
    reviewer: decision?.actorUser ? (decision.actorUser.name || decision.actorUser.email) : (item.approvedByUser?.name || item.approvedByUser?.email || '-'),
    requestedAt: fmtDate(item.requestedAt),
    decisionAt: fmtDate(decisionAt),
    approvalDurationHours: duration == null ? '' : Math.round(Math.max(0, duration) * 10) / 10,
    comment: decision?.comment || '',
    rejectedReason: item.rejectedReason || '',
  }
}

router.get('/approvals', orgWideOnly, asyncHandler(async (req, res) => {
  const f = parseReportQuery(req.query)
  const constraints = [{ OR: [{ approvedAt: { not: null } }, { status: 'REJECTED' }] }]
  if (f.search) constraints.push({ OR: [
    { requestNumber: { contains: f.search, mode: 'insensitive' } },
    { employee: { employeeCode: { contains: f.search, mode: 'insensitive' } } },
    { employee: { fullName: { contains: f.search, mode: 'insensitive' } } },
    { employee: { department: { name: { contains: f.search, mode: 'insensitive' } } } },
    { asset: { assetTag: { contains: f.search, mode: 'insensitive' } } },
    { asset: { name: { contains: f.search, mode: 'insensitive' } } },
    { reason: { contains: f.search, mode: 'insensitive' } },
    { remark: { contains: f.search, mode: 'insensitive' } },
    { approvalHistory: { some: { comment: { contains: f.search, mode: 'insensitive' } } } },
    { approvalHistory: { some: { actorUser: { name: { contains: f.search, mode: 'insensitive' } } } } },
  ] })
  const where = { deletedAt: null, ...dateRangeWhere('requestedAt', f.dateFrom, f.dateTo), AND: constraints }
  if (BORROW_REQUEST_STATUSES.includes(f.borrowRequestStatus)) where.status = f.borrowRequestStatus

  if (!f.format) {
    const pagination = parsePagination(req.query)
    const orderBy = parseSort(req.query, APPROVAL_REPORT_SORTABLE, 'updatedAt')
    const [items, totalItems, durationRows, approverGroups] = await Promise.all([
      prisma.borrowRequest.findMany({ where, orderBy, skip: pagination.skip, take: pagination.take, ...BORROW_REQUEST_RELATIONS }),
      prisma.borrowRequest.count({ where }),
      prisma.borrowRequest.findMany({ where, select: { requestedAt: true, approvedAt: true, updatedAt: true, status: true } }),
      prisma.borrowRequestApproval.groupBy({
        by: ['actorUserId'],
        where: { action: { in: ['APPROVED', 'REJECTED'] }, actorUserId: { not: null }, borrowRequest: { is: where } },
        _count: { actorUserId: true }, orderBy: { _count: { actorUserId: 'desc' } }, take: 5,
      }),
    ])
    const userIds = approverGroups.map((row) => row.actorUserId).filter(Boolean)
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
    const userById = Object.fromEntries(users.map((user) => [user.id, user]))
    const durations = durationRows.map((row) => {
      const decisionAt = row.approvedAt || (row.status === 'REJECTED' ? row.updatedAt : null)
      return decisionAt ? Math.max(0, (decisionAt.getTime() - row.requestedAt.getTime()) / 3600000) : null
    }).filter((value) => value != null)
    const averageApprovalTimeHours = durations.length
      ? Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length) * 10) / 10
      : 0
    return ok(res, {
      items: items.map(shapeApprovalRow), ...buildPageMeta(pagination, totalItems),
      approvalSummary: {
        averageApprovalTimeHours,
        topApprovers: approverGroups.map((row) => ({
          name: userById[row.actorUserId]?.name || userById[row.actorUserId]?.email || 'Unknown Reviewer',
          decisions: row._count.actorUserId,
        })),
      },
    })
  }

  const rows = await prisma.borrowRequest.findMany({ where, orderBy: { updatedAt: 'desc' }, take: REPORT_EXPORT_LIMIT, ...BORROW_REQUEST_RELATIONS })
  await logReportExport(req, 'การอนุมัติคำขอยืม', f.format)
  return sendExport(res, f.format, 'approval-report', 'รายงานการอนุมัติคำขอยืม', APPROVAL_REPORT_COLUMNS, rows.map(shapeApprovalRow))
}))

// ---------------------------------------------------------------------------
// รายงานที่ 5: Department Summary — ภาพรวมองค์กร (ADMIN/IT_STAFF เท่านั้น)
// นับ "การมอบหมายที่ active อยู่ตอนนี้" และ "จำนวนตั๋วทั้งหมด" ผ่าน relation ของ asset ในแผนกนั้น —
// Prisma groupBy ข้าม relation ไม่ได้ตรง ๆ จึงดึง (assetId -> departmentId) มาครั้งเดียวแล้วนับใน
// หน่วยความจำ (เหมือนแพทเทิร์น topAssignedCategories ใน routes/dashboard.js — ข้อมูลมีขนาดเล็กพอ)
// ---------------------------------------------------------------------------
const DEPARTMENT_REPORT_COLUMNS = [
  { key: 'department', label: 'แผนก' },
  { key: 'assetsCount', label: 'จำนวนครุภัณฑ์' },
  { key: 'activeAssignmentsCount', label: 'กำลังมอบหมายอยู่' },
  { key: 'ticketsCount', label: 'จำนวนใบแจ้งซ่อมทั้งหมด' },
]

router.get('/departments', orgWideOnly, asyncHandler(async (req, res) => {
  const f = parseReportQuery(req.query)
  const notDeleted = { deletedAt: null }

  const departments = await prisma.department.findMany({
    where: { ...notDeleted, ...(f.departmentId ? { id: f.departmentId } : {}) },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  const assetWhere = {
    ...notDeleted,
    departmentId: { not: null },
    ...dateRangeWhere('purchaseDate', f.dateFrom, f.dateTo),
    ...(f.categoryId ? { categoryId: f.categoryId } : {}),
    ...(f.locationId ? { locationId: f.locationId } : {}),
    ...(f.vendorId ? { vendorId: f.vendorId } : {}),
  }

  const [assetGroups, activeAssignmentAssets, ticketAssets] = await Promise.all([
    prisma.asset.groupBy({ by: ['departmentId'], where: assetWhere, _count: true }),
    prisma.assignment.findMany({
      where: { ...ACTIVE_ASSIGNMENT_WHERE, asset: { departmentId: { not: null } } },
      select: { asset: { select: { departmentId: true } } },
    }),
    prisma.ticket.findMany({
      where: { deletedAt: null, asset: { departmentId: { not: null } } },
      select: { asset: { select: { departmentId: true } } },
    }),
  ])

  const assetsCountById = Object.fromEntries(assetGroups.map((g) => [g.departmentId, g._count]))
  const countBy = (rows) => {
    const counts = {}
    for (const row of rows) {
      const id = row.asset?.departmentId
      if (!id) continue
      counts[id] = (counts[id] || 0) + 1
    }
    return counts
  }
  const activeAssignmentsById = countBy(activeAssignmentAssets)
  const ticketsById = countBy(ticketAssets)

  const rows = departments.map((d) => ({
    department: d.name,
    assetsCount: assetsCountById[d.id] || 0,
    activeAssignmentsCount: activeAssignmentsById[d.id] || 0,
    ticketsCount: ticketsById[d.id] || 0,
  }))

  if (!f.format) return ok(res, { items: rows })
  await logReportExport(req, 'สรุปตามแผนก', f.format)
  return sendExport(res, f.format, 'department-summary-report', 'สรุปตามแผนก', DEPARTMENT_REPORT_COLUMNS, rows)
}))

// ---------------------------------------------------------------------------
// รายงานที่ 6: Vendor Summary — ภาพรวมองค์กร (ADMIN/IT_STAFF เท่านั้น) — แพทเทิร์นเดียวกับ Department Summary
// ---------------------------------------------------------------------------
const VENDOR_REPORT_COLUMNS = [
  { key: 'vendor', label: 'ผู้ขาย/ผู้ผลิต' },
  { key: 'assetsCount', label: 'จำนวนครุภัณฑ์' },
  { key: 'expiredWarranty', label: 'หมดประกันแล้ว' },
  { key: 'expiringSoon', label: 'ใกล้หมดประกัน (90 วัน)' },
  { key: 'normalWarranty', label: 'ประกันปกติ' },
  { key: 'ticketsCount', label: 'จำนวนใบแจ้งซ่อมทั้งหมด' },
]

router.get('/vendors', orgWideOnly, asyncHandler(async (req, res) => {
  const f = parseReportQuery(req.query)
  const notDeleted = { deletedAt: null }

  const vendors = await prisma.vendor.findMany({
    where: { ...notDeleted, ...(f.vendorId ? { id: f.vendorId } : {}) },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  const assetWhere = {
    ...notDeleted,
    vendorId: { not: null },
    ...dateRangeWhere('purchaseDate', f.dateFrom, f.dateTo),
    ...(f.categoryId ? { categoryId: f.categoryId } : {}),
    ...(f.locationId ? { locationId: f.locationId } : {}),
    ...(f.departmentId ? { departmentId: f.departmentId } : {}),
  }

  const [assets, ticketAssets] = await Promise.all([
    prisma.asset.findMany({ where: assetWhere, select: { vendorId: true, warrantyExpiry: true } }),
    prisma.ticket.findMany({
      where: { deletedAt: null, asset: { vendorId: { not: null } } },
      select: { asset: { select: { vendorId: true } } },
    }),
  ])

  const summaryById = {}
  for (const asset of assets) {
    const id = asset.vendorId
    if (!summaryById[id]) summaryById[id] = { assetsCount: 0, expiredWarranty: 0, expiringSoon: 0, normalWarranty: 0 }
    summaryById[id].assetsCount++
    if (asset.warrantyExpiry) {
      const { bucketLabel } = warrantyInfo(asset.warrantyExpiry)
      if (bucketLabel === 'หมดประกันแล้ว') summaryById[id].expiredWarranty++
      else if (bucketLabel.startsWith('ใกล้หมดประกัน')) summaryById[id].expiringSoon++
      else summaryById[id].normalWarranty++
    }
  }
  const ticketsById = {}
  for (const row of ticketAssets) {
    const id = row.asset?.vendorId
    if (!id) continue
    ticketsById[id] = (ticketsById[id] || 0) + 1
  }

  const rows = vendors.map((v) => ({
    vendor: v.name,
    assetsCount: summaryById[v.id]?.assetsCount || 0,
    expiredWarranty: summaryById[v.id]?.expiredWarranty || 0,
    expiringSoon: summaryById[v.id]?.expiringSoon || 0,
    normalWarranty: summaryById[v.id]?.normalWarranty || 0,
    ticketsCount: ticketsById[v.id] || 0,
  }))

  if (!f.format) return ok(res, { items: rows })
  await logReportExport(req, 'สรุปตามผู้ขาย/ผู้ผลิต', f.format)
  return sendExport(res, f.format, 'vendor-summary-report', 'สรุปตามผู้ขาย/ผู้ผลิต', VENDOR_REPORT_COLUMNS, rows)
}))

export default router

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
//     เพราะเป็นการดาวน์โหลดไฟล์ ไม่ใช่ endpoint ที่ frontend เอาไป render) ดึงข้อมูล "ทั้งหมด" ที่ตรงกับ
//     ตัวกรอง+ขอบเขตสิทธิ์ ไม่ใช่แค่หน้าที่กำลังดูอยู่ (ไม่ export รายการที่ถูกกรอง/ซ่อนออกไปแล้ว)
// ---------------------------------------------------------------------------
import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { ok, fail } from '../utils/response.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { parsePagination, parseSort, buildPageMeta } from '../utils/queryParams.js'
import { ACTIVE_ASSIGNMENT_WHERE, CURRENT_ASSIGNMENT_INCLUDE } from '../utils/assignmentHelpers.js'
import { parseReportQuery, dateRangeWhere, warrantyBucketWhere, warrantyInfo, sendExport } from '../utils/reportHelpers.js'
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

const router = Router()

// requireAuth ครอบทุก route ในไฟล์นี้ — /departments, /vendors ยังต้องผ่าน orgWideOnly เพิ่มอีกชั้น
router.use(requireAuth)

// Department Summary / Vendor Summary เป็นภาพรวมทั้งองค์กรล้วน ๆ ไม่มีทาง scope ให้เหลือแค่ "ของตัวเอง"
// ได้อย่างมีความหมาย — กันไว้ทั้งหมดตั้งแต่ต้นทาง ไม่ใช่แค่ซ่อนปุ่มฝั่ง frontend (Never expose org-wide data)
const orgWideOnly = requireRole('ADMIN', 'IT_STAFF')

// ป้ายภาษาไทย — ให้ตรงกับที่ frontend ใช้อยู่แล้ว (AssetForm/TicketForm/ReturnAssignmentForm OPTIONS)
const ASSET_STATUS_LABELS = { AVAILABLE: 'พร้อมใช้งาน', IN_USE: 'กำลังใช้งาน', REPAIR: 'ซ่อมบำรุง', DISPOSED: 'เลิกใช้งาน' }
const ASSET_CONDITION_LABELS = { NEW: 'ใหม่', GOOD: 'สภาพดี', FAIR: 'สภาพปานกลาง', POOR: 'สภาพไม่ดี', DAMAGED: 'ชำรุด' }
const ASSIGNMENT_STATUS_LABELS = { ASSIGNED: 'กำลังถือครอง', RETURNED: 'คืนแล้ว', LOST: 'สูญหาย', DAMAGED: 'เสียหาย' }
const TICKET_PRIORITY_LABELS = { LOW: 'ต่ำ', MEDIUM: 'ปานกลาง', HIGH: 'สูง', CRITICAL: 'วิกฤต' }
const TICKET_STATUS_LABELS = { OPEN: 'เปิดใหม่', IN_PROGRESS: 'กำลังดำเนินการ', ON_HOLD: 'พักงาน', RESOLVED: 'แก้ไขสำเร็จ', CLOSED: 'ปิดงานแล้ว' }
const TICKET_CATEGORY_LABELS = { HARDWARE: 'ฮาร์ดแวร์', SOFTWARE: 'ซอฟต์แวร์', NETWORK: 'เครือข่าย', PRINTER: 'เครื่องพิมพ์', ACCOUNT: 'บัญชีผู้ใช้', OTHER: 'อื่น ๆ' }

// ตัด T + เวลาออก เหลือแค่ yyyy-mm-dd — เพียงพอสำหรับรายงาน (export ไม่จำเป็นต้องมีเวลาละเอียดระดับวินาที)
function fmtDate(v) {
  return v ? new Date(v).toISOString().slice(0, 10) : ''
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
    currentHolder: holder ? (holder.user.name || holder.user.email) : 'ไม่มีผู้ถือครอง',
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

  const rows = await prisma.asset.findMany({ where, orderBy: { assetTag: 'asc' }, include })
  return sendExport(res, f.format, 'asset-inventory-report', 'รายงานครุภัณฑ์คงเหลือ', ASSET_REPORT_COLUMNS, rows.map(shapeAssetRow))
}))

// ---------------------------------------------------------------------------
// รายงานที่ 2: Asset Assignment
// ---------------------------------------------------------------------------
const ASSIGNMENT_REPORT_COLUMNS = [
  { key: 'asset', label: 'ครุภัณฑ์' },
  { key: 'employee', label: 'พนักงาน' },
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
    employee: a.user?.name || a.user?.email || '-',
    assignedDate: fmtDate(a.assignedAt),
    returnedDate: fmtDate(a.returnedAt),
    status: ASSIGNMENT_STATUS_LABELS[a.status] || a.status,
    conditionBefore: a.conditionBefore ? (ASSET_CONDITION_LABELS[a.conditionBefore] || a.conditionBefore) : '-',
    conditionAfter: a.conditionAfter ? (ASSET_CONDITION_LABELS[a.conditionAfter] || a.conditionAfter) : '-',
    remark: a.remark || '',
  }
}

function buildAssignmentReportWhere(req, f) {
  const where = { deletedAt: null, ...assignmentScopeForRead(req.user), ...dateRangeWhere('assignedAt', f.dateFrom, f.dateTo) }
  const assetFilter = {}
  if (f.categoryId) assetFilter.categoryId = f.categoryId
  if (f.locationId) assetFilter.locationId = f.locationId
  if (f.departmentId) assetFilter.departmentId = f.departmentId
  if (f.vendorId) assetFilter.vendorId = f.vendorId
  if (Object.keys(assetFilter).length) where.asset = assetFilter
  if (ASSIGNMENT_STATUSES.includes(f.assignmentStatus)) where.status = f.assignmentStatus
  if (f.search) {
    where.OR = [
      ...ASSIGNMENT_ASSET_SEARCH_FIELDS.map((field) => ({ asset: { [field]: { contains: f.search, mode: 'insensitive' } } })),
      { user: { name: { contains: f.search, mode: 'insensitive' } } },
    ]
  }
  return where
}

const ASSIGNMENT_REPORT_INCLUDE = {
  include: {
    asset: { select: { assetTag: true, name: true } },
    user: { select: { name: true, email: true } },
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

  const rows = await prisma.assignment.findMany({ where, orderBy: { assignedAt: 'desc' }, ...ASSIGNMENT_REPORT_INCLUDE })
  return sendExport(res, f.format, 'assignment-report', 'รายงานการมอบหมายครุภัณฑ์', ASSIGNMENT_REPORT_COLUMNS, rows.map(shapeAssignmentRow))
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

  const rows = await prisma.asset.findMany({ where, orderBy: { warrantyExpiry: 'asc' }, include })
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

  const rows = await prisma.ticket.findMany({ where, orderBy: { openedAt: 'desc' }, ...HELPDESK_REPORT_INCLUDE })
  return sendExport(res, f.format, 'helpdesk-report', 'รายงานใบแจ้งซ่อม', HELPDESK_REPORT_COLUMNS, rows.map(shapeHelpdeskRow))
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
  return sendExport(res, f.format, 'vendor-summary-report', 'สรุปตามผู้ขาย/ผู้ผลิต', VENDOR_REPORT_COLUMNS, rows)
}))

export default router

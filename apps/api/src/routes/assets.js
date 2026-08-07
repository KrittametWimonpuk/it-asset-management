// ---------------------------------------------------------------------------
// Route: /api/assets  — จัดการครุภัณฑ์ IT (Create / Read / Update / Delete)
// ทุก endpoint ต้องล็อกอินก่อน
//
// การลบเป็น "soft delete" — ตั้งค่า deletedAt แทนการลบแถวออกจริง
// endpoint READ/UPDATE ทุกอันจึงต้องกรอง deletedAt: null เสมอ เพื่อไม่ให้เห็น/แก้ของที่ถูกลบไปแล้ว
//
// ตั้งแต่ Milestone 2: category/location/department/vendor เป็นความสัมพันธ์กับตาราง master data
// แล้ว (ไม่ใช่ text อีกต่อไป ยกเว้น category ที่เดิมเป็น text) — categoryId บังคับ, ที่เหลือไม่บังคับ
//
// ตั้งแต่ Milestone 4 (RBAC):
//   - READ (GET): ทุก role เข้าได้ แต่ EMPLOYEE เห็นเฉพาะ asset ของตัวเอง ส่วน ADMIN/IT_STAFF เห็นทุก asset
//   - CREATE/UPDATE/DELETE: เฉพาะ ADMIN, IT_STAFF (และไม่จำกัดแค่ asset ของตัวเอง — แก้/ลบของคนอื่นได้)
//   - EMPLOYEE ไม่มีสิทธิ์ CREATE/UPDATE/DELETE เลย (ถูกกันด้วย requireRole ก่อนถึง handler)
//
// ตั้งแต่ Milestone 4.1: GET / รองรับ query filter เพิ่ม (categoryId/status/locationId/
// departmentId/vendorId) ทำงานร่วมกับ search ได้ — ใช้กับ filter bar ฝั่ง frontend
//
// ตั้งแต่ Milestone 5 (Asset Assignment): "ผู้ถือครองปัจจุบัน" ไม่ใช้ ownerId แล้ว (deprecated —
// ดูคอมเมนต์ที่ schema.prisma) แต่ดูจาก Assignment ล่าสุดที่ยัง active แทน (utils/assignmentHelpers.js)
//   - EMPLOYEE เห็นเฉพาะ asset ที่ตัวเองเป็นผู้ถือครองอยู่ (มี assignment active ที่ userId ตรงกับตัวเอง)
//   - ทุก response แนบ currentAssignment + assignmentHistoryCount มาด้วย
//   - GET / รองรับ ?unassigned=true ไว้กรองเฉพาะ asset ที่ยังไม่มีผู้ถือครอง (ใช้ตอนเลือก asset จะมอบหมายใหม่)
// ---------------------------------------------------------------------------
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { ok, fail, fromZodError } from '../utils/response.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { parsePagination, parseSort, buildPageMeta } from '../utils/queryParams.js'
import {
  optionalText, optionalDate, optionalIPv4, optionalMac,
  optionalCurrency, optionalNonNegativeNumber, optionalEnum,
} from '../utils/zodHelpers.js'
import { ACTIVE_ASSIGNMENT_WHERE, CURRENT_ASSIGNMENT_INCLUDE, shapeAssetWithAssignment } from '../utils/assignmentHelpers.js'
import { ASSET_TICKETS_INCLUDE, summarizeAssetTickets } from '../utils/ticketHelpers.js'
import { logAudit, auditContext } from '../utils/auditLog.js'

const router = Router()

// requireAuth ครอบทุก route ในไฟล์นี้ — CREATE/UPDATE/DELETE ยังต้องผ่าน manageAssets เพิ่มอีกชั้น
router.use(requireAuth)

// เฉพาะ ADMIN/IT_STAFF ที่สร้าง/แก้/ลบ asset ได้ — ใช้ซ้ำทั้ง 3 endpoint กันไม่ให้เขียนเงื่อนไขซ้ำ
const manageAssets = requireRole('ADMIN', 'IT_STAFF')

// สถานะที่อนุญาต — ต้องตรงกับ enum AssetStatus ใน schema.prisma
// export ไว้ให้ routes/dashboard.js ใช้ร่วมกัน (สร้าง breakdown ให้ครบทุกสถานะแม้บางสถานะจะนับได้ 0)
export const ASSET_STATUSES = ['AVAILABLE', 'IN_USE', 'REPAIR', 'DISPOSED']

// สภาพครุภัณฑ์ที่อนุญาต — ต้องตรงกับ enum AssetCondition ใน schema.prisma
// export ไว้ให้ routes/assignments.js ใช้ร่วมกัน (conditionBefore/conditionAfter ใช้ enum เดียวกัน)
export const ASSET_CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED']

// ฟิลด์ที่ยอมให้ sort ได้ (ต้องตรงกับที่ระบุใน spec: Asset Tag, Name, Created Date, Status)
const SORTABLE_FIELDS = ['assetTag', 'name', 'createdAt', 'status']

// ฟิลด์ที่ค้นหาได้ — ค้นหาแบบ "มีคำนี้อยู่ที่ไหนก็ได้" (contains) และไม่สนตัวพิมพ์เล็ก/ใหญ่
// ตั้งแต่ Milestone 3: เพิ่ม hostname/ipAddress/macAddress/operatingSystem ให้ค้นหาได้ด้วย
// export ไว้ให้ routes/reports.js ใช้ร่วมกัน (Milestone 8) กันไม่ต้องเขียนรายชื่อฟิลด์ค้นหาซ้ำ
export const SEARCHABLE_FIELDS = [
  'assetTag', 'name', 'brand', 'model', 'serialNumber',
  'hostname', 'ipAddress', 'macAddress', 'operatingSystem',
]

// ---- Milestone 3: ฟิลด์รายละเอียดเพิ่มเติม — ไม่บังคับทั้งหมด ใช้ร่วมกันทั้ง create และ update schema
// (เพื่อไม่ให้เขียน validation ซ้ำ 2 ที่) ----
const detailFields = {
  description: optionalText(),
  assetCondition: optionalEnum(ASSET_CONDITIONS, 'สภาพครุภัณฑ์ไม่ถูกต้อง'),
  purchaseDate: optionalDate(),
  purchasePrice: optionalNonNegativeNumber('ราคาซื้อต้องเป็นตัวเลขและไม่ติดลบ'),
  currency: optionalCurrency(),
  supplierReference: optionalText(),
  invoiceNumber: optionalText(),
  warrantyExpiry: optionalDate(),
  remark: optionalText(),

  hostname: optionalText(),
  ipAddress: optionalIPv4(),
  macAddress: optionalMac(),
  operatingSystem: optionalText(),
  osVersion: optionalText(),
  cpu: optionalText(),
  ram: optionalText(),
  storage: optionalText(),
  graphics: optionalText(),
  monitorSize: optionalText(),

  domainName: optionalText(),
  lastSeenAt: optionalDate(),

  receivedDate: optionalDate(),
  installedDate: optionalDate(),
  retiredDate: optionalDate(),
}

// แนบข้อมูล master data ที่เกี่ยวข้องมาด้วยทุกครั้งที่อ่าน asset — frontend จะได้มีชื่อไปแสดงผล
// ไม่ต้องยิง request แยกทีละตัว (แม้ master data นั้นจะถูก soft delete ไปแล้วก็ยังแนบมา ตาม
// requirement ที่ต้องการให้ asset เก่าที่อ้างถึง master data ที่ถูกลบ ยังแสดงผลได้ถูกต้อง)
//
// Milestone 5: แนบ assignments (เฉพาะที่ active — ดู CURRENT_ASSIGNMENT_INCLUDE) + จำนวนประวัติทั้งหมด
// มาด้วยเสมอ แล้วแปลงผ่าน shapeAssetWithAssignment ก่อนส่งกลับ ให้ได้ currentAssignment/assignmentHistoryCount
//
// Milestone 7: แนบ tickets (ดู ASSET_TICKETS_INCLUDE) มาด้วยเสมอเช่นกัน แล้วแปลงผ่าน summarizeAssetTickets
// ให้ได้ openTicketsCount/closedTicketsCount/recentTickets/ticketHistoryCount — ใช้แสดง "Recent Maintenance"
// ในรายละเอียด asset โดยไม่ต้องยิง query แยก
const WITH_RELATIONS = {
  include: {
    category: true,
    location: true,
    department: true,
    vendor: true,
    assignments: CURRENT_ASSIGNMENT_INCLUDE,
    _count: { select: { assignments: { where: { deletedAt: null } } } },
    tickets: ASSET_TICKETS_INCLUDE,
  },
}

// รวมการแปลงทั้ง assignment (Milestone 5) และ ticket (Milestone 7) ไว้ในจุดเดียว — เรียกใช้แทน
// shapeAssetWithAssignment ตรง ๆ ทุกจุดที่ตอบ response ของ asset กลับไป
function shapeAsset(asset) {
  const { tickets, ...rest } = asset
  return { ...shapeAssetWithAssignment(rest), ...summarizeAssetTickets(tickets) }
}

// เงื่อนไขพื้นฐานที่ READ ทุกอันต้องมี: ยังไม่ถูกลบ + ตาม role
// EMPLOYEE เห็นเฉพาะ asset ที่ตัวเองเป็น "ผู้ถือครองปัจจุบัน" (มี assignment active ที่ userId ตรงกับตัวเอง)
// — ไม่ใช้ ownerId แล้วตั้งแต่ Milestone 5 (ดูคอมเมนต์หัวไฟล์)
// export ไว้ให้ routes/reports.js ใช้ร่วมกัน (Milestone 8) — รายงานต้องกรองขอบเขตเดียวกับที่ GET /api/assets ใช้เป๊ะ ๆ
// (ห้ามเขียนเงื่อนไข RBAC ซ้ำ เพราะถ้าเขียนไม่ตรงกันจะกลายเป็นช่องโหว่รั่วข้อมูลข้ามขอบเขตได้)
export function scopeForRead(user) {
  const where = { deletedAt: null }
  if (user.role === 'EMPLOYEE') {
    where.assignments = { some: { userId: user.id, ...ACTIVE_ASSIGNMENT_WHERE } }
  }
  return where
}

// เงื่อนไขของ UPDATE/DELETE — ผ่าน manageAssets มาแล้ว (ADMIN/IT_STAFF เท่านั้น) จึงแก้/ลบ asset ของใครก็ได้
// เหลือแค่กันไม่ให้แก้/ลบของที่ถูกลบไปแล้วซ้ำ
const NOT_DELETED = { deletedAt: null }

// ข้อความ error กลาง ๆ เมื่อไม่พบ asset — ใช้ข้อความเดียวกันไม่ว่าจะเพราะ "ไม่มีจริง" หรือ "มีแต่ไม่ใช่ของเรา"
// (ตั้งใจไม่แยกข้อความ เพื่อไม่ให้คนอื่นเดาได้ว่า asset ID นี้มีอยู่จริงในระบบหรือไม่)
const NOT_FOUND_MESSAGE = 'ไม่พบครุภัณฑ์นี้ หรือคุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้'

// master data 4 ตัวที่ asset อ้างอิงได้ — ใช้ตอนตรวจว่า id ที่ส่งมามีอยู่จริงและยัง active อยู่ไหม
const MASTER_DATA_REFS = [
  { field: 'categoryId', model: prisma.category, label: 'หมวดหมู่' },
  { field: 'locationId', model: prisma.location, label: 'สถานที่' },
  { field: 'departmentId', model: prisma.department, label: 'แผนก' },
  { field: 'vendorId', model: prisma.vendor, label: 'ผู้ขาย/ผู้ผลิต' },
]

// ตรวจว่า categoryId/locationId/departmentId/vendorId ที่ส่งมา (ถ้ามี) ชี้ไปยัง master data
// ที่มีอยู่จริงและยังไม่ถูกลบ (deletedAt: null) — กันไม่ให้ผูก asset ใหม่กับของที่ถูกลบไปแล้ว
async function findInvalidMasterDataRef(data) {
  for (const ref of MASTER_DATA_REFS) {
    const id = data[ref.field]
    if (!id) continue // ไม่ได้ส่งมา หรือส่ง null (unset) — ข้ามได้ ไม่บังคับ
    const found = await ref.model.findFirst({ where: { id, deletedAt: null } })
    if (!found) {
      const message = `${ref.label}ที่เลือกไม่ถูกต้อง หรือถูกลบไปแล้ว กรุณาเลือกใหม่`
      return { field: ref.field, message }
    }
  }
  return null
}

// ---- READ: ดึงรายการ asset (แบ่งหน้า + เรียงลำดับ + ค้นหา + กรอง) — ขอบเขตขึ้นกับ role ----
router.get('/', asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query)
  const orderBy = parseSort(req.query, SORTABLE_FIELDS, 'createdAt')

  const where = { ...scopeForRead(req.user) }

  const search = (req.query.search || '').trim()
  if (search) {
    where.OR = SEARCHABLE_FIELDS.map((field) => ({
      [field]: { contains: search, mode: 'insensitive' },
    }))
  }

  // ---- Milestone 4.1: ตัวกรองฝั่ง server (ทำงานร่วมกับ search/pagination ด้านบนได้ปกติ) ----
  // ไอดี master data ที่ไม่มีจริงแค่ทำให้ผลลัพธ์ว่างเปล่า ไม่ต้อง validate เพิ่ม (ต่างจากตอน create/update)
  if (req.query.categoryId) where.categoryId = req.query.categoryId
  if (req.query.locationId) where.locationId = req.query.locationId
  if (req.query.departmentId) where.departmentId = req.query.departmentId
  if (req.query.vendorId) where.vendorId = req.query.vendorId
  if (ASSET_STATUSES.includes(req.query.status)) where.status = req.query.status

  // Milestone 5: ใช้ตอนฟอร์มมอบหมายครุภัณฑ์ต้องเลือกเฉพาะ asset ที่ยังไม่มีผู้ถือครอง
  // เฉพาะ ADMIN/IT_STAFF เท่านั้นที่ใช้ตัวกรองนี้ได้ (EMPLOYEE ขอบเขตอยู่ที่ "ถือครองอยู่" ซึ่งขัดกับ
  // "ยังไม่มีผู้ถือครอง" อยู่แล้วโดยธรรมชาติ — ข้ามไปเพื่อไม่ให้ไปเขียนทับเงื่อนไข scopeForRead ของ EMPLOYEE)
  if (req.query.unassigned === 'true' && req.user.role !== 'EMPLOYEE') {
    where.assignments = { none: ACTIVE_ASSIGNMENT_WHERE }
  }

  const [items, totalItems] = await Promise.all([
    prisma.asset.findMany({ where, orderBy, skip: pagination.skip, take: pagination.take, ...WITH_RELATIONS }),
    prisma.asset.count({ where }),
  ])

  ok(res, { items: items.map(shapeAsset), ...buildPageMeta(pagination, totalItems) })
}))

// ---- READ: ดึง asset ชิ้นเดียว — ขอบเขตขึ้นกับ role ----
router.get('/:id', asyncHandler(async (req, res) => {
  const asset = await prisma.asset.findFirst({
    where: { id: req.params.id, ...scopeForRead(req.user) },
    ...WITH_RELATIONS,
  })
  if (!asset) {
    return fail(res, 404, NOT_FOUND_MESSAGE)
  }
  ok(res, shapeAsset(asset))
}))

// ---- CREATE: เพิ่ม asset ใหม่ ----
// .trim() ตัดช่องว่างหัว-ท้ายอัตโนมัติ แล้ว min(1) กันไม่ให้ผ่านด้วยสตริงว่าง/ช่องว่างล้วน
const createSchema = z.object({
  assetTag: z.string().trim().min(1, 'กรุณาใส่เลขทะเบียนครุภัณฑ์ (Asset Tag)'),
  name: z.string().trim().min(1, 'กรุณาใส่ชื่ออุปกรณ์'),
  brand: z.string().trim().min(1, 'กรุณาใส่ยี่ห้อ'),
  model: z.string().trim().min(1, 'กรุณาใส่รุ่น'),
  serialNumber: z.string().trim().min(1).optional().nullable(),
  status: z.enum(ASSET_STATUSES, { errorMap: () => ({ message: 'สถานะไม่ถูกต้อง' }) }).optional(),
  categoryId: z.string().trim().min(1, 'กรุณาเลือกหมวดหมู่'),
  locationId: z.string().trim().min(1).optional().nullable(),
  departmentId: z.string().trim().min(1).optional().nullable(),
  vendorId: z.string().trim().min(1).optional().nullable(),
  ...detailFields,
})

// ตรวจว่า assetTag / serialNumber ชนกับของที่มีอยู่แล้วหรือไม่ (แยกเช็กทีละฟิลด์ เพื่อบอกได้ชัดว่าฟิลด์ไหนซ้ำ)
// excludeId = ตอนแก้ไข ไม่ต้องเทียบกับตัวเอง
async function findDuplicateField({ assetTag, serialNumber }, excludeId) {
  if (assetTag) {
    const dup = await prisma.asset.findFirst({
      where: { assetTag, ...(excludeId ? { id: { not: excludeId } } : {}) },
    })
    if (dup) return { field: 'assetTag', message: 'เลข Asset Tag นี้ถูกใช้ไปแล้ว' }
  }
  if (serialNumber) {
    const dup = await prisma.asset.findFirst({
      where: { serialNumber, ...(excludeId ? { id: { not: excludeId } } : {}) },
    })
    if (dup) return { field: 'serialNumber', message: 'เลข Serial Number นี้ถูกใช้ไปแล้ว' }
  }
  return null
}

router.post('/', manageAssets, asyncHandler(async (req, res) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    return fail(res, 400, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบฟอร์ม', fromZodError(parsed.error))
  }

  const duplicate = await findDuplicateField(parsed.data)
  if (duplicate) {
    return fail(res, 409, duplicate.message, [duplicate])
  }

  const invalidRef = await findInvalidMasterDataRef(parsed.data)
  if (invalidRef) {
    return fail(res, 400, invalidRef.message, [invalidRef])
  }

  const asset = await prisma.asset.create({
    data: { ...parsed.data, ownerId: req.user.id },
    ...WITH_RELATIONS,
  })

  logAudit({
    ...auditContext(req), action: 'CREATE', entityType: 'Asset', entityId: asset.id,
    description: `สร้างครุภัณฑ์ ${asset.assetTag} — ${asset.name}`,
    newValues: parsed.data,
  })

  ok(res, shapeAsset(asset), 201)
}))

// ---- UPDATE: แก้ไขข้อมูล asset (แก้ไม่ได้ถ้าถูกลบไปแล้ว) ----
const updateSchema = z.object({
  assetTag: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  brand: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional(),
  serialNumber: z.string().trim().min(1).optional().nullable(),
  status: z.enum(ASSET_STATUSES, { errorMap: () => ({ message: 'สถานะไม่ถูกต้อง' }) }).optional(),
  categoryId: z.string().trim().min(1).optional(),
  locationId: z.string().trim().min(1).optional().nullable(),
  departmentId: z.string().trim().min(1).optional().nullable(),
  vendorId: z.string().trim().min(1).optional().nullable(),
  ...detailFields,
})

router.put('/:id', manageAssets, asyncHandler(async (req, res) => {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    return fail(res, 400, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบฟอร์ม', fromZodError(parsed.error))
  }

  const duplicate = await findDuplicateField(parsed.data, req.params.id)
  if (duplicate) {
    return fail(res, 409, duplicate.message, [duplicate])
  }

  const invalidRef = await findInvalidMasterDataRef(parsed.data)
  if (invalidRef) {
    return fail(res, 400, invalidRef.message, [invalidRef])
  }

  // ดึงค่าเดิมเฉพาะฟิลด์ที่กำลังจะถูกแก้ไว้ก่อน (สำหรับ audit log oldValues) — เลือกเฉพาะ key ที่ parsed.data มี
  const existing = await prisma.asset.findFirst({
    where: { id: req.params.id, ...NOT_DELETED },
    select: Object.fromEntries(Object.keys(parsed.data).map((k) => [k, true])),
  })

  // updateMany + เงื่อนไข deletedAt = ป้องกันไม่ให้แก้ของที่ถูกลบไปแล้ว (ownership ไม่จำกัด — ผ่าน manageAssets มาแล้ว)
  const result = await prisma.asset.updateMany({
    where: { id: req.params.id, ...NOT_DELETED },
    data: parsed.data,
  })
  if (result.count === 0) {
    return fail(res, 404, NOT_FOUND_MESSAGE)
  }

  const asset = await prisma.asset.findUnique({ where: { id: req.params.id }, ...WITH_RELATIONS })

  logAudit({
    ...auditContext(req), action: 'UPDATE', entityType: 'Asset', entityId: req.params.id,
    description: `แก้ไขครุภัณฑ์ ${asset.assetTag} — ${asset.name}`,
    oldValues: existing, newValues: parsed.data,
  })

  ok(res, shapeAsset(asset))
}))

// ---- DELETE (soft): ตั้งค่า deletedAt แทนการลบแถวจริง ----
router.delete('/:id', manageAssets, asyncHandler(async (req, res) => {
  // soft delete เป็นแค่ UPDATE ไม่ใช่ DELETE จริง — onDelete: Restrict ของ Assignment.assetId ใน schema
  // จึงไม่ถูกกระตุ้นเลย ต้องเช็กเองตรงนี้ กันไม่ให้ asset ที่ยังมีผู้ถือครองอยู่หายไปจากรายการทั้งที่ assignment ยัง active
  const activeAssignment = await prisma.assignment.findFirst({
    where: { assetId: req.params.id, ...ACTIVE_ASSIGNMENT_WHERE },
  })
  if (activeAssignment) {
    return fail(res, 409, 'ครุภัณฑ์นี้ยังมีผู้ถือครองอยู่ กรุณารับคืนก่อนลบ')
  }

  const existing = await prisma.asset.findFirst({
    where: { id: req.params.id, ...NOT_DELETED },
    select: { assetTag: true, name: true, status: true },
  })

  const result = await prisma.asset.updateMany({
    where: { id: req.params.id, ...NOT_DELETED },
    data: { deletedAt: new Date() },
  })
  if (result.count === 0) {
    return fail(res, 404, NOT_FOUND_MESSAGE)
  }

  logAudit({
    ...auditContext(req), action: 'DELETE', entityType: 'Asset', entityId: req.params.id,
    description: `ลบครุภัณฑ์ (soft delete) ${existing?.assetTag} — ${existing?.name}`,
    oldValues: existing,
  })

  ok(res, { id: req.params.id })
}))

export default router

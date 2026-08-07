// ---------------------------------------------------------------------------
// createMasterDataRouter — โรงงานสร้าง Router มาตรฐานสำหรับ "master data"
//
// Category / Location / Department / Vendor มีพฤติกรรมเหมือนกันทุกอย่าง:
//   - ต้องล็อกอินก่อนถึงจะใช้ได้ — ดู (GET) ได้ทุก role, จัดการ (POST/PUT/DELETE) ได้เฉพาะ
//     ADMIN/IT_STAFF เท่านั้น (Milestone 4 RBAC — ดู manageRoles ด้านล่าง)
//   - ชื่อ (name) ห้ามซ้ำ ไม่สนตัวพิมพ์เล็ก/ใหญ่ (บังคับจริงด้วย partial unique index ที่ชั้นฐานข้อมูลด้วย)
//   - รองรับ pagination + search + sort เหมือน asset
//   - รองรับ filter ?isActive=true/false (ใช้ตอน asset form ดึงเฉพาะตัวเลือกที่ยัง active)
//   - ลบแบบ soft delete (ตั้ง deletedAt แทนการลบแถวจริง)
//
// เขียนไว้ที่เดียว แล้วให้ routes/categories.js, locations.js, departments.js, vendors.js
// เรียกใช้แค่ระบุ schema/label ของตัวเอง กันไม่ให้ต้องก็อปโค้ด CRUD (และ authorization) ซ้ำ 4 รอบ
// ---------------------------------------------------------------------------
import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { ok, fail, fromZodError } from './response.js'
import { asyncHandler } from './asyncHandler.js'
import { parsePagination, parseSort, buildPageMeta } from './queryParams.js'
import { logAudit, auditContext } from './auditLog.js'

/**
 * @param {object} opts
 * @param {object} opts.model - prisma delegate เช่น prisma.category
 * @param {string} opts.entityLabel - ชื่อเรียกภาษาไทยไว้ใช้ในข้อความ error เช่น "หมวดหมู่"
 * @param {string} opts.entityType - ชื่อ entity ภาษาอังกฤษไว้ใช้ใน audit log (ต้องตรงกับ AUDIT_ENTITY_TYPES) เช่น "Category"
 * @param {import('zod').ZodSchema} opts.createSchema - zod schema ตอนสร้างใหม่ (ต้องมี name)
 * @param {import('zod').ZodSchema} opts.updateSchema - zod schema ตอนแก้ไข (ทุกฟิลด์ optional)
 * @param {string[]} [opts.searchableFields] - ฟิลด์อื่นนอกจาก name ที่ค้นหาได้ (เช่น vendor: contactName, email)
 * @param {string[]} [opts.sortableFields] - ฟิลด์ที่ sort ได้
 * @param {string[]} [opts.manageRoles] - role ที่ POST/PUT/DELETE ได้ (ดูอย่างเดียวเปิดให้ทุก role ที่ล็อกอินเสมอ)
 */
export function createMasterDataRouter({
  model,
  entityLabel,
  entityType,
  createSchema,
  updateSchema,
  searchableFields = [],
  sortableFields = ['name', 'createdAt'],
  manageRoles = ['ADMIN', 'IT_STAFF'],
}) {
  const router = Router()
  router.use(requireAuth)
  const canManage = requireRole(...manageRoles)

  const NOT_FOUND_MESSAGE = `ไม่พบข้อมูล${entityLabel}นี้`

  // เช็กชื่อซ้ำ (ไม่สนตัวพิมพ์เล็ก/ใหญ่) เฉพาะในแถวที่ยังไม่ถูกลบ — เผื่อให้ตั้งชื่อซ้ำกับของที่ถูกลบไปแล้วได้
  async function nameExists(name, excludeId) {
    if (!name) return false
    const dup = await model.findFirst({
      where: {
        deletedAt: null,
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    })
    return Boolean(dup)
  }

  function duplicateNameError() {
    const msg = `ชื่อ${entityLabel}นี้ถูกใช้ไปแล้ว`
    return { message: msg, errors: [{ field: 'name', message: msg }] }
  }

  // ---- READ: รายการ (แบ่งหน้า + เรียงลำดับ + ค้นหา + filter isActive) ----
  router.get('/', asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query)
    const orderBy = parseSort(req.query, sortableFields, 'name')

    const where = { deletedAt: null }

    if (req.query.isActive === 'true') where.isActive = true
    if (req.query.isActive === 'false') where.isActive = false

    const search = (req.query.search || '').trim()
    if (search) {
      const fields = ['name', ...searchableFields]
      where.OR = fields.map((field) => ({ [field]: { contains: search, mode: 'insensitive' } }))
    }

    const [items, totalItems] = await Promise.all([
      model.findMany({ where, orderBy, skip: pagination.skip, take: pagination.take }),
      model.count({ where }),
    ])

    ok(res, { items, ...buildPageMeta(pagination, totalItems) })
  }))

  // ---- READ: รายการเดียว ----
  router.get('/:id', asyncHandler(async (req, res) => {
    const item = await model.findFirst({ where: { id: req.params.id, deletedAt: null } })
    if (!item) return fail(res, 404, NOT_FOUND_MESSAGE)
    ok(res, item)
  }))

  // ---- CREATE ----
  router.post('/', canManage, asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบฟอร์ม', fromZodError(parsed.error))
    }

    if (await nameExists(parsed.data.name)) {
      const { message, errors } = duplicateNameError()
      return fail(res, 409, message, errors)
    }

    const item = await model.create({ data: parsed.data })

    logAudit({
      ...auditContext(req), action: 'CREATE', entityType, entityId: item.id,
      description: `สร้าง${entityLabel} ${item.name}`,
      newValues: parsed.data,
    })

    ok(res, item, 201)
  }))

  // ---- UPDATE (แก้ไม่ได้ถ้าถูกลบไปแล้ว) ----
  router.put('/:id', canManage, asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      return fail(res, 400, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบฟอร์ม', fromZodError(parsed.error))
    }

    if (parsed.data.name && await nameExists(parsed.data.name, req.params.id)) {
      const { message, errors } = duplicateNameError()
      return fail(res, 409, message, errors)
    }

    // ดึงค่าเดิมเฉพาะฟิลด์ที่กำลังจะถูกแก้ไว้ก่อน (สำหรับ audit log oldValues)
    const existing = await model.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: Object.fromEntries(Object.keys(parsed.data).map((k) => [k, true])),
    })

    const result = await model.updateMany({
      where: { id: req.params.id, deletedAt: null },
      data: parsed.data,
    })
    if (result.count === 0) return fail(res, 404, NOT_FOUND_MESSAGE)

    const item = await model.findUnique({ where: { id: req.params.id } })

    logAudit({
      ...auditContext(req), action: 'UPDATE', entityType, entityId: req.params.id,
      description: `แก้ไข${entityLabel} ${item.name}`,
      oldValues: existing, newValues: parsed.data,
    })

    ok(res, item)
  }))

  // ---- DELETE (soft) ----
  router.delete('/:id', canManage, asyncHandler(async (req, res) => {
    const existing = await model.findFirst({ where: { id: req.params.id, deletedAt: null }, select: { name: true } })

    const result = await model.updateMany({
      where: { id: req.params.id, deletedAt: null },
      data: { deletedAt: new Date() },
    })
    if (result.count === 0) return fail(res, 404, NOT_FOUND_MESSAGE)

    logAudit({
      ...auditContext(req), action: 'DELETE', entityType, entityId: req.params.id,
      description: `ลบ${entityLabel} (soft delete) ${existing?.name}`,
      oldValues: existing,
    })

    ok(res, { id: req.params.id })
  }))

  return router
}

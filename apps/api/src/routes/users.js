// ---------------------------------------------------------------------------
// Route: /api/users — Milestone 4: เตรียมโครงสร้างสำหรับ "จัดการผู้ใช้" ในอนาคต
//
// ตอนนี้เปิดแค่ดูรายชื่อผู้ใช้ (ADMIN เท่านั้น) — ยังไม่มี endpoint สร้าง/แก้ไข/ลบ/เปลี่ยน role
// การไม่มี endpoint แก้ไขเลย กันการยกระดับสิทธิ์ตัวเองไปในตัว (ไม่มีทางที่ผู้ใช้จะเปลี่ยน role
// ของตัวเองได้ผ่าน API นี้) — เพิ่ม endpoint จัดการเต็มรูปแบบในอนาคตค่อยออกแบบเพิ่ม
// ---------------------------------------------------------------------------
import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { ok } from '../utils/response.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { parsePagination, parseSort, buildPageMeta } from '../utils/queryParams.js'

const router = Router()

// เฉพาะ ADMIN เท่านั้นที่เข้าดูรายชื่อผู้ใช้ได้
router.use(requireAuth, requireRole('ADMIN'))

const SORTABLE_FIELDS = ['email', 'name', 'role', 'createdAt']

// ---- READ: รายชื่อผู้ใช้ทั้งหมด (แบ่งหน้า + เรียงลำดับ) — ไม่ส่ง password กลับไปเด็ดขาด ----
router.get('/', asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query)
  const orderBy = parseSort(req.query, SORTABLE_FIELDS, 'createdAt')

  const [items, totalItems] = await Promise.all([
    prisma.user.findMany({
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    }),
    prisma.user.count(),
  ])

  ok(res, { items, ...buildPageMeta(pagination, totalItems) })
}))

export default router

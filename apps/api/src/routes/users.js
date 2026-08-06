// ---------------------------------------------------------------------------
// Route: /api/users — Milestone 4: เตรียมโครงสร้างสำหรับ "จัดการผู้ใช้" ในอนาคต
//
// เปิดแค่ดูรายชื่อผู้ใช้ — ยังไม่มี endpoint สร้าง/แก้ไข/ลบ/เปลี่ยน role
// การไม่มี endpoint แก้ไขเลย กันการยกระดับสิทธิ์ตัวเองไปในตัว (ไม่มีทางที่ผู้ใช้จะเปลี่ยน role
// ของตัวเองได้ผ่าน API นี้) — เพิ่ม endpoint จัดการเต็มรูปแบบในอนาคตค่อยออกแบบเพิ่ม
//
// ตั้งแต่ Milestone 5: เปิดให้ IT_STAFF ดูรายชื่อได้ด้วย (เดิม ADMIN เท่านั้น) เพราะฟอร์มมอบหมาย
// ครุภัณฑ์ต้องเลือก "พนักงาน" จากรายชื่อนี้ และ IT_STAFF มีสิทธิ์มอบหมายครุภัณฑ์ได้ — ยังคง "ดูอย่างเดียว"
// เหมือนเดิม ไม่ใช่การจัดการผู้ใช้ (ยังไม่มี endpoint แก้ไข/ลบ/เปลี่ยน role ให้ role ไหนเรียกได้เลย)
// ---------------------------------------------------------------------------
import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { ok } from '../utils/response.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { parsePagination, parseSort, buildPageMeta } from '../utils/queryParams.js'

const router = Router()

// ADMIN/IT_STAFF ดูรายชื่อผู้ใช้ได้ (EMPLOYEE เข้าไม่ได้ — ไม่มีเหตุผลต้องเห็นรายชื่อผู้ใช้ทั้งระบบ)
router.use(requireAuth, requireRole('ADMIN', 'IT_STAFF'))

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

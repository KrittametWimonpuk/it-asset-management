// ---------------------------------------------------------------------------
// Route: /api/dashboard — Milestone 6: สรุปภาพรวมระบบด้วยข้อมูลรวม (aggregate) เดียว
//
// เป้าหมาย: frontend ยิง request แค่ครั้งเดียวได้ข้อมูลทุกอย่างที่ต้องใช้แสดงผล ไม่ต้องคำนวณสถิติเอง
// (การคำนวณทั้งหมดอยู่ฝั่ง backend — frontend แค่ render)
//
// สิทธิ์: ทุก role เข้าถึงได้ (requireAuth เฉย ๆ ไม่ต้อง requireRole) แต่ข้อมูลที่ได้ต่างกันตาม role:
//   - ADMIN / IT_STAFF: เห็นภาพรวมทั้งองค์กร (buildOrgWideDashboard)
//   - EMPLOYEE: เห็นเฉพาะ asset ที่ตัวเองถือครอง + ประวัติการมอบหมายของตัวเอง ไม่เห็นสถิติภาพรวม
//     (buildEmployeeDashboard) — บังคับที่ฝั่ง backend เสมอ ไม่พึ่งพา frontend ซ่อน UI อย่างเดียว
//
// Performance: ทุก query ในแต่ละ branch ยิงพร้อมกันผ่าน Promise.all (ไม่ query วนลูปทีละแถว = ไม่มี N+1)
// ใช้ groupBy สำหรับนับแยกตามสถานะ และดึงชื่อ master data มาครั้งเดียวเพื่อทำ id -> name map แทนการ
// query ชื่อทีละรายการ ดูรายละเอียดการออกแบบ query ที่คอมเมนต์แต่ละจุดด้านล่าง
// ---------------------------------------------------------------------------
import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { ok } from '../utils/response.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ACTIVE_ASSIGNMENT_WHERE } from '../utils/assignmentHelpers.js'
import { ASSET_STATUSES } from './assets.js'
import { ASSIGNMENT_STATUSES } from './assignments.js'
import { TICKET_STATUSES, TICKET_PRIORITIES, TICKET_CATEGORIES } from './tickets.js'

const router = Router()
router.use(requireAuth)

const RECENT_ACTIVITIES_LIMIT = 10
const TOP_LIST_LIMIT = 5
const WARRANTY_WARNING_DAYS = 30

// ป้ายภาษาไทย — ให้ตรงกับที่ frontend ใช้อยู่แล้ว (AssetForm.jsx STATUS_OPTIONS / ReturnAssignmentForm.jsx
// ASSIGNMENT_STATUS_OPTIONS) เพื่อให้ chart array ที่ส่งกลับไปพร้อมใช้แสดงผลได้ทันทีโดยไม่ต้อง map เพิ่ม
const ASSET_STATUS_LABELS = {
  AVAILABLE: 'พร้อมใช้งาน',
  IN_USE: 'กำลังใช้งาน',
  REPAIR: 'ซ่อมบำรุง',
  DISPOSED: 'เลิกใช้งาน',
}
const ASSIGNMENT_STATUS_LABELS = {
  ASSIGNED: 'กำลังถือครอง',
  RETURNED: 'คืนแล้ว',
  LOST: 'สูญหาย',
  DAMAGED: 'เสียหาย',
}
// Milestone 7 — ให้ตรงกับ TicketForm.jsx (STATUS/PRIORITY/CATEGORY_OPTIONS) เหมือนแพทเทิร์นเดียวกับด้านบน
const TICKET_STATUS_LABELS = {
  OPEN: 'เปิดใหม่',
  IN_PROGRESS: 'กำลังดำเนินการ',
  ON_HOLD: 'พักงาน',
  RESOLVED: 'แก้ไขสำเร็จ',
  CLOSED: 'ปิดงานแล้ว',
}
const TICKET_PRIORITY_LABELS = {
  LOW: 'ต่ำ',
  MEDIUM: 'ปานกลาง',
  HIGH: 'สูง',
  CRITICAL: 'วิกฤต',
}
const TICKET_CATEGORY_LABELS = {
  HARDWARE: 'ฮาร์ดแวร์',
  SOFTWARE: 'ซอฟต์แวร์',
  NETWORK: 'เครือข่าย',
  PRINTER: 'เครื่องพิมพ์',
  ACCOUNT: 'บัญชีผู้ใช้',
  OTHER: 'อื่น ๆ',
}
const NOT_SET_LABEL = 'ไม่ระบุ'

function round1(n) {
  return Math.round(n * 10) / 10
}

function percentOf(count, total) {
  return total > 0 ? round1((count / total) * 100) : 0
}

// นับจาก groupBy result ทีละ status ให้ครบทุกค่าที่เป็นไปได้เสมอ (แม้บาง status จะนับได้ 0)
// กันกรณี groupBy ไม่คืนแถวมาเลยถ้าไม่มีข้อมูลของ status นั้น ๆ (chart จะได้ไม่ขาดแท่งไป)
function countByStatus(groups, statuses) {
  const counts = {}
  for (const s of statuses) counts[s] = 0
  for (const g of groups) counts[g.status] = g._count
  return counts
}

function toIdNameMap(rows) {
  return Object.fromEntries(rows.map((r) => [r.id, r.name]))
}

// เหมือน countByStatus แต่ใช้ได้กับ groupBy field ไหนก็ได้ (priority/category) ไม่ใช่แค่ status
// (เขียนแยกจาก countByStatus เดิมเพื่อไม่แตะโค้ดที่ผ่านการทดสอบแล้วจาก Milestone 6)
function countByGroupField(groups, values, field) {
  const counts = {}
  for (const v of values) counts[v] = 0
  for (const g of groups) counts[g[field]] = g._count
  return counts
}

// ขอบเขต "วันนี้" ตามเวลาเซิร์ฟเวอร์ — ใช้กับ resolvedToday/closedToday (Milestone 7)
function todayRange(now) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { gte: start, lt: end }
}

// select fields ของ ticket ที่ใช้แสดงใน "Recent Tickets" — ใช้ร่วมกันทั้ง org-wide และ employee branch
const RECENT_TICKET_SELECT = {
  id: true,
  ticketNumber: true,
  title: true,
  status: true,
  priority: true,
  openedAt: true,
  asset: { select: { assetTag: true, name: true } },
  reportedBy: { select: { name: true, email: true } },
}

// รวม assets/assignments ล่าสุด 3 ชนิด (มอบหมายใหม่ / รับคืน / เพิ่ม asset ใหม่) เรียงใหม่สุดก่อน จำกัด N รายการ
function mergeRecentActivities(assignments, returns, newAssets, limit) {
  const items = [
    ...assignments.map((a) => ({
      type: 'ASSIGNMENT',
      message: `มอบหมาย ${a.asset.assetTag} — ${a.asset.name} ให้ ${a.user.name || a.user.email}`,
      at: a.assignedAt,
    })),
    ...returns.map((a) => ({
      type: 'RETURN',
      message: `รับคืน ${a.asset.assetTag} — ${a.asset.name} จาก ${a.user.name || a.user.email}`,
      at: a.returnedAt,
    })),
    ...newAssets.map((a) => ({
      type: 'NEW_ASSET',
      message: `เพิ่มครุภัณฑ์ใหม่ ${a.assetTag} — ${a.name}`,
      at: a.createdAt,
    })),
  ]
  items.sort((x, y) => new Date(y.at) - new Date(x.at))
  return items.slice(0, limit)
}

// ---- ภาพรวมทั้งองค์กร (ADMIN / IT_STAFF) ----
async function buildOrgWideDashboard() {
  const now = new Date()
  const in30Days = new Date(now.getTime() + WARRANTY_WARNING_DAYS * 24 * 60 * 60 * 1000)
  const notDeleted = { deletedAt: null }

  // ทุก query ด้านล่างเป็นอิสระต่อกัน ยิงพร้อมกันทีเดียวผ่าน Promise.all (ไม่ใช่ query วนลูป = ไม่มี N+1)
  const [
    assetStatusGroups,
    assignmentStatusGroups,
    totalUsers,
    categories,
    locations,
    departments,
    vendors,
    assetsByCategoryGroups,
    assetsByDepartmentGroups,
    assetsByLocationGroups,
    topVendorGroups,
    expiredWarranty,
    warrantyExpiringSoon,
    normalWarranty,
    activeAssignmentAssetCategories,
    recentAssignments,
    recentReturns,
    recentNewAssets,
    ticketStatusGroups,
    ticketPriorityGroups,
    ticketCategoryGroups,
    resolvedToday,
    closedToday,
    recentTickets,
  ] = await Promise.all([
    // นับ asset แยกตามสถานะในคำสั่งเดียว (ใช้ทั้งการ์ดสรุปและกราฟ "Assets by Status")
    prisma.asset.groupBy({ by: ['status'], where: notDeleted, _count: true }),
    // นับ assignment แยกตามสถานะในคำสั่งเดียว (ใช้ทั้งการ์ด "Assigned Assets" และกราฟ "Assignments by Status")
    prisma.assignment.groupBy({ by: ['status'], where: notDeleted, _count: true }),
    prisma.user.count(),
    // ดึงชื่อ master data มาครั้งเดียว ได้ทั้งจำนวนรวม (.length) และ id->name map สำหรับกราฟ ในคำสั่งเดียว
    prisma.category.findMany({ where: notDeleted, select: { id: true, name: true } }),
    prisma.location.findMany({ where: notDeleted, select: { id: true, name: true } }),
    prisma.department.findMany({ where: notDeleted, select: { id: true, name: true } }),
    prisma.vendor.findMany({ where: notDeleted, select: { id: true, name: true } }),
    prisma.asset.groupBy({ by: ['categoryId'], where: notDeleted, _count: true }),
    prisma.asset.groupBy({ by: ['departmentId'], where: { ...notDeleted, departmentId: { not: null } }, _count: true }),
    prisma.asset.groupBy({ by: ['locationId'], where: { ...notDeleted, locationId: { not: null } }, _count: true }),
    prisma.asset.groupBy({
      by: ['vendorId'],
      where: { ...notDeleted, vendorId: { not: null } },
      _count: true,
      orderBy: { _count: { vendorId: 'desc' } },
      take: TOP_LIST_LIMIT,
    }),
    prisma.asset.count({ where: { ...notDeleted, warrantyExpiry: { lt: now } } }),
    prisma.asset.count({ where: { ...notDeleted, warrantyExpiry: { gte: now, lte: in30Days } } }),
    prisma.asset.count({ where: { ...notDeleted, warrantyExpiry: { gt: in30Days } } }),
    // ใช้หา "Top Assigned Categories" — join ผ่าน select เดียว (1 query) แล้วนับ/จัดอันดับในหน่วยความจำ
    // (Prisma groupBy ข้าม relation ไม่ได้ตรง ๆ เพราะ categoryId อยู่บน Asset ไม่ใช่ Assignment)
    prisma.assignment.findMany({
      where: ACTIVE_ASSIGNMENT_WHERE,
      select: { asset: { select: { categoryId: true } } },
    }),
    prisma.assignment.findMany({
      where: notDeleted,
      orderBy: { assignedAt: 'desc' },
      take: RECENT_ACTIVITIES_LIMIT,
      include: { asset: { select: { assetTag: true, name: true } }, user: { select: { name: true, email: true } } },
    }),
    prisma.assignment.findMany({
      where: { ...notDeleted, returnedAt: { not: null } },
      orderBy: { returnedAt: 'desc' },
      take: RECENT_ACTIVITIES_LIMIT,
      include: { asset: { select: { assetTag: true, name: true } }, user: { select: { name: true, email: true } } },
    }),
    prisma.asset.findMany({
      where: notDeleted,
      orderBy: { createdAt: 'desc' },
      take: RECENT_ACTIVITIES_LIMIT,
      select: { assetTag: true, name: true, createdAt: true },
    }),
    // Milestone 7 — สถิติใบแจ้งซ่อม: นับแยกตามสถานะ/ระดับความสำคัญ/หมวดหมู่ ในคำสั่งเดียวต่อชนิด (ไม่มี N+1)
    prisma.ticket.groupBy({ by: ['status'], where: notDeleted, _count: true }),
    prisma.ticket.groupBy({ by: ['priority'], where: notDeleted, _count: true }),
    prisma.ticket.groupBy({ by: ['category'], where: notDeleted, _count: true }),
    prisma.ticket.count({ where: { ...notDeleted, resolvedAt: todayRange(now) } }),
    prisma.ticket.count({ where: { ...notDeleted, closedAt: todayRange(now) } }),
    prisma.ticket.findMany({
      where: notDeleted,
      orderBy: { openedAt: 'desc' },
      take: RECENT_ACTIVITIES_LIMIT,
      select: RECENT_TICKET_SELECT,
    }),
  ])

  const assetStatusCounts = countByStatus(assetStatusGroups, ASSET_STATUSES)
  const assignmentStatusCounts = countByStatus(assignmentStatusGroups, ASSIGNMENT_STATUSES)
  const totalAssets = Object.values(assetStatusCounts).reduce((sum, n) => sum + n, 0)
  const assignedAssets = assignmentStatusCounts.ASSIGNED // = จำนวน asset ที่มีผู้ถือครองอยู่ (assignment active 1 แถวต่อ asset)

  const categoryNameById = toIdNameMap(categories)
  const locationNameById = toIdNameMap(locations)
  const departmentNameById = toIdNameMap(departments)
  const vendorNameById = toIdNameMap(vendors)

  // "Top Assigned Categories" — นับจากผลลัพธ์ query เดียวด้านบน ในหน่วยความจำ (ข้อมูลมีขนาดเล็ก ไม่กระทบ performance)
  const activeAssignmentsPerCategory = {}
  for (const row of activeAssignmentAssetCategories) {
    const categoryId = row.asset?.categoryId
    if (!categoryId) continue
    activeAssignmentsPerCategory[categoryId] = (activeAssignmentsPerCategory[categoryId] || 0) + 1
  }
  const topAssignedCategories = Object.entries(activeAssignmentsPerCategory)
    .map(([categoryId, value]) => ({ label: categoryNameById[categoryId] || NOT_SET_LABEL, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_LIST_LIMIT)

  // Milestone 7 — สรุปสถิติใบแจ้งซ่อม
  const ticketStatusCounts = countByGroupField(ticketStatusGroups, TICKET_STATUSES, 'status')
  const ticketPriorityCounts = countByGroupField(ticketPriorityGroups, TICKET_PRIORITIES, 'priority')
  const ticketCategoryCounts = countByGroupField(ticketCategoryGroups, TICKET_CATEGORIES, 'category')
  const topTicketCategories = TICKET_CATEGORIES
    .map((c) => ({ label: TICKET_CATEGORY_LABELS[c], value: ticketCategoryCounts[c] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_LIST_LIMIT)

  return {
    summary: {
      totalAssets,
      assignedAssets,
      availableAssets: assetStatusCounts.AVAILABLE,
      underRepairAssets: assetStatusCounts.REPAIR,
      disposedAssets: assetStatusCounts.DISPOSED,
      expiredWarranty,
      warrantyExpiringSoon,
      totalUsers,
      totalCategories: categories.length,
      totalLocations: locations.length,
      totalDepartments: departments.length,
      totalVendors: vendors.length,
    },
    assets: {
      utilization: {
        assignedPct: percentOf(assignedAssets, totalAssets),
        availablePct: percentOf(assetStatusCounts.AVAILABLE, totalAssets),
        repairPct: percentOf(assetStatusCounts.REPAIR, totalAssets),
        disposedPct: percentOf(assetStatusCounts.DISPOSED, totalAssets),
      },
    },
    assignments: {
      total: Object.values(assignmentStatusCounts).reduce((sum, n) => sum + n, 0),
      active: assignmentStatusCounts.ASSIGNED,
      returned: assignmentStatusCounts.RETURNED,
      lost: assignmentStatusCounts.LOST,
      damaged: assignmentStatusCounts.DAMAGED,
    },
    warranty: {
      expired: expiredWarranty,
      expiringSoon: warrantyExpiringSoon,
      normal: normalWarranty,
    },
    // Milestone 7 — การ์ดสรุปใบแจ้งซ่อม (แยกจาก charts.ticketsByStatus ที่มีครบทุกสถานะ — ตรงนี้เอาแค่ 2 ค่าที่
    // ใช้เป็นการ์ดสรุปหน้าแดชบอร์ดโดยตรง ตามที่ spec ระบุ: Open Tickets, In Progress, Resolved Today, Closed Today)
    tickets: {
      open: ticketStatusCounts.OPEN,
      inProgress: ticketStatusCounts.IN_PROGRESS,
      resolvedToday,
      closedToday,
    },
    charts: {
      assetsByCategory: assetsByCategoryGroups.map((g) => ({
        label: categoryNameById[g.categoryId] || NOT_SET_LABEL,
        value: g._count,
      })),
      assetsByDepartment: assetsByDepartmentGroups.map((g) => ({
        label: departmentNameById[g.departmentId] || NOT_SET_LABEL,
        value: g._count,
      })),
      assetsByLocation: assetsByLocationGroups.map((g) => ({
        label: locationNameById[g.locationId] || NOT_SET_LABEL,
        value: g._count,
      })),
      assetsByStatus: ASSET_STATUSES.map((s) => ({ label: ASSET_STATUS_LABELS[s], value: assetStatusCounts[s] })),
      assignmentsByStatus: ASSIGNMENT_STATUSES.map((s) => ({
        label: ASSIGNMENT_STATUS_LABELS[s],
        value: assignmentStatusCounts[s],
      })),
      warrantyStatus: [
        { label: 'หมดประกัน', value: expiredWarranty },
        { label: 'ใกล้หมดประกัน', value: warrantyExpiringSoon },
        { label: 'ปกติ', value: normalWarranty },
      ],
      topVendors: topVendorGroups.map((g) => ({ label: vendorNameById[g.vendorId] || NOT_SET_LABEL, value: g._count })),
      topAssignedCategories,
      // Milestone 7
      ticketsByPriority: TICKET_PRIORITIES.map((p) => ({ label: TICKET_PRIORITY_LABELS[p], value: ticketPriorityCounts[p] })),
      ticketsByStatus: TICKET_STATUSES.map((s) => ({ label: TICKET_STATUS_LABELS[s], value: ticketStatusCounts[s] })),
      topTicketCategories,
    },
    recentActivities: mergeRecentActivities(recentAssignments, recentReturns, recentNewAssets, RECENT_ACTIVITIES_LIMIT),
    recentTickets, // Milestone 7 — รายการล่าสุดของใบแจ้งซ่อม แยกจาก recentActivities (คนละความหมาย)
  }
}

// ---- เฉพาะของตัวเอง (EMPLOYEE) — ไม่มีสถิติภาพรวมองค์กรเลย ----
async function buildEmployeeDashboard(userId) {
  const now = new Date()
  const in30Days = new Date(now.getTime() + WARRANTY_WARNING_DAYS * 24 * 60 * 60 * 1000)

  const [
    activeAssignments,
    assignmentStatusGroups,
    recentOwn,
    ticketStatusGroups,
    resolvedToday,
    closedToday,
    recentTickets,
  ] = await Promise.all([
    prisma.assignment.findMany({
      where: { userId, ...ACTIVE_ASSIGNMENT_WHERE },
      include: { asset: { select: { warrantyExpiry: true } } },
    }),
    prisma.assignment.groupBy({ by: ['status'], where: { userId, deletedAt: null }, _count: true }),
    prisma.assignment.findMany({
      where: { userId, deletedAt: null },
      orderBy: { assignedAt: 'desc' },
      take: RECENT_ACTIVITIES_LIMIT,
      include: { asset: { select: { assetTag: true, name: true } } },
    }),
    // Milestone 7 — สถิติใบแจ้งซ่อมเฉพาะที่ตัวเองเป็นผู้แจ้ง (EMPLOYEE ไม่เห็นภาพรวมทั้งองค์กร)
    prisma.ticket.groupBy({ by: ['status'], where: { reportedById: userId, deletedAt: null }, _count: true }),
    prisma.ticket.count({ where: { reportedById: userId, deletedAt: null, resolvedAt: todayRange(now) } }),
    prisma.ticket.count({ where: { reportedById: userId, deletedAt: null, closedAt: todayRange(now) } }),
    prisma.ticket.findMany({
      where: { reportedById: userId, deletedAt: null },
      orderBy: { openedAt: 'desc' },
      take: RECENT_ACTIVITIES_LIMIT,
      select: RECENT_TICKET_SELECT,
    }),
  ])

  // จำนวน asset ที่ถือครองอยู่มักมีไม่กี่ชิ้นต่อคน — คำนวณ warranty bucket ในหน่วยความจำได้โดยไม่กระทบ performance
  let expired = 0
  let expiringSoon = 0
  let normal = 0
  for (const a of activeAssignments) {
    const w = a.asset.warrantyExpiry
    if (!w) continue
    const d = new Date(w)
    if (d < now) expired++
    else if (d <= in30Days) expiringSoon++
    else normal++
  }

  const assignmentStatusCounts = countByStatus(assignmentStatusGroups, ASSIGNMENT_STATUSES)
  const totalAssignedAssets = activeAssignments.length
  const ticketStatusCounts = countByGroupField(ticketStatusGroups, TICKET_STATUSES, 'status')

  return {
    summary: {
      totalAssets: totalAssignedAssets,
      assignedAssets: totalAssignedAssets,
      availableAssets: null,
      underRepairAssets: null,
      disposedAssets: null,
      expiredWarranty: expired,
      warrantyExpiringSoon: expiringSoon,
      totalUsers: null,
      totalCategories: null,
      totalLocations: null,
      totalDepartments: null,
      totalVendors: null,
    },
    assets: { utilization: null },
    assignments: {
      total: Object.values(assignmentStatusCounts).reduce((sum, n) => sum + n, 0),
      active: assignmentStatusCounts.ASSIGNED,
      returned: assignmentStatusCounts.RETURNED,
      lost: assignmentStatusCounts.LOST,
      damaged: assignmentStatusCounts.DAMAGED,
    },
    warranty: { expired, expiringSoon, normal },
    // Milestone 7 — สถิติส่วนตัว (ตั๋วที่ตัวเองแจ้ง) ยังเป็นตัวเลขจริง เหมือน `assignments` ด้านบน
    // ต่างจาก charts.ticketsByStatus/topTicketCategories ด้านล่างที่เป็นภาพรวมองค์กร จึงว่างไว้
    tickets: {
      open: ticketStatusCounts.OPEN,
      inProgress: ticketStatusCounts.IN_PROGRESS,
      resolvedToday,
      closedToday,
    },
    charts: {
      assetsByCategory: [],
      assetsByDepartment: [],
      assetsByLocation: [],
      assetsByStatus: [],
      assignmentsByStatus: [],
      warrantyStatus: [],
      topVendors: [],
      topAssignedCategories: [],
      ticketsByPriority: [],
      ticketsByStatus: [],
      topTicketCategories: [],
    },
    recentActivities: recentOwn
      .map((a) => ({
        type: a.returnedAt ? 'RETURN' : 'ASSIGNMENT',
        message: a.returnedAt
          ? `คุณคืน ${a.asset.assetTag} — ${a.asset.name}`
          : `คุณได้รับมอบหมาย ${a.asset.assetTag} — ${a.asset.name}`,
        at: a.returnedAt || a.assignedAt,
      }))
      .sort((x, y) => new Date(y.at) - new Date(x.at))
      .slice(0, RECENT_ACTIVITIES_LIMIT),
    recentTickets, // Milestone 7 — ตั๋วล่าสุดที่ตัวเองแจ้ง (ไม่ใช่ภาพรวมองค์กร)
  }
}

router.get('/', asyncHandler(async (req, res) => {
  const data = req.user.role === 'EMPLOYEE'
    ? await buildEmployeeDashboard(req.user.id)
    : await buildOrgWideDashboard()
  ok(res, data)
}))

export default router

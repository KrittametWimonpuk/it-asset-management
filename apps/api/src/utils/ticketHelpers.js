// ---------------------------------------------------------------------------
// ตัวช่วยเกี่ยวกับใบแจ้งซ่อม (Ticket) — Milestone 7
// ใช้ร่วมกันระหว่าง routes/tickets.js, routes/assets.js, routes/dashboard.js
// ---------------------------------------------------------------------------
import { prisma } from '../db.js'

// สร้างเลขที่ใบแจ้งซ่อมถัดไป (HD-000001, HD-000002, ...) จาก DB sequence
// sequence รับประกัน atomic ในตัว — กันเลขซ้ำแม้มี request สร้างตั๋วพร้อมกันหลายตัวพร้อมกัน
// (ดู migration 0007_tickets: CREATE SEQUENCE — เจตนาไม่ใช้ count()+1 เพราะมี race condition)
export async function nextTicketNumber() {
  const rows = await prisma.$queryRaw`SELECT nextval('"Ticket_ticketNumber_seq"') AS nextval`
  return `HD-${String(rows[0].nextval).padStart(6, '0')}`
}

// สถานะที่ถือว่า "ยังไม่ปิดงาน" — ใช้นับ open tickets ทั้งของ asset และ dashboard
export const OPEN_TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'ON_HOLD']

// ---- Workflow: OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED, IN_PROGRESS <-> ON_HOLD ----
// key = สถานะปัจจุบัน, value = สถานะที่เปลี่ยนไปได้จากตรงนั้น (นอกเหนือจากนี้ถือเป็น transition ที่ไม่ถูกต้อง)
export const TICKET_TRANSITIONS = {
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['ON_HOLD', 'RESOLVED'],
  ON_HOLD: ['IN_PROGRESS'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
}

export function isValidTransition(from, to) {
  return (TICKET_TRANSITIONS[from] || []).includes(to)
}

// สถานะที่ PUT ทั่วไปเปลี่ยนได้ — ไม่รวม RESOLVED/CLOSED (ต้องผ่าน endpoint /resolve, /close เท่านั้น
// เพราะสองสถานะนั้นต้องตั้ง resolvedAt/closedAt เพิ่ม และกรณี resolve ยังบังคับกรอก resolution ด้วย)
export const PUT_EDITABLE_STATUSES = ['OPEN', 'IN_PROGRESS', 'ON_HOLD']

// แนบไปกับ prisma include ของ Ticket — ข้อมูล asset/ผู้แจ้ง/ผู้ดูแล ที่หน้าจอต้องใช้แสดงผลเสมอ
export const TICKET_WITH_RELATIONS = {
  include: {
    asset: { select: { id: true, assetTag: true, name: true, hostname: true, serialNumber: true } },
    reportedBy: { select: { id: true, name: true, email: true } },
    assignedTo: { select: { id: true, name: true, email: true } },
  },
}

// จำนวนตั๋วล่าสุดที่แนบไปกับ asset (ใช้แสดง "Recent Maintenance") — พอสำหรับดูภาพรวมโดยไม่โหลดข้อมูลเกินจำเป็น
const RECENT_TICKETS_PER_ASSET = 5
// เพดานจำนวนตั๋วต่อ asset ที่ดึงมาคำนวณสรุป (open/closed count) — ครุภัณฑ์หนึ่งชิ้นแทบไม่มีทางมีตั๋วเกินนี้
// ตลอดอายุการใช้งานจริง จึงปลอดภัยที่จะคำนวณสรุปในหน่วยความจำแทนการยิง count query แยกหลายตัวต่อ asset (กัน N+1)
const TICKET_SUMMARY_FETCH_CAP = 200

// แนบไปกับ prisma include ของ Asset — ดึงตั๋วที่ยังไม่ถูกลบทั้งหมด (จำกัดเพดานไว้กันข้อมูลบวมเกินจำเป็น)
// เรียงใหม่สุดก่อน แล้วให้ summarizeAssetTickets() คำนวณ open/closed count + ตั๋วล่าสุดจากชุดเดียวกัน
// (ไม่ยิง query แยกต่อ asset — เหมือนแพทเทิร์น topAssignedCategories ใน dashboard.js ที่คำนวณในหน่วยความจำ
// เพราะข้อมูลมีขนาดเล็กพอ ไม่กระทบ performance)
export const ASSET_TICKETS_INCLUDE = {
  where: { deletedAt: null },
  orderBy: { openedAt: 'desc' },
  take: TICKET_SUMMARY_FETCH_CAP,
  select: {
    id: true,
    ticketNumber: true,
    title: true,
    status: true,
    priority: true,
    category: true,
    openedAt: true,
    resolvedAt: true,
    closedAt: true,
  },
}

// แปลงตั๋ว (ที่ดึงมาจาก ASSET_TICKETS_INCLUDE) ให้เป็น openTicketsCount/closedTicketsCount/recentTickets/ticketHistoryCount
export function summarizeAssetTickets(tickets = []) {
  return {
    openTicketsCount: tickets.filter((t) => OPEN_TICKET_STATUSES.includes(t.status)).length,
    closedTicketsCount: tickets.filter((t) => t.status === 'CLOSED').length,
    ticketHistoryCount: tickets.length,
    recentTickets: tickets.slice(0, RECENT_TICKETS_PER_ASSET),
  }
}

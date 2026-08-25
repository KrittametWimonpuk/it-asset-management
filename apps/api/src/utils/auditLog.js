// ---------------------------------------------------------------------------
// Audit Log — Milestone 9
//
// logAudit() คือทางเดียวที่สร้าง AuditLog record — เรียกแบบ "fire and forget" เสมอ (ไม่ await ตอนเรียกใช้)
// เพื่อไม่ให้การเขียน audit log ไปหน่วง response ของ business action จริง ถ้าเขียนล้มเหลว (เช่น DB มีปัญหา
// ชั่วคราว) จะ log error ที่ server console เฉย ๆ ไม่ throw ออกไปกระทบ request ที่ตอบกลับผู้ใช้ไปแล้ว
//
// เรียกใช้แบบนี้เสมอ (ไม่มี await):
//   logAudit({ ...auditContext(req), action: 'CREATE', entityType: 'Asset', entityId: asset.id, ... })
// ---------------------------------------------------------------------------
import { prisma } from '../db.js'

// action ที่รองรับ — ครอบคลุมทุก business action ที่ spec ต้องการให้ตรวจสอบย้อนหลังได้
export const AUDIT_ACTIONS = [
  'CREATE', 'UPDATE', 'DELETE', 'RESTORE',
  'ASSIGN', 'RETURN',
  'OPEN', 'START_PROGRESS', 'ON_HOLD', 'RESOLVE', 'CLOSE',
  'LOGIN', 'EXPORT_REPORT',
  'BORROW_REQUEST_CREATED', 'BORROW_REQUEST_APPROVED',
  'BORROW_REQUEST_REJECTED', 'BORROW_REQUEST_CANCELLED',
  'APPROVAL_STARTED', 'APPROVAL_APPROVED', 'APPROVAL_REJECTED',
  'RETURN_STARTED', 'RETURN_INSPECTED', 'RETURN_COMPLETED', 'RETURN_DAMAGED', 'RETURN_LOST',
]

// entityType ที่รองรับ
export const AUDIT_ENTITY_TYPES = [
  'Asset', 'Assignment', 'Ticket', 'Employee', 'BorrowRequest',
  'Category', 'Department', 'Location', 'Vendor',
  'User', 'Report',
]

// ดึงข้อมูลบริบทของผู้ทำรายการจาก request — ใช้ร่วมกับทุกจุดที่เรียก logAudit()
export function auditContext(req) {
  return {
    performedById: req.user?.id || null,
    ipAddress: req.ip || null,
    userAgent: req.get?.('user-agent') || null,
  }
}

// สร้าง audit record หนึ่งแถว — ไม่ throw ออกไปนอกฟังก์ชันนี้เด็ดขาด (ดูเหตุผลด้านบน)
// oldValues/newValues ควรเป็น plain object ที่ผู้เรียกเลือกเฉพาะฟิลด์ที่จำเป็นมาเองแล้ว (ห้ามมี
// password/token ปนมา) — ฟังก์ชันนี้ไม่ทำ sanitize ให้ ผู้เรียกต้องกรองเองก่อนส่งเข้ามา
export async function logAudit({
  action, entityType, entityId = null, description = null,
  oldValues = null, newValues = null,
  performedById = null, ipAddress = null, userAgent = null,
}) {
  try {
    await prisma.auditLog.create({
      data: { action, entityType, entityId, description, oldValues, newValues, performedById, ipAddress, userAgent },
    })
  } catch (err) {
    console.error('เขียน audit log ไม่สำเร็จ:', err)
  }
}

// แนบข้อมูลผู้ทำรายการ (name/email) ให้ audit record แต่ละแถว — join ด้วยมือครั้งเดียวต่อชุดข้อมูล
// ไม่ query ทีละแถว (กัน N+1) เพราะ AuditLog.performedById ไม่ได้ผูก Prisma relation กับ User โดยตรง
// (ดูเหตุผลที่ schema.prisma) ใช้ร่วมกันทั้ง routes/audit.js และ routes/dashboard.js (recentAuditLogs)
export async function attachPerformer(items) {
  const ids = [...new Set(items.map((i) => i.performedById).filter(Boolean))]
  if (ids.length === 0) return items.map((i) => ({ ...i, performedBy: null }))

  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })
  const userById = Object.fromEntries(users.map((u) => [u.id, u]))
  return items.map((i) => ({ ...i, performedBy: userById[i.performedById] || null }))
}

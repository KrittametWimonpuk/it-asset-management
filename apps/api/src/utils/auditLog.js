// ---------------------------------------------------------------------------
// Audit Log — Milestone 9
//
// RC2: ทุกเหตุการณ์ถูก persist ลง AuditOutbox ก่อน แล้ว dispatcher จึงคัดลอกไป AuditLog แบบ idempotent
// พร้อม retry ทำให้ database failure ชั่วคราวไม่ทำหลักฐานหายแบบเงียบ ๆ
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
  'NOTIFICATION_SENT', 'NOTIFICATION_READ',
  'NOTIFICATION_SETTINGS_UPDATED', 'EMAIL_VERIFICATION_REQUESTED', 'EMAIL_VERIFIED', 'EMAIL_TEST_QUEUED',
]

// entityType ที่รองรับ
export const AUDIT_ENTITY_TYPES = [
  'Asset', 'Assignment', 'Ticket', 'Employee', 'BorrowRequest',
  'Category', 'Department', 'Location', 'Vendor',
  'User', 'Report', 'Notification', 'NotificationPreference', 'EmailOutbox',
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
function serializable(value) {
  return value == null ? null : JSON.parse(JSON.stringify(value))
}

function auditPayload({
  action, entityType, entityId = null, description = null,
  oldValues = null, newValues = null,
  performedById = null, ipAddress = null, userAgent = null,
}) {
  return {
    action, entityType, entityId, description,
    oldValues: serializable(oldValues),
    newValues: serializable(newValues),
    performedById, ipAddress, userAgent,
  }
}

async function dispatchOutboxItem(item) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({ data: { ...item.payload, outboxId: item.id } })
      await tx.auditOutbox.update({ where: { id: item.id }, data: { processedAt: new Date(), lastError: null } })
    })
    return true
  } catch (error) {
    if (error?.code === 'P2002') {
      await prisma.auditOutbox.update({ where: { id: item.id }, data: { processedAt: new Date(), lastError: null } })
      return true
    }
    const attempts = item.attempts + 1
    const delayMs = Math.min(60_000, 2 ** Math.min(attempts, 6) * 1_000)
    await prisma.auditOutbox.update({
      where: { id: item.id },
      data: {
        attempts,
        lastError: String(error?.message || error).slice(0, 1000),
        nextAttemptAt: new Date(Date.now() + delayMs),
      },
    }).catch((updateError) => console.error('อัปเดตสถานะ audit outbox ไม่สำเร็จ:', updateError))
    return false
  }
}

export async function logAudit(event, client = prisma) {
  const item = await client.auditOutbox.create({ data: { payload: auditPayload(event) } })
  // Immediate best effort keeps the Audit Log current; the durable row remains for scheduler retry.
  if (client === prisma) await dispatchOutboxItem(item)
  return item
}

export async function flushAuditOutbox({ limit = 100, now = new Date() } = {}) {
  const items = await prisma.auditOutbox.findMany({
    where: { processedAt: null, nextAttemptAt: { lte: now } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
  const results = []
  for (const item of items) results.push(await dispatchOutboxItem(item))
  return { checked: items.length, processed: results.filter(Boolean).length }
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

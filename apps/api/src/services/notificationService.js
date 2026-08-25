import { prisma } from '../db.js'
import { assignmentHolderScopeForAccount } from '../utils/assignmentHelpers.js'
import { logAudit } from '../utils/auditLog.js'

export const NOTIFICATION_TYPES = ['BORROW_REQUEST', 'APPROVAL', 'ASSIGNMENT', 'RETURN', 'REMINDER', 'SYSTEM']
export const NOTIFICATION_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL']

const STAFF_ROLES = ['ADMIN', 'IT_STAFF']
const DAY_MS = 24 * 60 * 60 * 1000

function auditSent(notification, context = {}) {
  logAudit({
    ...context,
    action: 'NOTIFICATION_SENT',
    entityType: 'Notification',
    entityId: notification.id,
    description: `ส่งการแจ้งเตือนถึงผู้ใช้ ${notification.userId}: ${notification.title}`,
    newValues: {
      userId: notification.userId,
      type: notification.type,
      priority: notification.priority,
    },
  })
}

// Notification is deliberately best-effort. A communication failure must never roll back a
// completed lifecycle transaction. Callers may await this helper for deterministic tests, but it
// always resolves with null instead of throwing.
export async function createNotificationSafe({ userId, title, message, type, priority = 'NORMAL', auditContext = {} }) {
  if (!userId) return null
  try {
    const notification = await prisma.notification.create({
      data: { userId, title, message, type, priority },
    })
    auditSent(notification, auditContext)
    return notification
  } catch (error) {
    console.error('สร้างการแจ้งเตือนไม่สำเร็จ:', error)
    return null
  }
}

export async function staffRecipientIds() {
  const users = await prisma.user.findMany({
    where: { role: { in: STAFF_ROLES } },
    select: { id: true },
  })
  return users.map((user) => user.id)
}

export async function userIdForEmployee(employeeId) {
  if (!employeeId) return null
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null, email: { not: null } },
    select: { email: true },
  })
  if (!employee?.email) return null
  const user = await prisma.user.findFirst({
    where: { email: { equals: employee.email, mode: 'insensitive' } },
    select: { id: true },
  })
  return user?.id || null
}

export async function notifyStaff(payload) {
  try {
    const ids = await staffRecipientIds()
    return Promise.all(ids.map((userId) => createNotificationSafe({ ...payload, userId })))
  } catch (error) {
    console.error('ค้นหาผู้รับการแจ้งเตือนฝ่ายดูแลไม่สำเร็จ:', error)
    return []
  }
}

export async function notifyEmployee(employeeId, payload) {
  try {
    const userId = await userIdForEmployee(employeeId)
    return createNotificationSafe({ ...payload, userId })
  } catch (error) {
    console.error('ค้นหาบัญชีพนักงานสำหรับการแจ้งเตือนไม่สำเร็จ:', error)
    return null
  }
}

function dueDateLabel(value) {
  return new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(value)
}

async function createReminderOnce(userId, assignment, overdue) {
  const title = overdue
    ? `ครุภัณฑ์เกินกำหนดคืน: ${assignment.asset.assetTag}`
    : `ใกล้ถึงกำหนดคืน: ${assignment.asset.assetTag}`
  const message = overdue
    ? `${assignment.asset.name} เกินกำหนดคืนวันที่ ${dueDateLabel(assignment.expectedReturnDate)} กรุณาดำเนินการโดยเร็ว`
    : `${assignment.asset.name} มีกำหนดคืนวันที่ ${dueDateLabel(assignment.expectedReturnDate)} ภายใน 3 วัน`

  // The requested schema intentionally has no source/dedupe column. Matching the stable title and
  // message keeps reminder generation idempotent while preserving the exact data contract.
  const existing = await prisma.notification.findFirst({
    where: { userId, type: 'REMINDER', title, message },
    select: { id: true },
  })
  if (existing) return null
  return createNotificationSafe({
    userId,
    title,
    message,
    type: 'REMINDER',
    priority: overdue ? 'CRITICAL' : 'HIGH',
  })
}

// Beta 1 uses an on-access sweep instead of adding a scheduler process to the existing
// architecture. It runs before notification and dashboard reads and is idempotent per due date.
export async function generateDueRemindersForUser(user, now = new Date()) {
  try {
    const isEmployee = user.role === 'EMPLOYEE'
    const dueLimit = new Date(now.getTime() + (3 * DAY_MS))
    const where = {
      returnedAt: null,
      deletedAt: null,
      expectedReturnDate: { not: null, lte: dueLimit },
      ...(isEmployee ? assignmentHolderScopeForAccount(user) : {}),
    }
    const assignments = await prisma.assignment.findMany({
      where,
      select: {
        id: true,
        expectedReturnDate: true,
        asset: { select: { assetTag: true, name: true } },
      },
    })
    return Promise.all(assignments
      .filter((assignment) => isEmployee || assignment.expectedReturnDate < now)
      .map((assignment) => createReminderOnce(user.id, assignment, assignment.expectedReturnDate < now)))
  } catch (error) {
    console.error('สร้างการแจ้งเตือนกำหนดคืนไม่สำเร็จ:', error)
    return []
  }
}

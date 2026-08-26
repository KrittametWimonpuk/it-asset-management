import { prisma } from '../db.js'
import { assignmentHolderScopeForAccount } from '../utils/assignmentHelpers.js'
import { logAudit } from '../utils/auditLog.js'

export const NOTIFICATION_TYPES = ['BORROW_REQUEST', 'APPROVAL', 'ASSIGNMENT', 'RETURN', 'REMINDER', 'SYSTEM']
export const NOTIFICATION_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL']

const STAFF_ROLES = ['ADMIN', 'IT_STAFF']
const DAY_MS = 24 * 60 * 60 * 1000

async function auditSent(notification, context = {}, client = prisma) {
  await logAudit({
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
  }, client)
}

// Notification is deliberately best-effort. A communication failure must never roll back a
// completed lifecycle transaction. Callers may await this helper for deterministic tests, but it
// always resolves with null instead of throwing.
export async function createNotificationSafe({ userId, title, message, type, priority = 'NORMAL', dedupeKey = null, auditContext = {} }) {
  if (!userId) return null
  try {
    const notification = await prisma.$transaction(async (tx) => {
      const created = await tx.notification.create({
        data: { userId, title, message, type, priority, dedupeKey },
      })
      await auditSent(created, auditContext, tx)
      return created
    })
    return notification
  } catch (error) {
    if (error?.code === 'P2002' && dedupeKey) return null
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
  const linked = await prisma.user.findUnique({ where: { employeeId }, select: { id: true } })
  if (linked) return linked.id
  // Legacy fallback for Employee rows that could not be linked safely during migration.
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null, email: { not: null } },
    select: { email: true },
  })
  if (!employee?.email) return null
  const users = await prisma.user.findMany({
    where: { email: { equals: employee.email, mode: 'insensitive' } },
    select: { id: true },
    take: 2,
  })
  return users.length === 1 ? users[0].id : null
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

  const dueKey = assignment.expectedReturnDate.toISOString().slice(0, 10)
  return createNotificationSafe({
    userId,
    title,
    message,
    type: 'REMINDER',
    priority: overdue ? 'CRITICAL' : 'HIGH',
    dedupeKey: `assignment:${assignment.id}:${overdue ? 'overdue' : 'upcoming'}:${dueKey}:user:${userId}`,
  })
}

// Legacy compatibility entry point retained for callers outside this repository. Application
// reads no longer invoke it; production reminder generation runs through runSchedulerTick().
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

// Scheduler-ready organization sweep. It does not depend on dashboard traffic and is safe to run
// repeatedly or concurrently because Notification.dedupeKey is protected by a unique constraint.
export async function generateDueReminders(now = new Date()) {
  const dueLimit = new Date(now.getTime() + (3 * DAY_MS))
  const [assignments, staff] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        returnedAt: null,
        deletedAt: null,
        expectedReturnDate: { not: null, lte: dueLimit },
      },
      select: {
        id: true,
        employeeId: true,
        userId: true,
        expectedReturnDate: true,
        asset: { select: { assetTag: true, name: true } },
      },
    }),
    prisma.user.findMany({ where: { role: { in: STAFF_ROLES } }, select: { id: true } }),
  ])

  const employeeIds = [...new Set(assignments.map((item) => item.employeeId).filter(Boolean))]
  const linkedUsers = employeeIds.length
    ? await prisma.user.findMany({ where: { employeeId: { in: employeeIds } }, select: { id: true, employeeId: true } })
    : []
  const userByEmployee = new Map(linkedUsers.map((item) => [item.employeeId, item.id]))
  const jobs = []
  for (const assignment of assignments) {
    const overdue = assignment.expectedReturnDate < now
    const employeeUserId = userByEmployee.get(assignment.employeeId) || assignment.userId
    if (employeeUserId) jobs.push(createReminderOnce(employeeUserId, assignment, overdue))
    if (overdue) {
      for (const account of staff) jobs.push(createReminderOnce(account.id, assignment, true))
    }
  }
  const results = await Promise.all(jobs)
  return { checked: assignments.length, created: results.filter(Boolean).length }
}

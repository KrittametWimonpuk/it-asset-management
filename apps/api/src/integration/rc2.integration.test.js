import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { prisma } from '../db.js'
import { assetStatusAfterReturn } from '../routes/assignments.js'
import { createNotificationSafe } from '../services/notificationService.js'
import { runSchedulerTick } from '../jobs/runScheduler.js'

const enabled = process.env.RUN_DB_TESTS === '1'
const ids = {
  assignments: [], notifications: [], auditLogs: [], auditOutboxes: [], assets: [], users: [], employees: [], categories: [],
}

after(async () => {
  if (!enabled) return
  await prisma.assignment.deleteMany({ where: { id: { in: ids.assignments } } })
  await prisma.auditLog.deleteMany({ where: { id: { in: ids.auditLogs } } })
  await prisma.auditOutbox.deleteMany({ where: { id: { in: ids.auditOutboxes } } })
  await prisma.notification.deleteMany({ where: { id: { in: ids.notifications } } })
  await prisma.asset.deleteMany({ where: { id: { in: ids.assets } } })
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } })
  await prisma.employee.deleteMany({ where: { id: { in: ids.employees } } })
  await prisma.category.deleteMany({ where: { id: { in: ids.categories } } })
  await prisma.$disconnect()
})

test('RC2 database constraints and assignment state transaction work on PostgreSQL', { skip: !enabled }, async () => {
  const suffix = randomUUID()
  const category = await prisma.category.create({ data: { name: `RC2 Category ${suffix}` } })
  ids.categories.push(category.id)
  const employee = await prisma.employee.create({
    data: {
      employeeCode: `RC2-${suffix}`,
      firstName: 'Release', lastName: 'Candidate', fullName: 'Release Candidate',
      email: `rc2-${suffix}@example.com`,
    },
  })
  ids.employees.push(employee.id)
  const operator = await prisma.user.create({
    data: { email: `rc2-admin-${suffix}@example.com`, password: 'test-hash', role: 'ADMIN' },
  })
  const holder = await prisma.user.create({
    data: { email: `rc2-holder-${suffix}@example.com`, password: 'test-hash', employeeId: employee.id },
  })
  ids.users.push(operator.id, holder.id)

  await assert.rejects(
    prisma.user.create({
      data: { email: `rc2-duplicate-${suffix}@example.com`, password: 'test-hash', employeeId: employee.id },
    }),
    (error) => error?.code === 'P2002',
  )

  const notification = await createNotificationSafe({
    userId: holder.id, title: 'RC2', message: 'dedupe check', type: 'SYSTEM', dedupeKey: `rc2:${suffix}`,
  })
  ids.notifications.push(notification.id)
  assert.equal(await createNotificationSafe({
    userId: holder.id, title: 'RC2 duplicate', message: 'must be ignored', type: 'SYSTEM', dedupeKey: `rc2:${suffix}`,
  }), null)
  const scheduler = await runSchedulerTick()
  assert.ok(scheduler.audit.processed >= 1)
  const notificationAudit = await prisma.auditLog.findFirst({
    where: { entityType: 'Notification', entityId: notification.id },
  })
  assert.ok(notificationAudit?.outboxId)
  ids.auditLogs.push(notificationAudit.id)
  ids.auditOutboxes.push(notificationAudit.outboxId)

  const asset = await prisma.asset.create({
    data: {
      assetTag: `RC2-${suffix}`, name: 'RC2 test asset', brand: 'Test', model: 'Test',
      ownerId: operator.id, categoryId: category.id,
    },
  })
  ids.assets.push(asset.id)
  const assignment = await prisma.$transaction(async (tx) => {
    const changed = await tx.asset.updateMany({
      where: { id: asset.id, status: 'AVAILABLE', deletedAt: null }, data: { status: 'IN_USE' },
    })
    assert.equal(changed.count, 1)
    return tx.assignment.create({
      data: { assetId: asset.id, employeeId: employee.id, userId: holder.id, assignedById: operator.id },
    })
  })
  ids.assignments.push(assignment.id)
  assert.equal((await prisma.asset.findUnique({ where: { id: asset.id } })).status, 'IN_USE')

  await prisma.$transaction([
    prisma.assignment.update({
      where: { id: assignment.id }, data: { status: 'DAMAGED', returnStatus: 'DAMAGED', returnedAt: new Date() },
    }),
    prisma.asset.update({ where: { id: asset.id }, data: { status: assetStatusAfterReturn('DAMAGED') } }),
  ])
  assert.equal((await prisma.asset.findUnique({ where: { id: asset.id } })).status, 'MAINTENANCE')
  assert.equal(assetStatusAfterReturn('LOST'), 'LOST')
  assert.equal(assetStatusAfterReturn('RETURNED'), 'AVAILABLE')
})

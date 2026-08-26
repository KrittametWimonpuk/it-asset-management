import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildNotificationWhere } from './notifications.js'
import { NOTIFICATION_PRIORITIES, NOTIFICATION_TYPES } from '../services/notificationService.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../utils/auditLog.js'

const migrationPath = fileURLToPath(new URL('../../prisma/migrations/0014_notifications_reminders/migration.sql', import.meta.url))

test('Notification enums expose only the documented types and priorities', () => {
  assert.deepEqual(NOTIFICATION_TYPES, ['BORROW_REQUEST', 'APPROVAL', 'ASSIGNMENT', 'RETURN', 'REMINDER', 'SYSTEM'])
  assert.deepEqual(NOTIFICATION_PRIORITIES, ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'])
})

test('Notification list is always scoped to the signed-in recipient', () => {
  const where = buildNotificationWhere({ type: 'REMINDER', priority: 'CRITICAL', isRead: 'false' }, 'user-123')
  assert.equal(where.userId, 'user-123')
  assert.equal(where.deletedAt, null)
  assert.equal(where.type, 'REMINDER')
  assert.equal(where.priority, 'CRITICAL')
  assert.equal(where.isRead, false)
})

test('Notification search covers title and message while invalid filters are ignored', () => {
  const where = buildNotificationWhere({ search: 'IT-0001', type: 'INVALID', priority: 'URGENT' }, 'user-1')
  assert.equal(where.type, undefined)
  assert.equal(where.priority, undefined)
  assert.deepEqual(where.OR.map((condition) => Object.keys(condition)[0]), ['title', 'message'])
})

test('Notification migration is expand-only with recipient indexes and soft delete', () => {
  const sql = readFileSync(migrationPath, 'utf8')
  assert.match(sql, /CREATE TABLE "Notification"/)
  assert.match(sql, /"userId" TEXT NOT NULL/)
  assert.match(sql, /"deletedAt" TIMESTAMP\(3\)/)
  assert.match(sql, /Notification_userId_isRead_deletedAt_createdAt_idx/)
  assert.match(sql, /ON DELETE RESTRICT/)
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN|ALTER COLUMN/)
})

test('Audit dictionary includes notification sent/read lifecycle', () => {
  assert.ok(AUDIT_ACTIONS.includes('NOTIFICATION_SENT'))
  assert.ok(AUDIT_ACTIONS.includes('NOTIFICATION_READ'))
  assert.ok(AUDIT_ENTITY_TYPES.includes('Notification'))
})

test('Workflow hooks and reminder sweep cover all required lifecycle outcomes', () => {
  const borrowSource = readFileSync(fileURLToPath(new URL('./borrowRequests.js', import.meta.url)), 'utf8')
  const assignmentSource = readFileSync(fileURLToPath(new URL('./assignments.js', import.meta.url)), 'utf8')
  const reminderSource = readFileSync(fileURLToPath(new URL('../services/notificationService.js', import.meta.url)), 'utf8')
  assert.match(borrowSource, /คำขอยืมใหม่/)
  assert.match(borrowSource, /ได้รับอนุมัติ/)
  assert.match(borrowSource, /ไม่ได้รับอนุมัติ/)
  assert.match(assignmentSource, /ได้รับมอบหมาย/)
  assert.match(assignmentSource, /รอตรวจรับคืน/)
  assert.match(assignmentSource, /รับคืนแบบชำรุด/)
  assert.match(assignmentSource, /บันทึกครุภัณฑ์สูญหาย/)
  assert.match(reminderSource, /3 \* DAY_MS/)
  assert.match(reminderSource, /expectedReturnDate < now/)
})

test('RC2 reminders are scheduler-driven and protected by a dedupe key', () => {
  const schedulerSource = readFileSync(fileURLToPath(new URL('../jobs/runScheduler.js', import.meta.url)), 'utf8')
  const dashboardSource = readFileSync(fileURLToPath(new URL('./dashboard.js', import.meta.url)), 'utf8')
  const notificationRoutes = readFileSync(fileURLToPath(new URL('./notifications.js', import.meta.url)), 'utf8')
  const rc2Migration = readFileSync(fileURLToPath(new URL('../../prisma/migrations/0015_rc2_production_hardening/migration.sql', import.meta.url)), 'utf8')
  assert.match(schedulerSource, /generateDueReminders/)
  assert.doesNotMatch(dashboardSource, /generateDueReminders/)
  assert.doesNotMatch(notificationRoutes, /generateDueReminders/)
  assert.match(rc2Migration, /Notification_dedupeKey_key/)
  assert.match(rc2Migration, /CREATE UNIQUE INDEX/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildEmailTemplate, EMAIL_TEMPLATE_KEYS } from './services/emailTemplates.js'
import { getEmailProviderState } from './services/emailProvider.js'
import { emailConfirmationSchema, notificationSettingsSchema } from './routes/notificationSettings.js'

const migrationPath = fileURLToPath(new URL('../prisma/migrations/0016_email_notifications/migration.sql', import.meta.url))

test('email notification migration is expand-only and has dedupe/worker indexes', () => {
  const sql = readFileSync(migrationPath, 'utf8')
  assert.match(sql, /CREATE TABLE "NotificationPreference"/)
  assert.match(sql, /CREATE TABLE "EmailVerificationToken"/)
  assert.match(sql, /CREATE TABLE "EmailOutbox"/)
  assert.match(sql, /EmailOutbox_dedupeKey_key/)
  assert.match(sql, /EmailOutbox_status_nextAttemptAt_idx/)
  assert.match(sql, /NotificationPreference_userId_key/)
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN|ALTER COLUMN/)
})

test('notification settings validation rejects invalid email and unknown fields', () => {
  assert.equal(notificationSettingsSchema.safeParse({ notificationEmail: 'valid@example.com', emailEnabled: false }).success, true)
  assert.equal(notificationSettingsSchema.safeParse({ notificationEmail: 'not-an-email' }).success, false)
  assert.equal(notificationSettingsSchema.safeParse({ notificationEmail: 'safe@example.com\r\nBcc:attacker@example.com' }).success, false)
  assert.equal(notificationSettingsSchema.safeParse({ role: 'ADMIN' }).success, false)
})

test('email confirmation only accepts a fixed-length hexadecimal token', () => {
  assert.equal(emailConfirmationSchema.safeParse({ token: 'a'.repeat(64) }).success, true)
  assert.equal(emailConfirmationSchema.safeParse({ token: 'plain-token' }).success, false)
})

test('email template covers lifecycle events, escapes user content and includes plain text', () => {
  for (const key of [
    'BORROW_REQUEST_SUBMITTED', 'BORROW_REQUEST_APPROVED', 'BORROW_REQUEST_REJECTED', 'ASSET_ASSIGNED',
    'UPCOMING_DUE_DATE', 'OVERDUE_ASSET', 'RETURN_INSPECTION_PENDING', 'RETURN_COMPLETED',
    'RETURN_DAMAGED', 'RETURN_LOST', 'HELPDESK_CONFIRMATION',
  ]) assert.ok(EMAIL_TEMPLATE_KEYS.includes(key))
  const result = buildEmailTemplate({
    templateKey: 'HELPDESK_CONFIRMATION', title: '<script>alert(1)</script>', message: '<b>private</b>',
    actionUrl: 'javascript:alert(1)',
  })
  assert.doesNotMatch(result.html, /<script>|<b>private<\/b>|javascript:/)
  assert.match(result.html, /&lt;script&gt;/)
  assert.match(result.text, /private/)
})

test('email provider fails closed when disabled or missing secret', () => {
  const previous = {
    EMAIL_ENABLED: process.env.EMAIL_ENABLED,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
  }
  process.env.EMAIL_ENABLED = 'false'
  delete process.env.RESEND_API_KEY
  delete process.env.EMAIL_FROM
  assert.deepEqual(getEmailProviderState(), { provider: 'resend', enabled: false, configured: false, available: false })
  Object.entries(previous).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  })
})

test('scheduler flushes email outbox independently from reminder generation', () => {
  const scheduler = readFileSync(fileURLToPath(new URL('./jobs/runScheduler.js', import.meta.url)), 'utf8')
  const notificationService = readFileSync(fileURLToPath(new URL('./services/notificationService.js', import.meta.url)), 'utf8')
  assert.match(scheduler, /flushEmailOutbox/)
  assert.match(notificationService, /queueNotificationEmail/)
  assert.match(notificationService, /notificationPreference/)
})

test('helpdesk routing excludes the reporter from staff new-ticket fanout', () => {
  const tickets = readFileSync(fileURLToPath(new URL('./routes/tickets.js', import.meta.url)), 'utf8')
  assert.match(tickets, /excludeUserIds: \[req\.user\.id\]/)
  assert.match(tickets, /HELPDESK_CONFIRMATION/)
  assert.match(tickets, /HELPDESK_NEW/)
})

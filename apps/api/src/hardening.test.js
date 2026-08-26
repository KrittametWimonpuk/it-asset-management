import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationUrl = new URL('../prisma/migrations/0015_rc2_production_hardening/migration.sql', import.meta.url)

test('RC2 migration is expand-only and safely backfills explicit User Employee identity', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  assert.match(sql, /ALTER TABLE "User" ADD COLUMN "employeeId" TEXT/)
  assert.match(sql, /HAVING COUNT\(\*\) = 1/)
  assert.match(sql, /unique_user_email/)
  assert.match(sql, /CREATE UNIQUE INDEX "User_employeeId_key"/)
  assert.match(sql, /FOREIGN KEY \("employeeId"\) REFERENCES "Employee"\("id"\)/)
  assert.match(sql, /ON DELETE SET NULL/)
  assert.doesNotMatch(sql, /DROP COLUMN|DROP TABLE/)
})

test('RC2 migration adds lifecycle, reminder, performance, and audit durability constraints', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  for (const expected of [
    "ADD VALUE IF NOT EXISTS 'LOST'",
    "ADD VALUE IF NOT EXISTS 'MAINTENANCE'",
    'Notification_dedupeKey_key',
    'Assignment_expectedReturnDate_idx',
    'Employee_email_normalized_active_idx',
    'CREATE TABLE "AuditOutbox"',
    'AuditLog_outboxId_key',
  ]) assert.ok(sql.includes(expected), `missing ${expected}`)
})

test('Express and production deployment declare real-client proxy and health settings', async () => {
  const [server, compose, nginx] = await Promise.all([
    readFile(new URL('./index.js', import.meta.url), 'utf8'),
    readFile(new URL('../../../docker-compose.prod.yml', import.meta.url), 'utf8'),
    readFile(new URL('../../web/nginx.prod.conf', import.meta.url), 'utf8'),
  ])
  assert.match(server, /app\.set\('trust proxy'/)
  assert.match(compose, /TRUST_PROXY/)
  assert.match(nginx, /location = \/healthz/)
  assert.match(nginx, /proxy_set_header X-Forwarded-For/)
})

test('Audit delivery uses a persisted outbox and a retry scheduler', async () => {
  const [audit, scheduler] = await Promise.all([
    readFile(new URL('./utils/auditLog.js', import.meta.url), 'utf8'),
    readFile(new URL('./jobs/runScheduler.js', import.meta.url), 'utf8'),
  ])
  assert.match(audit, /auditOutbox\.create/)
  assert.match(audit, /flushAuditOutbox/)
  assert.match(audit, /nextAttemptAt/)
  assert.match(scheduler, /flushAuditOutbox/)
})

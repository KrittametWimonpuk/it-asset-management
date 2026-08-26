import { generateDueReminders } from '../services/notificationService.js'
import { flushAuditOutbox } from '../utils/auditLog.js'
import { prisma } from '../db.js'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export async function runSchedulerTick(now = new Date()) {
  const [reminders, audit] = await Promise.all([
    generateDueReminders(now),
    flushAuditOutbox(),
  ])
  return { reminders, audit, ranAt: now.toISOString() }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runSchedulerTick()
    .then((result) => console.log(JSON.stringify(result)))
    .finally(() => prisma.$disconnect())
}

import { createHash, randomBytes } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { auditContext, logAudit } from '../utils/auditLog.js'
import { fail, fromZodError, ok } from '../utils/response.js'
import { getEmailProviderState } from '../services/emailProvider.js'
import { queueTestEmail, queueVerificationEmail } from '../services/emailService.js'

const router = Router()
router.use(requireAuth)

const EMAIL_MAX_LENGTH = 254
const VERIFY_WINDOW_MS = 15 * 60 * 1000
const VERIFY_TOKEN_TTL_MS = 20 * 60 * 1000
const VERIFY_MAX_REQUESTS = Number(process.env.EMAIL_VERIFY_RATE_LIMIT_MAX) || 5

const notificationEmail = z.union([
  z.string().trim().max(EMAIL_MAX_LENGTH, 'อีเมลยาวเกินไป').email('อีเมลไม่ถูกต้อง')
    .refine((value) => !/[\r\n]/.test(value), 'อีเมลมีอักขระที่ไม่อนุญาต')
    .transform((value) => value.toLowerCase()),
  z.literal('').transform(() => null),
  z.null(),
]).optional()

export const notificationSettingsSchema = z.object({
  notificationEmail,
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  borrowRequestEnabled: z.boolean().optional(),
  approvalEnabled: z.boolean().optional(),
  assignmentEnabled: z.boolean().optional(),
  returnEnabled: z.boolean().optional(),
  helpdeskEnabled: z.boolean().optional(),
  reminderEnabled: z.boolean().optional(),
}).strict()

export const emailConfirmationSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i, 'Verification token ไม่ถูกต้อง'),
}).strict()

const PREFERENCE_SELECT = {
  notificationEmail: true,
  emailVerifiedAt: true,
  emailEnabled: true,
  inAppEnabled: true,
  borrowRequestEnabled: true,
  approvalEnabled: true,
  assignmentEnabled: true,
  returnEnabled: true,
  helpdeskEnabled: true,
  reminderEnabled: true,
  updatedAt: true,
}

const DEFAULT_PREFERENCE_DATA = {
  notificationEmail: null,
  emailVerifiedAt: null,
  emailEnabled: false,
  inAppEnabled: true,
  borrowRequestEnabled: true,
  approvalEnabled: true,
  assignmentEnabled: true,
  returnEnabled: true,
  helpdeskEnabled: true,
  reminderEnabled: true,
}

function serializePreference(preference) {
  const provider = getEmailProviderState()
  return {
    ...preference,
    isEmailVerified: Boolean(preference.notificationEmail && preference.emailVerifiedAt),
    deliveryAvailable: provider.available,
    deliveryStatus: provider.available ? 'READY' : (provider.enabled ? 'NOT_CONFIGURED' : 'DISABLED'),
  }
}

async function preferenceForUser(userId, client = prisma) {
  return client.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...DEFAULT_PREFERENCE_DATA },
    update: {},
    select: PREFERENCE_SELECT,
  })
}

router.get('/', asyncHandler(async (req, res) => {
  ok(res, serializePreference(await preferenceForUser(req.user.id)))
}))

router.put('/', asyncHandler(async (req, res) => {
  const parsed = notificationSettingsSchema.safeParse(req.body)
  if (!parsed.success) return fail(res, 400, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบการตั้งค่า', fromZodError(parsed.error))

  const current = await preferenceForUser(req.user.id)
  const nextEmail = parsed.data.notificationEmail === undefined ? current.notificationEmail : parsed.data.notificationEmail
  const emailChanged = nextEmail !== current.notificationEmail
  const nextVerifiedAt = emailChanged ? null : current.emailVerifiedAt
  if (parsed.data.emailEnabled === true && (!nextEmail || !nextVerifiedAt)) {
    return fail(res, 400, 'กรุณายืนยันอีเมลก่อนเปิดการแจ้งเตือนทางอีเมล', [
      { field: 'emailEnabled', message: 'ต้องยืนยันอีเมลก่อนเปิดใช้งาน' },
    ])
  }

  const data = { ...parsed.data }
  if (emailChanged) data.emailVerifiedAt = null
  if (!nextEmail) data.emailEnabled = false
  const preference = await prisma.$transaction(async (tx) => {
    const updated = await tx.notificationPreference.update({
      where: { userId: req.user.id },
      data,
      select: PREFERENCE_SELECT,
    })
    if (emailChanged) {
      await tx.emailVerificationToken.updateMany({
        where: { userId: req.user.id, usedAt: null },
        data: { usedAt: new Date() },
      })
    }
    await logAudit({
      ...auditContext(req),
      action: 'NOTIFICATION_SETTINGS_UPDATED',
      entityType: 'NotificationPreference',
      description: 'แก้ไขการตั้งค่าการแจ้งเตือนของตนเอง',
      oldValues: { ...current, notificationEmail: current.notificationEmail ? '[configured]' : null },
      newValues: { ...updated, notificationEmail: updated.notificationEmail ? '[configured]' : null },
    }, tx)
    return updated
  })
  ok(res, serializePreference(preference))
}))

router.post('/email/verify', asyncHandler(async (req, res) => {
  const preference = await preferenceForUser(req.user.id)
  if (!preference.notificationEmail) return fail(res, 400, 'กรุณาบันทึกอีเมลสำหรับรับแจ้งเตือนก่อน')
  if (preference.emailVerifiedAt) return ok(res, { alreadyVerified: true })

  const windowStart = new Date(Date.now() - VERIFY_WINDOW_MS)
  const recentCount = await prisma.emailVerificationToken.count({
    where: { userId: req.user.id, createdAt: { gte: windowStart } },
  })
  if (recentCount >= VERIFY_MAX_REQUESTS) {
    return fail(res, 429, 'ขออีเมลยืนยันบ่อยเกินไป กรุณารออย่างน้อย 15 นาทีแล้วลองใหม่')
  }

  const token = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MS)
  const delivery = await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.updateMany({
      where: { userId: req.user.id, usedAt: null },
      data: { usedAt: new Date() },
    })
    const verification = await tx.emailVerificationToken.create({
      data: { userId: req.user.id, email: preference.notificationEmail, tokenHash, expiresAt },
    })
    const outbox = await queueVerificationEmail(tx, {
      userId: req.user.id,
      email: preference.notificationEmail,
      token,
      tokenId: verification.id,
    })
    await logAudit({
      ...auditContext(req), action: 'EMAIL_VERIFICATION_REQUESTED', entityType: 'NotificationPreference',
      description: 'ขอยืนยันอีเมลแจ้งเตือน',
      newValues: { expiresAt, deliveryStatus: outbox?.status || 'SKIPPED' },
    }, tx)
    return outbox
  })
  ok(res, { expiresAt, deliveryStatus: delivery?.status || 'SKIPPED' }, 202)
}))

router.post('/email/confirm', asyncHandler(async (req, res) => {
  const parsed = emailConfirmationSchema.safeParse(req.body)
  if (!parsed.success) return fail(res, 400, 'Verification token ไม่ถูกต้อง', fromZodError(parsed.error))
  const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex')
  const now = new Date()
  const result = await prisma.$transaction(async (tx) => {
    const token = await tx.emailVerificationToken.findUnique({ where: { tokenHash } })
    if (!token || token.userId !== req.user.id || token.usedAt || token.expiresAt <= now) return null
    const preference = await tx.notificationPreference.findUnique({ where: { userId: req.user.id } })
    if (!preference || preference.notificationEmail !== token.email) return null
    const consumed = await tx.emailVerificationToken.updateMany({
      where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    })
    if (consumed.count !== 1) return null
    const updated = await tx.notificationPreference.update({
      where: { userId: req.user.id },
      data: { emailVerifiedAt: now },
      select: PREFERENCE_SELECT,
    })
    await logAudit({
      ...auditContext(req), action: 'EMAIL_VERIFIED', entityType: 'NotificationPreference',
      description: 'ยืนยันอีเมลแจ้งเตือนสำเร็จ', newValues: { emailVerifiedAt: now },
    }, tx)
    return updated
  })
  if (!result) return fail(res, 400, 'ลิงก์ยืนยันไม่ถูกต้อง หมดอายุ หรือถูกใช้งานไปแล้ว')
  ok(res, serializePreference(result))
}))

router.post('/email/test', asyncHandler(async (req, res) => {
  const preference = await preferenceForUser(req.user.id)
  if (!preference.notificationEmail || !preference.emailVerifiedAt) {
    return fail(res, 400, 'กรุณายืนยันอีเมลก่อนส่งอีเมลทดสอบ')
  }
  const windowStart = new Date(Date.now() - VERIFY_WINDOW_MS)
  const recentTests = await prisma.emailOutbox.count({
    where: { dedupeKey: { startsWith: `email-test:${req.user.id}:` }, createdAt: { gte: windowStart } },
  })
  if (recentTests >= VERIFY_MAX_REQUESTS) return fail(res, 429, 'ส่งอีเมลทดสอบบ่อยเกินไป กรุณาลองใหม่ภายหลัง')

  const outbox = await prisma.$transaction(async (tx) => {
    const queued = await queueTestEmail(tx, { userId: req.user.id, email: preference.notificationEmail })
    await logAudit({
      ...auditContext(req), action: 'EMAIL_TEST_QUEUED', entityType: 'EmailOutbox', entityId: queued?.id,
      description: 'ส่งอีเมลทดสอบเข้าสู่คิว', newValues: { deliveryStatus: queued?.status || 'SKIPPED' },
    }, tx)
    return queued
  })
  ok(res, { id: outbox?.id || null, deliveryStatus: outbox?.status || 'SKIPPED' }, 202)
}))

export default router

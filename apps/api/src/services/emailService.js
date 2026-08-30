import { randomUUID } from 'node:crypto'
import { buildEmailTemplate } from './emailTemplates.js'
import { enqueueEmail } from './emailOutbox.js'

export const EMAIL_PREFERENCE_FIELDS = {
  BORROW_REQUEST: 'borrowRequestEnabled',
  APPROVAL: 'approvalEnabled',
  ASSIGNMENT: 'assignmentEnabled',
  RETURN: 'returnEnabled',
  REMINDER: 'reminderEnabled',
  SYSTEM: 'helpdeskEnabled',
}

export function publicAppUrl() {
  const configured = process.env.APP_URL || process.env.FRONTEND_URL || process.env.CORS_ORIGIN?.split(',')[0]
  return String(configured || 'http://localhost:5173').trim().replace(/\/+$/, '')
}

export async function queueNotificationEmail(client, {
  preference, notificationId, userId, title, message, type, dedupeKey,
  preferenceField, templateKey, actionUrl,
}) {
  const field = preferenceField || EMAIL_PREFERENCE_FIELDS[type]
  if (!preference?.notificationEmail || !preference.emailVerifiedAt || !preference.emailEnabled || !preference[field]) return null
  const template = buildEmailTemplate({
    templateKey: templateKey || type,
    title,
    message,
    actionUrl: actionUrl || publicAppUrl(),
  })
  return enqueueEmail(client, {
    notificationId: notificationId || null,
    recipientEmail: preference.notificationEmail,
    subject: template.subject,
    htmlBody: template.html,
    textBody: template.text,
    type,
    dedupeKey: `email:${dedupeKey || notificationId || `${userId}:${randomUUID()}`}`,
  })
}

export async function queueVerificationEmail(client, { userId, email, token, tokenId }) {
  const confirmUrl = `${publicAppUrl()}/?verifyEmail=${encodeURIComponent(token)}`
  const template = buildEmailTemplate({
    templateKey: 'EMAIL_VERIFICATION',
    title: 'ยืนยันอีเมลสำหรับรับการแจ้งเตือน',
    message: 'ลิงก์นี้ใช้ได้ครั้งเดียวและจะหมดอายุภายใน 20 นาที หากคุณไม่ได้เป็นผู้ขอ สามารถละเว้นอีเมลนี้ได้',
    actionUrl: confirmUrl,
    actionLabel: 'ยืนยันอีเมล',
  })
  return enqueueEmail(client, {
    notificationId: null,
    recipientEmail: email,
    subject: template.subject,
    htmlBody: template.html,
    textBody: template.text,
    type: 'SYSTEM',
    dedupeKey: `email-verification:${userId}:${tokenId}`,
  })
}

export async function queueTestEmail(client, { userId, email }) {
  const template = buildEmailTemplate({
    templateKey: 'TEST_EMAIL',
    title: 'ทดสอบการแจ้งเตือนทางอีเมลสำเร็จ',
    message: 'นี่คืออีเมลทดสอบจาก Enterprise IT Asset Management การตั้งค่าของคุณพร้อมใช้งานแล้ว',
    actionUrl: publicAppUrl(),
  })
  return enqueueEmail(client, {
    notificationId: null,
    recipientEmail: email,
    subject: template.subject,
    htmlBody: template.html,
    textBody: template.text,
    type: 'SYSTEM',
    dedupeKey: `email-test:${userId}:${randomUUID()}`,
  })
}

import { prisma } from '../db.js'
import { getEmailProviderState, sendEmail } from './emailProvider.js'

const MAX_ATTEMPTS = Number(process.env.EMAIL_MAX_ATTEMPTS) || 5
const CLAIM_TIMEOUT_MS = 10 * 60 * 1000

export async function enqueueEmail(client, data) {
  const provider = getEmailProviderState()
  const status = provider.available ? 'PENDING' : 'SKIPPED'
  const lastError = provider.available ? null : (provider.enabled ? 'EMAIL_PROVIDER_NOT_CONFIGURED' : 'EMAIL_DISABLED')
  try {
    return await client.emailOutbox.create({
      data: {
        ...data,
        status,
        lastError,
        nextAttemptAt: provider.available ? new Date() : null,
      },
    })
  } catch (error) {
    if (error?.code === 'P2002') return null
    throw error
  }
}

function retryAt(attempts, now) {
  const delayMs = Math.min(60 * 60 * 1000, (2 ** Math.min(attempts, 10)) * 1000)
  return new Date(now.getTime() + delayMs)
}

async function processOutboxItem(item, now) {
  const claimed = await prisma.emailOutbox.updateMany({
    where: {
      id: item.id,
      status: { in: ['PENDING', 'FAILED'] },
      nextAttemptAt: { not: null, lte: now },
    },
    data: { status: 'PROCESSING' },
  })
  if (claimed.count !== 1) return false

  try {
    await sendEmail({
      to: item.recipientEmail,
      subject: item.subject,
      html: item.htmlBody,
      text: item.textBody,
      idempotencyKey: item.dedupeKey,
    })
    await prisma.emailOutbox.update({
      where: { id: item.id },
      data: { status: 'SENT', sentAt: new Date(), lastError: null, nextAttemptAt: null },
    })
    return true
  } catch (error) {
    const attempts = item.attempts + 1
    await prisma.emailOutbox.update({
      where: { id: item.id },
      data: {
        status: 'FAILED',
        attempts,
        nextAttemptAt: attempts >= MAX_ATTEMPTS ? null : retryAt(attempts, now),
        lastError: String(error?.message || error).slice(0, 500),
      },
    })
    return false
  }
}

export async function flushEmailOutbox({ limit = 50, now = new Date() } = {}) {
  await prisma.emailOutbox.updateMany({
    where: { status: 'PROCESSING', updatedAt: { lt: new Date(now.getTime() - CLAIM_TIMEOUT_MS) } },
    data: { status: 'FAILED', nextAttemptAt: now, lastError: 'STALE_PROCESSING_CLAIM' },
  })
  const items = await prisma.emailOutbox.findMany({
    where: {
      status: { in: ['PENDING', 'FAILED'] },
      nextAttemptAt: { not: null, lte: now },
      attempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
  const results = []
  for (const item of items) results.push(await processOutboxItem(item, now))
  return { checked: items.length, sent: results.filter(Boolean).length, failed: results.filter((value) => !value).length }
}

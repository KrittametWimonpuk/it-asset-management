import { timingSafeEqual } from 'node:crypto'
import { fail } from '../utils/response.js'

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function hasValidSchedulerSecret(authorization, configuredSecret = process.env.SCHEDULER_SECRET) {
  if (!configuredSecret || configuredSecret.length < 32 || typeof authorization !== 'string') return false
  const prefix = 'Bearer '
  if (!authorization.startsWith(prefix)) return false
  return safeEqual(authorization.slice(prefix.length), configuredSecret)
}

export function requireSchedulerSecret(req, res, next) {
  if (!hasValidSchedulerSecret(req.get('authorization'))) {
    return fail(res, 401, 'ไม่ได้รับอนุญาตให้เรียก Scheduler')
  }
  return next()
}

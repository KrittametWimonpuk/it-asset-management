import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ok, fail } from '../utils/response.js'
import { buildPageMeta, parsePagination, parseSort } from '../utils/queryParams.js'
import { auditContext, logAudit } from '../utils/auditLog.js'
import {
  NOTIFICATION_PRIORITIES, NOTIFICATION_TYPES,
} from '../services/notificationService.js'

const router = Router()
router.use(requireAuth)

const SORTABLE_FIELDS = ['createdAt', 'priority', 'type', 'isRead']

export function buildNotificationWhere(query, userId) {
  const where = { userId, deletedAt: null }
  if (NOTIFICATION_TYPES.includes(query.type)) where.type = query.type
  if (NOTIFICATION_PRIORITIES.includes(query.priority)) where.priority = query.priority
  if (query.isRead === 'true') where.isRead = true
  if (query.isRead === 'false') where.isRead = false
  const search = (query.search || '').trim()
  if (search) where.OR = [
    { title: { contains: search, mode: 'insensitive' } },
    { message: { contains: search, mode: 'insensitive' } },
  ]
  return where
}

router.get('/', asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query)
  const where = buildNotificationWhere(req.query, req.user.id)
  const orderBy = parseSort(req.query, SORTABLE_FIELDS, 'createdAt')
  const [items, totalItems] = await Promise.all([
    prisma.notification.findMany({ where, orderBy, skip: pagination.skip, take: pagination.take }),
    prisma.notification.count({ where }),
  ])
  ok(res, { items, ...buildPageMeta(pagination, totalItems) })
}))

router.get('/unread-count', asyncHandler(async (req, res) => {
  const count = await prisma.notification.count({
    where: { userId: req.user.id, isRead: false, deletedAt: null },
  })
  ok(res, { count })
}))

router.post('/read-all', asyncHandler(async (req, res) => {
  const readAt = new Date()
  const changed = await prisma.notification.updateMany({
    where: { userId: req.user.id, isRead: false, deletedAt: null },
    data: { isRead: true, readAt },
  })
  if (changed.count > 0) {
    await logAudit({
      ...auditContext(req), action: 'NOTIFICATION_READ', entityType: 'Notification',
      description: `อ่านการแจ้งเตือนทั้งหมด ${changed.count} รายการ`,
      newValues: { count: changed.count, readAt },
    })
  }
  ok(res, { count: changed.count, readAt })
}))

router.post('/:id/read', asyncHandler(async (req, res) => {
  const item = await prisma.notification.findFirst({
    where: { id: req.params.id, userId: req.user.id, deletedAt: null },
  })
  if (!item) return fail(res, 404, 'ไม่พบการแจ้งเตือนนี้')
  const readAt = item.readAt || new Date()
  const notification = item.isRead ? item : await prisma.notification.update({
    where: { id: item.id }, data: { isRead: true, readAt },
  })
  if (!item.isRead) {
    await logAudit({
      ...auditContext(req), action: 'NOTIFICATION_READ', entityType: 'Notification', entityId: item.id,
      description: `อ่านการแจ้งเตือน: ${item.title}`,
      oldValues: { isRead: false }, newValues: { isRead: true, readAt },
    })
  }
  ok(res, notification)
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  const changed = await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user.id, deletedAt: null },
    data: { deletedAt: new Date() },
  })
  if (changed.count !== 1) return fail(res, 404, 'ไม่พบการแจ้งเตือนนี้')
  ok(res, { id: req.params.id, deleted: true })
}))

export default router

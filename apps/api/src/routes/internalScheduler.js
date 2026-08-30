import { Router } from 'express'
import { requireSchedulerSecret } from '../middleware/schedulerAuth.js'
import { runSchedulerTick } from '../jobs/runScheduler.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ok } from '../utils/response.js'

const router = Router()

// Operational endpoint for an external scheduler. It is intentionally outside Swagger and
// protected by a dedicated secret instead of a user JWT, so scheduled jobs do not impersonate users.
router.post('/run', requireSchedulerSecret, asyncHandler(async (_req, res) => {
  const result = await runSchedulerTick()
  return ok(res, result)
}))

export default router

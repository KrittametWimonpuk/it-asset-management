// ---------------------------------------------------------------------------
// Route: /api/locations — สถานที่ตั้งครุภัณฑ์ (master data)
// ---------------------------------------------------------------------------
import { z } from 'zod'
import { prisma } from '../db.js'
import { createMasterDataRouter } from '../utils/masterDataRouter.js'
import { optionalText } from '../utils/zodHelpers.js'

const createSchema = z.object({
  name: z.string().trim().min(1, 'กรุณาใส่ชื่อสถานที่'),
  description: optionalText(),
  isActive: z.boolean().optional(),
})
const updateSchema = createSchema.partial()

export default createMasterDataRouter({
  model: prisma.location,
  entityLabel: 'สถานที่',
  entityType: 'Location',
  createSchema,
  updateSchema,
})

// ---------------------------------------------------------------------------
// Route: /api/departments — แผนกที่ครอบครอง/ดูแลครุภัณฑ์ (master data)
// ---------------------------------------------------------------------------
import { z } from 'zod'
import { prisma } from '../db.js'
import { createMasterDataRouter } from '../utils/masterDataRouter.js'
import { optionalText } from '../utils/zodHelpers.js'

const createSchema = z.object({
  name: z.string().trim().min(1, 'กรุณาใส่ชื่อแผนก'),
  description: optionalText(),
  isActive: z.boolean().optional(),
})
const updateSchema = createSchema.partial()

export default createMasterDataRouter({
  model: prisma.department,
  entityLabel: 'แผนก',
  entityType: 'Department',
  createSchema,
  updateSchema,
})

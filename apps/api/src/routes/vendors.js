// ---------------------------------------------------------------------------
// Route: /api/vendors — ผู้ขาย/ผู้ผลิตครุภัณฑ์ (master data)
// ---------------------------------------------------------------------------
import { z } from 'zod'
import { prisma } from '../db.js'
import { createMasterDataRouter } from '../utils/masterDataRouter.js'
import { optionalText, optionalEmail } from '../utils/zodHelpers.js'

const createSchema = z.object({
  name: z.string().trim().min(1, 'กรุณาใส่ชื่อผู้ขาย/ผู้ผลิต'),
  contactName: optionalText(),
  phone: optionalText(),
  email: optionalEmail(),
  website: optionalText(),
  address: optionalText(),
  isActive: z.boolean().optional(),
})
const updateSchema = createSchema.partial()

export default createMasterDataRouter({
  model: prisma.vendor,
  entityLabel: 'ผู้ขาย/ผู้ผลิต',
  entityType: 'Vendor',
  createSchema,
  updateSchema,
  // ให้ค้นหาจากชื่อผู้ติดต่อ/อีเมลได้ด้วย นอกเหนือจาก name
  searchableFields: ['contactName', 'email'],
})

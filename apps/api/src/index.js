// ---------------------------------------------------------------------------
// จุดเริ่มต้นของ Backend (Express)
// รับ request จาก frontend แล้วส่งต่อไปยัง route ต่าง ๆ
// ---------------------------------------------------------------------------
import express from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from './docs/openapi.js'
import authRoutes from './routes/auth.js'
import assetRoutes from './routes/assets.js'
import categoryRoutes from './routes/categories.js'
import locationRoutes from './routes/locations.js'
import departmentRoutes from './routes/departments.js'
import vendorRoutes from './routes/vendors.js'
import userRoutes from './routes/users.js'
import assignmentRoutes from './routes/assignments.js'
import dashboardRoutes from './routes/dashboard.js'
import ticketRoutes from './routes/tickets.js'
import reportRoutes from './routes/reports.js'
import auditRoutes from './routes/audit.js'
import { fail } from './utils/response.js'

const app = express()

app.use(cors())            // อนุญาตให้ frontend คนละ origin เรียกได้ (ตอน dev)
app.use(express.json())    // แปลง request body ที่เป็น JSON ให้อ่านง่าย

// ---- Health check ----
// ใช้ให้ AWS (ALB) เช็กว่าเซิร์ฟเวอร์ยังมีชีวิตอยู่ไหม — ต้องตอบ 200 เสมอ
// (คงรูปแบบเดิมไว้ตรง ๆ เพราะเป็น endpoint ระดับ infrastructure ไม่ใช่ endpoint ที่ frontend ใช้แสดงผล)
const health = (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() })
app.get('/health', health)
app.get('/api/health', health)

// ---- Milestone 8.1: เอกสาร API (Swagger UI) — ดูรายละเอียดที่ src/docs/ ----
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// ---- รวม route ----
app.use('/api/auth', authRoutes)
app.use('/api/assets', assetRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/locations', locationRoutes)
app.use('/api/departments', departmentRoutes)
app.use('/api/vendors', vendorRoutes)
app.use('/api/users', userRoutes)
app.use('/api/assignments', assignmentRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/tickets', ticketRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/audit', auditRoutes)

// ---- ดักกรณีเรียก path ที่ไม่มี ----
app.use((_req, res) => fail(res, 404, 'ไม่พบ endpoint นี้'))

// ---- ดัก error ที่หลุดมาจาก route (ผ่าน asyncHandler) ----
// ไม่ส่งข้อความ error ดิบจาก Prisma/database ออกไปให้ผู้ใช้เห็นเด็ดขาด
// แปลง error ที่รู้จัก (เช่น unique constraint ชนกันตอน request พร้อมกันหลาย ๆ อัน) ให้เป็นข้อความที่เป็นมิตรแทน
app.use((err, _req, res, _next) => {
  console.error(err)

  // P2002 = unique constraint ชนกัน (กรณี race condition ที่หลุดผ่านการเช็กล่วงหน้าไปได้)
  if (err?.code === 'P2002') {
    const field = Array.isArray(err.meta?.target) ? err.meta.target[0] : 'ข้อมูล'
    return fail(res, 409, 'ข้อมูลนี้ถูกใช้ไปแล้ว', [{ field, message: `ค่านี้ถูกใช้ไปแล้ว` }])
  }
  // P2025 = ไม่พบ record ที่จะแก้ไข/ลบ (เช่นถูกลบไปพร้อมกันจาก request อื่น)
  if (err?.code === 'P2025') {
    return fail(res, 404, 'ไม่พบข้อมูลที่ต้องการ')
  }

  return fail(res, 500, 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง')
})

const port = process.env.PORT || 4000
app.listen(port, () => console.log(`API listening on http://localhost:${port}`))

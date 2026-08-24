// ---------------------------------------------------------------------------
// จุดเริ่มต้นของ Backend (Express)
// รับ request จาก frontend แล้วส่งต่อไปยัง route ต่าง ๆ
// ---------------------------------------------------------------------------
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from './docs/openapi.js'
import { prisma } from './db.js'
import { buildCorsOptions } from './utils/corsOptions.js'
import { requestLogger } from './middleware/requestLogger.js'
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
import employeeRoutes from './routes/employees.js'
import { fail } from './utils/response.js'

const app = express()

// ---- RC2: Production Hardening ----
// helmet ใส่ security header มาตรฐาน (X-Content-Type-Options, X-Frame-Options, HSTS ฯลฯ) ให้อัตโนมัติ
// ปิดเฉพาะ contentSecurityPolicy — ค่า default ของ helmet บล็อก inline <script>/<style> ที่
// swagger-ui-express (mount ที่ /docs ด้านล่าง) ต้องใช้เพื่อ render หน้า Swagger UI ได้ ส่วน header
// อื่นทั้งหมดยังเปิดใช้งานตามปกติ (เอาออกเฉพาะตัวที่จะทำ Swagger พังจริง ๆ เท่านั้น)
app.use(helmet({ contentSecurityPolicy: false }))

// อนุญาตเฉพาะ origin ที่ตั้งค่าไว้ใน CORS_ORIGIN (ไม่ hardcode) — ดู utils/corsOptions.js
app.use(cors(buildCorsOptions()))

// เขียน log แบบ structured ทุก request (ไม่มีข้อมูลอ่อนไหวปน) — ดู middleware/requestLogger.js
app.use(requestLogger)

app.use(express.json())    // แปลง request body ที่เป็น JSON ให้อ่านง่าย

// ---- Health check ----
// ใช้ให้ AWS (ALB) เช็กว่าเซิร์ฟเวอร์ยังมีชีวิตอยู่ไหม — RC2: เช็กการเชื่อมต่อฐานข้อมูลจริงด้วย ไม่ใช่
// แค่ตอบ 200 เฉย ๆ เหมือนเดิม เพราะ instance ที่ยัง "มีชีวิต" (process รันอยู่) แต่ต่อ DB ไม่ได้ ก็ใช้
// งานจริงไม่ได้อยู่ดี — ALB ควรเลิกส่ง traffic มาให้ instance แบบนั้น (ตอบ 503 แทน 200)
const health = async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', time: new Date().toISOString(), database: 'connected' })
  } catch (err) {
    console.error('Health check failed — database unreachable:', err)
    res.status(503).json({ status: 'error', time: new Date().toISOString(), database: 'disconnected' })
  }
}
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
app.use('/api/employees', employeeRoutes)

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
const server = app.listen(port, () => console.log(`API listening on http://localhost:${port}`))

// ---- RC2: Graceful shutdown ----
// ECS (และ orchestrator ทั่วไป) ส่ง SIGTERM มาก่อนฆ่า container จริงทุกครั้งที่ deploy ใหม่/scale in —
// ถ้าไม่ดักไว้ request ที่กำลังทำงานอยู่ตอนนั้นจะถูกตัดทันที (ผู้ใช้เห็น error กลางอากาศทุกครั้งที่ deploy)
// ลำดับตอน shutdown: (1) เลิกรับ connection ใหม่ แต่ request ที่ค้างอยู่ทำต่อจนจบตามปกติ (พฤติกรรม
// มาตรฐานของ server.close()) (2) พอ request ที่ค้างอยู่ทั้งหมดจบแล้ว callback จะทำงาน (3) ปิดการเชื่อมต่อ
// ฐานข้อมูลให้เรียบร้อย (4) exit ด้วย status code ที่เหมาะสม — มี timer บังคับปิดถ้ารอนานเกินไป (กัน
// process ค้างไม่ยอมจบ เช่น มี keep-alive connection ที่ไม่มีวันปิดเองค้างอยู่)
function shutdown(signal) {
  console.log(`ได้รับสัญญาณ ${signal} — เริ่มขั้นตอนปิดเซิร์ฟเวอร์...`)

  const forceExitTimer = setTimeout(() => {
    console.error('ปิดเซิร์ฟเวอร์ไม่ทันเวลาที่กำหนด — บังคับ exit')
    process.exit(1)
  }, 10000)
  forceExitTimer.unref() // ไม่ต้องรอ timer นี้ถ้า process จบตามปกติได้ก่อน

  server.close(async (err) => {
    if (err) {
      console.error('เกิดข้อผิดพลาดตอนปิด HTTP server:', err)
      clearTimeout(forceExitTimer)
      process.exit(1)
    }
    console.log('ปิด HTTP server แล้ว (ไม่รับ connection ใหม่ + request ที่ค้างอยู่ทำงานจบครบแล้ว)')

    try {
      await prisma.$disconnect()
      console.log('ปิดการเชื่อมต่อฐานข้อมูลเรียบร้อย')
    } catch (disconnectErr) {
      console.error('เกิดข้อผิดพลาดตอนปิดการเชื่อมต่อฐานข้อมูล:', disconnectErr)
    }

    clearTimeout(forceExitTimer)
    console.log('ปิดเซิร์ฟเวอร์เรียบร้อยแล้ว')
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

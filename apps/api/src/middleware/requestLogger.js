// ---------------------------------------------------------------------------
// Request logging — RC2: Production Hardening (Milestone 11)
//
// เขียน log แบบ structured (JSON บรรทัดเดียวต่อ 1 request) ออกทาง stdout ให้ log collector ของ
// สภาพแวดล้อม production ดึงไปเก็บได้ (เช่น AWS CloudWatch Logs ที่ ECS ส่งเข้าไปอยู่แล้ว — ดู
// deploy/task-def-api.json: logConfiguration) แทนที่จะไม่มี log คำขอเข้าเลยเหมือนเดิม
//
// ตั้งใจไม่ log สิ่งที่อ่อนไหว: ไม่ log request body (มี password ตอน login/register), ไม่ log
// header ใด ๆ (มี Authorization: Bearer <JWT>), ไม่ log query string (อาจมีข้อมูลค้นหาที่ไม่ควร
// เก็บถาวรในระบบ log) — log แค่ metadata ระดับ request ที่จำเป็นสำหรับ debug/สังเกตการณ์เท่านั้น
// ---------------------------------------------------------------------------
import { randomUUID } from 'crypto'

export function requestLogger(req, res, next) {
  const requestId = randomUUID()
  const startedAt = process.hrtime.bigint()

  // แนบ request id ไว้ให้ response header ด้วย — ผู้ใช้/ทีม support อ้างอิงตอนแจ้งปัญหาได้
  req.requestId = requestId
  res.setHeader('X-Request-Id', requestId)

  // เขียน log ตอน response จบแล้วเท่านั้น (ถึงจะรู้ status code + ระยะเวลารวมที่แท้จริง)
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6
    const entry = {
      requestId,
      method: req.method,
      path: req.path, // ไม่รวม query string โดยเจตนา
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip: req.ip,
    }
    console.log(JSON.stringify(entry))
  })

  next()
}

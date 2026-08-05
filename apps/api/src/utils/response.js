// ---------------------------------------------------------------------------
// Response helpers — ให้ทุก endpoint ตอบกลับด้วยรูปแบบเดียวกันเสมอ
//
//   สำเร็จ:  { success: true, data: ... }
//   ผิดพลาด: { success: false, message: "...", errors: [...] (ถ้ามี) }
//
// ใช้ฟังก์ชันพวกนี้แทนการเขียน res.json(...) ตรง ๆ ทุกที่ เพื่อไม่ให้รูปแบบเพี้ยน
// ---------------------------------------------------------------------------

// ---- ตอบสำเร็จ ----
export function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data })
}

// ---- ตอบผิดพลาด ----
// errors (ถ้ามี) = array ของ { field, message } ใช้บอกว่าฟิลด์ไหนผิดบ้าง
export function fail(res, status, message, errors) {
  const body = { success: false, message }
  if (errors && errors.length) body.errors = errors
  return res.status(status).json(body)
}

// ---- แปลง error จาก Zod ให้เป็น array { field, message } อ่านง่าย ----
export function fromZodError(zodError) {
  return zodError.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }))
}

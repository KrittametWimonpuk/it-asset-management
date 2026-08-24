// ---------------------------------------------------------------------------
// ตัวช่วยจัดรูปแบบข้อมูลที่ใช้ซ้ำหลายหน้า (Assets.jsx, Assignments.jsx)
// ---------------------------------------------------------------------------

const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Bangkok',
})

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Bangkok',
})

function safeDate(iso) {
  const value = new Date(iso)
  return Number.isNaN(value.getTime()) ? null : value
}

// แปลง ISO date string เป็นรูปแบบเดียวกันทั้งระบบ เช่น "05/08/2026"
export function formatDate(iso) {
  const value = safeDate(iso)
  return value ? DATE_FORMATTER.format(value) : '—'
}

// วันที่พร้อมเวลาใช้มาตรฐานเดียวกัน เช่น "05/08/2026 14:32" — ใช้กับ Audit Log
// (Milestone 9) ที่ต้องดูเวลาละเอียดระดับนาทีด้วย ไม่ใช่แค่วันที่เหมือนหน้าอื่น
export function formatDateTime(iso) {
  const value = safeDate(iso)
  return value ? DATE_TIME_FORMATTER.format(value).replace(',', '') : '—'
}

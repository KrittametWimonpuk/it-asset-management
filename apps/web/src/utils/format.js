// ---------------------------------------------------------------------------
// ตัวช่วยจัดรูปแบบข้อมูลที่ใช้ซ้ำหลายหน้า (Assets.jsx, Assignments.jsx)
// ---------------------------------------------------------------------------

// แปลง ISO date string เป็นรูปแบบวันที่ไทยอ่านง่าย เช่น "5 ส.ค. 2569"
export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}

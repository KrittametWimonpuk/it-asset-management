// ---------------------------------------------------------------------------
// ตัวช่วยจัดรูปแบบข้อมูลที่ใช้ซ้ำหลายหน้า (Assets.jsx, Assignments.jsx)
// ---------------------------------------------------------------------------

// แปลง ISO date string เป็นรูปแบบวันที่ไทยอ่านง่าย เช่น "5 ส.ค. 2569"
export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}

// แปลง ISO date string เป็นวันที่ + เวลาไทยอ่านง่าย เช่น "5 ส.ค. 2569 14:32" — ใช้กับ Audit Log
// (Milestone 9) ที่ต้องดูเวลาละเอียดระดับนาทีด้วย ไม่ใช่แค่วันที่เหมือนหน้าอื่น
export function formatDateTime(iso) {
  return new Date(iso).toLocaleString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

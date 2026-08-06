// ---------------------------------------------------------------------------
// ตัวช่วยเกี่ยวกับ "ผู้ถือครองปัจจุบัน" (current holder) — Milestone 5
// ใช้ร่วมกันระหว่าง routes/assets.js และ routes/assignments.js กันไม่ให้เขียนเงื่อนไข
// "assignment ที่ยัง active" ซ้ำหลายที่ (ตาม Asset.ownerId ที่ deprecated ไปแล้ว)
// ---------------------------------------------------------------------------

// เงื่อนไข assignment ที่ "ยัง active" (ยังไม่คืน + ยังไม่ถูกลบ)
// ใช้ทั้งหาผู้ถือครองปัจจุบัน และเช็กก่อนมอบหมายใหม่ว่ามี assignment ค้างอยู่ไหม
export const ACTIVE_ASSIGNMENT_WHERE = { returnedAt: null, deletedAt: null }

// แนบไปกับ prisma include ของ Asset เพื่อดึง assignment ที่ active (ถ้ามี — มีได้สูงสุด 1 แถวเสมอ)
// พร้อมข้อมูลผู้ถือครองมาด้วย ใช้แสดง "ผู้ถือครองปัจจุบัน" โดยไม่ต้องยิง query แยก
export const CURRENT_ASSIGNMENT_INCLUDE = {
  where: ACTIVE_ASSIGNMENT_WHERE,
  take: 1,
  include: { user: { select: { id: true, name: true, email: true } } },
}

// แปลง asset ที่ query มาพร้อม assignments (จาก CURRENT_ASSIGNMENT_INCLUDE) + _count ให้เป็นรูปแบบใช้ง่ายฝั่ง frontend
// currentAssignment = null ถ้ายังไม่มีใครถือครองอยู่, assignmentHistoryCount = จำนวนประวัติทั้งหมด (รวมที่คืนแล้ว)
export function shapeAssetWithAssignment(asset) {
  const { assignments, _count, ...rest } = asset
  return {
    ...rest,
    currentAssignment: assignments?.[0] || null,
    assignmentHistoryCount: _count?.assignments ?? 0,
  }
}

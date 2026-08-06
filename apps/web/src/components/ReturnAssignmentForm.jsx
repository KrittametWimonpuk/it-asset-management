// ---------------------------------------------------------------------------
// ReturnAssignmentForm — ฟอร์มรับคืนครุภัณฑ์ (ปิดรายการมอบหมาย) — Milestone 5
// ผลลัพธ์เป็นได้ทั้งคืนปกติ / สูญหาย / เสียหาย (default คืนปกติ) — ตั้ง returnedAt เสมอเมื่อบันทึกสำเร็จ
// ซึ่งจะ "เคลียร์ผู้ถือครองปัจจุบัน" ของ asset นั้นโดยอัตโนมัติ (ดู utils/assignmentHelpers.js ฝั่ง backend)
// ---------------------------------------------------------------------------
import { useState } from 'react'
import { CONDITION_OPTIONS } from './AssetForm.jsx'

// ใช้ร่วมกับ Assignments.jsx (label สถานะในตาราง/ตัวกรอง) — ต้องตรงกับ enum AssignmentStatus ใน schema.prisma
export const ASSIGNMENT_STATUS_OPTIONS = [
  { value: 'ASSIGNED', label: 'กำลังถือครอง' },
  { value: 'RETURNED', label: 'คืนแล้ว' },
  { value: 'LOST', label: 'สูญหาย' },
  { value: 'DAMAGED', label: 'เสียหาย' },
]

// ผลลัพธ์ตอน "รับคืน" — ไม่รวม ASSIGNED (นั่นคือสถานะตอนเริ่มมอบหมาย ไม่ใช่ผลตอนปิดรายการ)
const RETURN_STATUS_OPTIONS = ASSIGNMENT_STATUS_OPTIONS.filter((s) => s.value !== 'ASSIGNED')

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

export default function ReturnAssignmentForm({ assignment, onSubmit, onCancel }) {
  const [status, setStatus] = useState('RETURNED')
  const [conditionAfter, setConditionAfter] = useState('')
  const [remark, setRemark] = useState('')
  const [returnedAt, setReturnedAt] = useState(todayInputValue())
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setFieldErrors({})
    setBusy(true)
    try {
      await onSubmit({ status, conditionAfter, remark: remark.trim(), returnedAt })
    } catch (err) {
      setError(err.message)
      if (err.errors) {
        const errs = {}
        err.errors.forEach(({ field, message }) => { errs[field] = message })
        setFieldErrors(errs)
      }
      setBusy(false)
    }
  }

  return (
    <div className="overlay" onClick={busy ? undefined : onCancel}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <h2>รับคืนครุภัณฑ์</h2>
        <div className="delete-summary">
          <div className="delete-summary-tag">{assignment.asset?.assetTag}</div>
          <div className="delete-summary-name">
            {assignment.asset?.name} — ถือครองโดย {assignment.user?.name || assignment.user?.email}
          </div>
        </div>

        <form onSubmit={submit} noValidate>
          <label>วันที่คืน</label>
          <input
            type="date"
            value={returnedAt}
            onChange={(e) => setReturnedAt(e.target.value)}
            className={fieldErrors.returnedAt ? 'invalid' : ''}
          />
          {fieldErrors.returnedAt && <p className="field-error">{fieldErrors.returnedAt}</p>}

          <label>สถานะ</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {RETURN_STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <label>สภาพหลังคืน</label>
          <select value={conditionAfter} onChange={(e) => setConditionAfter(e.target.value)}>
            <option value="">ไม่ระบุ</option>
            {CONDITION_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <label>หมายเหตุ</label>
          <textarea rows={2} value={remark} onChange={(e) => setRemark(e.target.value)} />

          {error && <p className="error">{error}</p>}

          <div className="row mt end">
            <button type="button" className="secondary" onClick={onCancel} disabled={busy}>ยกเลิก</button>
            <button type="submit" disabled={busy}>{busy ? 'กำลังบันทึก...' : 'ยืนยันรับคืน'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

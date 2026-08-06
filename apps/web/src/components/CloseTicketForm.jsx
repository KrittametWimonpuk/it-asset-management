// ---------------------------------------------------------------------------
// CloseTicketForm — ฟอร์มปิดงานใบแจ้งซ่อม (ขั้นตอนสุดท้าย) — Milestone 7
// ใช้ได้เฉพาะตั๋วที่สถานะ RESOLVED เท่านั้น (backend ปฏิเสธถ้าไม่ใช่ — ดู routes/tickets.js: close)
// ไม่มีฟิลด์บังคับเพิ่ม (สรุปวิธีแก้ไขบันทึกไว้แล้วตอนแก้ไขสำเร็จ) — แสดงย้อนดูให้มั่นใจก่อนปิดงานจริง
// ---------------------------------------------------------------------------
import { useState } from 'react'

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

export default function CloseTicketForm({ ticket, onSubmit, onCancel }) {
  const [closedAt, setClosedAt] = useState(todayInputValue())
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setFieldErrors({})
    setBusy(true)
    try {
      await onSubmit({ closedAt })
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
        <h2>ปิดงานใบแจ้งซ่อม</h2>
        <div className="delete-summary">
          <div className="delete-summary-tag">{ticket.ticketNumber}</div>
          <div className="delete-summary-name">
            {ticket.title} — {ticket.asset?.assetTag} {ticket.asset?.name}
          </div>
        </div>
        <p className="muted mt">สรุปวิธีแก้ไข: {ticket.resolution || '-'}</p>

        <form onSubmit={submit} noValidate>
          <label htmlFor="close-date">วันที่ปิดงาน</label>
          <input
            id="close-date"
            type="date"
            value={closedAt}
            onChange={(e) => setClosedAt(e.target.value)}
            className={fieldErrors.closedAt ? 'invalid' : ''}
          />
          {fieldErrors.closedAt && <p className="field-error">{fieldErrors.closedAt}</p>}

          {error && <p className="error">{error}</p>}

          <div className="row mt end">
            <button type="button" className="secondary" onClick={onCancel} disabled={busy}>ยกเลิก</button>
            <button type="submit" disabled={busy}>{busy ? 'กำลังบันทึก...' : 'ยืนยันปิดงาน'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

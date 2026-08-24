// ---------------------------------------------------------------------------
// ResolveTicketForm — ฟอร์มบันทึกว่าแก้ไขปัญหาสำเร็จแล้ว (ปิดขั้นตอนดำเนินการ) — Milestone 7
// ใช้ได้เฉพาะตั๋วที่สถานะ IN_PROGRESS เท่านั้น (backend ปฏิเสธถ้าไม่ใช่ — ดู routes/tickets.js: resolve)
// บังคับสรุปวิธีแก้ไข (resolution) เสมอ ตั้ง resolvedAt เมื่อบันทึกสำเร็จ สถานะเปลี่ยนเป็น RESOLVED
// ---------------------------------------------------------------------------
import { useState, useRef, useEffect } from 'react'
import { useDialogDismiss } from '../hooks/useDialogDismiss.js'
import DateInput from './DateInput.jsx'

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

export default function ResolveTicketForm({ ticket, onSubmit, onCancel }) {
  const [resolution, setResolution] = useState('')
  const [resolvedAt, setResolvedAt] = useState(todayInputValue())
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const firstInputRef = useRef(null)
  useDialogDismiss(onCancel, busy)

  useEffect(() => { firstInputRef.current?.focus() }, [])

  async function submit(e) {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    const trimmed = resolution.trim()
    if (!trimmed) {
      setFieldErrors({ resolution: 'กรุณาสรุปวิธีแก้ไขปัญหา' })
      return
    }

    setBusy(true)
    try {
      await onSubmit({ resolution: trimmed, resolvedAt })
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
      <div className="card modal" role="dialog" aria-modal="true" aria-label="บันทึกแก้ไขปัญหาสำเร็จ" onClick={(e) => e.stopPropagation()}>
        <h2>บันทึกแก้ไขปัญหาสำเร็จ</h2>
        <div className="delete-summary">
          <div className="delete-summary-tag">{ticket.ticketNumber}</div>
          <div className="delete-summary-name">
            {ticket.title} — {ticket.asset?.assetTag} {ticket.asset?.name}
          </div>
        </div>

        <form onSubmit={submit} noValidate>
          <label htmlFor="resolve-date">วันที่แก้ไขเสร็จ</label>
          <DateInput
            id="resolve-date"
            value={resolvedAt}
            onChange={setResolvedAt}
            className={fieldErrors.resolvedAt ? 'invalid' : ''}
          />
          {fieldErrors.resolvedAt && <p className="field-error">{fieldErrors.resolvedAt}</p>}

          <label htmlFor="resolve-text">สรุปวิธีแก้ไขปัญหา *</label>
          <textarea
            id="resolve-text"
            ref={firstInputRef}
            rows={3}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            className={fieldErrors.resolution ? 'invalid' : ''}
          />
          {fieldErrors.resolution && <p className="field-error">{fieldErrors.resolution}</p>}

          {error && <p className="error">{error}</p>}

          <div className="row mt end">
            <button type="button" className="secondary" onClick={onCancel} disabled={busy}>ยกเลิก</button>
            <button type="submit" disabled={busy}>{busy ? 'กำลังบันทึก...' : 'ยืนยันแก้ไขสำเร็จ'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

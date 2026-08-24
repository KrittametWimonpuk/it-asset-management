// ---------------------------------------------------------------------------
// TicketForm — ฟอร์มเดียวใช้ได้ทั้ง "แจ้งปัญหาใหม่" และ "แก้ไขรายละเอียด/มอบหมาย" (Milestone 7)
//
// ถ้ามี prop `ticket` = โหมดแก้ไข/มอบหมาย (ADMIN/IT_STAFF เท่านั้น — Tickets.jsx เปิดโหมดนี้ให้เฉพาะ
// role ที่มีสิทธิ์) — แก้ได้ทุกฟิลด์ยกเว้นครุภัณฑ์/ผู้แจ้ง (ข้อมูลหลักของตั๋วที่ห้ามเปลี่ยน) และสถานะเปลี่ยนได้
// เฉพาะ OPEN/IN_PROGRESS/ON_HOLD เท่านั้น (RESOLVED/CLOSED ต้องผ่านฟอร์มรับเรื่องสำเร็จ/ปิดงานโดยเฉพาะ)
// ถ้าไม่มี = โหมดแจ้งปัญหาใหม่ — ทุก role แจ้งได้ (EMPLOYEE เลือกได้เฉพาะครุภัณฑ์ที่ตัวเองถือครองอยู่
// ซึ่ง backend กรองให้อัตโนมัติอยู่แล้วผ่าน api.listAssets ตัวเดียวกัน ไม่ต้องแยก endpoint)
// ---------------------------------------------------------------------------
import { useState, useRef, useEffect } from 'react'
import { api } from '../api.js'
import { useDialogDismiss } from '../hooks/useDialogDismiss.js'

export const TICKET_STATUS_OPTIONS = [
  { value: 'OPEN', label: 'เปิดใหม่' },
  { value: 'IN_PROGRESS', label: 'กำลังดำเนินการ' },
  { value: 'ON_HOLD', label: 'พักงาน' },
  { value: 'RESOLVED', label: 'แก้ไขสำเร็จ' },
  { value: 'CLOSED', label: 'ปิดงานแล้ว' },
]

export const TICKET_PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'ต่ำ' },
  { value: 'MEDIUM', label: 'ปานกลาง' },
  { value: 'HIGH', label: 'สูง' },
  { value: 'CRITICAL', label: 'วิกฤต' },
]

export const TICKET_CATEGORY_OPTIONS = [
  { value: 'HARDWARE', label: 'ฮาร์ดแวร์' },
  { value: 'SOFTWARE', label: 'ซอฟต์แวร์' },
  { value: 'NETWORK', label: 'เครือข่าย' },
  { value: 'PRINTER', label: 'เครื่องพิมพ์' },
  { value: 'ACCOUNT', label: 'บัญชีผู้ใช้' },
  { value: 'OTHER', label: 'อื่น ๆ' },
]

// เหมือน TICKET_TRANSITIONS ฝั่ง backend (utils/ticketHelpers.js) แต่ตัดเหลือแค่ทางที่ PUT ทั่วไปแก้ได้
// (ไม่รวม RESOLVED — ต้องผ่านฟอร์มรับเรื่องสำเร็จเท่านั้น) — ใช้จำกัดตัวเลือกใน dropdown ให้ตรงกับที่
// backend จะยอมรับจริง กัน submit แล้วโดนปฏิเสธ แต่ backend ก็ยังตรวจซ้ำเองอยู่ดี ไม่ได้พึ่งพาหน้านี้อย่างเดียว
const EDITABLE_STATUS_TRANSITIONS = {
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['ON_HOLD'],
  ON_HOLD: ['IN_PROGRESS'],
}

const emptyForm = {
  assetId: '',
  title: '',
  description: '',
  priority: 'MEDIUM',
  category: '',
  assignedToId: '',
  status: '',
}

const REQUIRED_MESSAGES = {
  assetId: 'กรุณาเลือกครุภัณฑ์',
  title: 'กรุณาใส่หัวข้อปัญหา',
  description: 'กรุณาใส่รายละเอียดปัญหา',
  category: 'กรุณาเลือกหมวดหมู่ปัญหา',
}

export default function TicketForm({ ticket, onSubmit, onCancel }) {
  const isEdit = Boolean(ticket)
  const [form, setForm] = useState(() => {
    if (!ticket) return { ...emptyForm }
    return {
      ...emptyForm,
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      category: ticket.category,
      assignedToId: ticket.assignedToId || '',
      status: ticket.status,
    }
  })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const firstInputRef = useRef(null)
  useDialogDismiss(onCancel, busy)

  // โหมดแจ้งใหม่: ตัวเลือกครุภัณฑ์ (backend กรองตาม role ให้อัตโนมัติอยู่แล้ว — EMPLOYEE เห็นเฉพาะของตัวเอง)
  // โหมดแก้ไข: รายชื่อ ADMIN/IT_STAFF ที่มอบหมายให้ดูแลได้ (มอบหมายให้ EMPLOYEE ไม่ได้)
  const [assetOptions, setAssetOptions] = useState(null)
  const [staffOptions, setStaffOptions] = useState(null)
  const [optionsError, setOptionsError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (isEdit) {
      api.users.list({ pageSize: 100, sortBy: 'name', sortOrder: 'asc' })
        .then((res) => { if (!cancelled) setStaffOptions(res.items.filter((u) => u.role !== 'EMPLOYEE')) })
        .catch((err) => { if (!cancelled) setOptionsError(err.message) })
    } else {
      api.listAssets({ pageSize: 100, sortBy: 'assetTag', sortOrder: 'asc' })
        .then((res) => { if (!cancelled) setAssetOptions(res.items) })
        .catch((err) => { if (!cancelled) setOptionsError(err.message) })
    }
    return () => { cancelled = true }
  }, [isEdit])

  useEffect(() => { firstInputRef.current?.focus() }, [])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    if (fieldErrors[field]) {
      setFieldErrors((fe) => { const next = { ...fe }; delete next[field]; return next })
    }
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    const trimmedTitle = form.title.trim()
    const trimmedDescription = form.description.trim()

    const requiredFields = isEdit ? ['category'] : ['assetId', 'category']
    const missing = requiredFields.filter((f) => !form[f])
    if (!trimmedTitle) missing.push('title')
    if (!trimmedDescription) missing.push('description')
    if (missing.length > 0) {
      const errs = {}
      missing.forEach((f) => { errs[f] = REQUIRED_MESSAGES[f] })
      setFieldErrors(errs)
      return
    }

    setBusy(true)
    try {
      const payload = isEdit
        ? {
            title: trimmedTitle,
            description: trimmedDescription,
            priority: form.priority,
            category: form.category,
            assignedToId: form.assignedToId || null,
            ...(form.status !== ticket.status ? { status: form.status } : {}),
          }
        : {
            assetId: form.assetId,
            title: trimmedTitle,
            description: trimmedDescription,
            priority: form.priority,
            category: form.category,
          }
      await onSubmit(payload)
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

  const busyLabel = isEdit ? 'กำลังบันทึก...' : 'กำลังแจ้งปัญหา...'
  const noAssetsAvailable = !isEdit && assetOptions?.length === 0
  const statusChoices = isEdit
    ? [ticket.status, ...(EDITABLE_STATUS_TRANSITIONS[ticket.status] || [])]
    : []

  return (
    <div className="overlay" onClick={busy ? undefined : onCancel}>
      <div className="card modal" role="dialog" aria-modal="true" aria-label={isEdit ? `แก้ไขใบแจ้งซ่อม ${ticket.ticketNumber}` : 'แจ้งปัญหาใหม่'} onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? `แก้ไขใบแจ้งซ่อม ${ticket.ticketNumber}` : 'แจ้งปัญหาใหม่'}</h2>
        <form onSubmit={submit} noValidate>
          {isEdit ? (
            <>
              <label htmlFor="ticket-asset">ครุภัณฑ์</label>
              <p className="muted" id="ticket-asset">{ticket.asset?.assetTag} — {ticket.asset?.name}</p>
              <label htmlFor="ticket-reporter">ผู้แจ้ง</label>
              <p className="muted" id="ticket-reporter">{ticket.reportedBy?.name || ticket.reportedBy?.email}</p>
            </>
          ) : (
            <>
              <label htmlFor="ticket-asset-select">ครุภัณฑ์ *</label>
              {!assetOptions ? (
                <p className="muted">กำลังโหลดตัวเลือก...</p>
              ) : assetOptions.length === 0 ? (
                <p className="muted">ไม่มีครุภัณฑ์ให้เลือกแจ้งปัญหา</p>
              ) : (
                <select
                  id="ticket-asset-select"
                  ref={firstInputRef}
                  value={form.assetId}
                  onChange={(e) => update('assetId', e.target.value)}
                  className={fieldErrors.assetId ? 'invalid' : ''}
                >
                  <option value="">-- เลือกครุภัณฑ์ --</option>
                  {assetOptions.map((a) => (
                    <option key={a.id} value={a.id}>{a.assetTag} — {a.name}</option>
                  ))}
                </select>
              )}
              {fieldErrors.assetId && <p className="field-error">{fieldErrors.assetId}</p>}
            </>
          )}

          {optionsError && <p className="error">{optionsError}</p>}

          <label htmlFor="ticket-title">หัวข้อปัญหา *</label>
          <input
            id="ticket-title"
            ref={isEdit ? firstInputRef : undefined}
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            className={fieldErrors.title ? 'invalid' : ''}
          />
          {fieldErrors.title && <p className="field-error">{fieldErrors.title}</p>}

          <label htmlFor="ticket-description">รายละเอียดปัญหา *</label>
          <textarea
            id="ticket-description"
            rows={3}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            className={fieldErrors.description ? 'invalid' : ''}
          />
          {fieldErrors.description && <p className="field-error">{fieldErrors.description}</p>}

          <div className="row">
            <div className="grow">
              <label htmlFor="ticket-priority">ระดับความสำคัญ</label>
              <select id="ticket-priority" value={form.priority} onChange={(e) => update('priority', e.target.value)}>
                {TICKET_PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="grow">
              <label htmlFor="ticket-category">หมวดหมู่ *</label>
              <select
                id="ticket-category"
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                className={fieldErrors.category ? 'invalid' : ''}
              >
                <option value="">-- เลือกหมวดหมู่ --</option>
                {TICKET_CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {fieldErrors.category && <p className="field-error">{fieldErrors.category}</p>}
            </div>
          </div>

          {isEdit && (
            <div className="row">
              <div className="grow">
                <label htmlFor="ticket-assignee">ผู้ดูแล</label>
                {!staffOptions ? (
                  <p className="muted">กำลังโหลดตัวเลือก...</p>
                ) : (
                  <select
                    id="ticket-assignee"
                    value={form.assignedToId}
                    onChange={(e) => update('assignedToId', e.target.value)}
                    className={fieldErrors.assignedToId ? 'invalid' : ''}
                  >
                    <option value="">-- ยังไม่มอบหมาย --</option>
                    {staffOptions.map((u) => (
                      <option key={u.id} value={u.id}>{u.name || u.email}</option>
                    ))}
                  </select>
                )}
                {fieldErrors.assignedToId && <p className="field-error">{fieldErrors.assignedToId}</p>}
              </div>
              <div className="grow">
                <label htmlFor="ticket-status">สถานะ</label>
                <select id="ticket-status" value={form.status} onChange={(e) => update('status', e.target.value)}>
                  {statusChoices.map((s) => (
                    <option key={s} value={s}>{TICKET_STATUS_OPTIONS.find((o) => o.value === s)?.label || s}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {error && <p className="error">{error}</p>}

          <div className="row mt end">
            <button type="button" className="secondary" onClick={onCancel} disabled={busy}>ยกเลิก</button>
            <button type="submit" disabled={busy || noAssetsAvailable}>
              {busy ? busyLabel : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

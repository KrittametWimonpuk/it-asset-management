// ---------------------------------------------------------------------------
// AssignmentForm — ฟอร์มเดียวใช้ได้ทั้ง "มอบหมายครุภัณฑ์ใหม่" และ "แก้ไขรายละเอียด" (Milestone 5)
//
// ถ้ามี prop `assignment` = โหมดแก้ไข — แก้ได้แค่วันที่คาดว่าจะคืน/สภาพก่อนมอบหมาย/หมายเหตุ
// (ครุภัณฑ์กับพนักงานเปลี่ยนไม่ได้ เพราะเป็นข้อมูลหลักของประวัติที่ห้ามเขียนทับ)
// ถ้าไม่มี = โหมดมอบหมายใหม่ — เลือกได้เฉพาะครุภัณฑ์ที่ยังไม่มีผู้ถือครอง (?unassigned=true)
// ---------------------------------------------------------------------------
import { useState, useRef, useEffect } from 'react'
import { api } from '../api.js'
import { CONDITION_OPTIONS } from './AssetForm.jsx'
import { useDialogDismiss } from '../hooks/useDialogDismiss.js'

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function toDateInputValue(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

const emptyForm = {
  assetId: '',
  userId: '',
  assignedAt: '',
  expectedReturnDate: '',
  conditionBefore: '',
  remark: '',
}

const REQUIRED_MESSAGES = {
  assetId: 'กรุณาเลือกครุภัณฑ์',
  userId: 'กรุณาเลือกพนักงาน',
  assignedAt: 'กรุณาระบุวันที่มอบหมาย',
}

export default function AssignmentForm({ assignment, onSubmit, onCancel }) {
  const isEdit = Boolean(assignment)
  const [form, setForm] = useState(() => {
    if (!assignment) return { ...emptyForm, assignedAt: todayInputValue() }
    return {
      ...emptyForm,
      assetId: assignment.assetId,
      userId: assignment.userId,
      assignedAt: toDateInputValue(assignment.assignedAt),
      expectedReturnDate: toDateInputValue(assignment.expectedReturnDate),
      conditionBefore: assignment.conditionBefore || '',
      remark: assignment.remark || '',
    }
  })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const firstInputRef = useRef(null)
  useDialogDismiss(onCancel, busy)

  // ตัวเลือกครุภัณฑ์ที่ยังไม่มีผู้ถือครอง + รายชื่อพนักงาน — โหลดเฉพาะตอนมอบหมายใหม่ (แก้ไขเปลี่ยนไม่ได้)
  const [assetOptions, setAssetOptions] = useState(null)
  const [userOptions, setUserOptions] = useState(null)
  const [optionsError, setOptionsError] = useState('')

  useEffect(() => {
    if (isEdit) return
    let cancelled = false
    Promise.all([
      api.listAssets({ unassigned: true, pageSize: 100, sortBy: 'assetTag', sortOrder: 'asc' }),
      api.users.list({ pageSize: 100, sortBy: 'name', sortOrder: 'asc' }),
    ])
      .then(([assetsRes, usersRes]) => {
        if (cancelled) return
        setAssetOptions(assetsRes.items)
        setUserOptions(usersRes.items)
      })
      .catch((err) => { if (!cancelled) setOptionsError(err.message) })
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

    if (!isEdit) {
      const missing = ['assetId', 'userId', 'assignedAt'].filter((f) => !form[f])
      if (missing.length > 0) {
        const errs = {}
        missing.forEach((f) => { errs[f] = REQUIRED_MESSAGES[f] })
        setFieldErrors(errs)
        return
      }
    }

    setBusy(true)
    try {
      const payload = isEdit
        ? {
            expectedReturnDate: form.expectedReturnDate,
            conditionBefore: form.conditionBefore,
            remark: (form.remark || '').trim(),
          }
        : {
            assetId: form.assetId,
            userId: form.userId,
            assignedAt: form.assignedAt,
            expectedReturnDate: form.expectedReturnDate,
            conditionBefore: form.conditionBefore,
            remark: (form.remark || '').trim(),
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

  const busyLabel = isEdit ? 'กำลังบันทึก...' : 'กำลังมอบหมาย...'
  const noAssetsAvailable = !isEdit && assetOptions?.length === 0

  return (
    <div className="overlay" onClick={busy ? undefined : onCancel}>
      <div className="card modal" role="dialog" aria-modal="true" aria-label={isEdit ? 'แก้ไขรายการมอบหมาย' : 'มอบหมายครุภัณฑ์ใหม่'} onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'แก้ไขรายการมอบหมาย' : 'มอบหมายครุภัณฑ์ใหม่'}</h2>
        <form onSubmit={submit} noValidate>
          {isEdit ? (
            <>
              <label htmlFor="assignment-asset">ครุภัณฑ์</label>
              <p className="muted" id="assignment-asset">{assignment.asset?.assetTag} — {assignment.asset?.name}</p>
              <label htmlFor="assignment-employee">พนักงาน</label>
              <p className="muted" id="assignment-employee">{assignment.user?.name || assignment.user?.email}</p>
            </>
          ) : (
            <>
              <label htmlFor="assignment-asset-select">ครุภัณฑ์ *</label>
              {!assetOptions ? (
                <p className="muted" id="assignment-asset-select">กำลังโหลดตัวเลือก...</p>
              ) : assetOptions.length === 0 ? (
                <p className="muted" id="assignment-asset-select">ไม่มีครุภัณฑ์ที่ว่างให้มอบหมาย (ทุกชิ้นมีผู้ถือครองอยู่แล้ว)</p>
              ) : (
                <select
                  id="assignment-asset-select"
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

              <label htmlFor="assignment-user-select">พนักงาน *</label>
              {!userOptions ? (
                <p className="muted" id="assignment-user-select">กำลังโหลดตัวเลือก...</p>
              ) : (
                <select
                  id="assignment-user-select"
                  value={form.userId}
                  onChange={(e) => update('userId', e.target.value)}
                  className={fieldErrors.userId ? 'invalid' : ''}
                >
                  <option value="">-- เลือกพนักงาน --</option>
                  {userOptions.map((u) => (
                    <option key={u.id} value={u.id}>{u.name || u.email}</option>
                  ))}
                </select>
              )}
              {fieldErrors.userId && <p className="field-error">{fieldErrors.userId}</p>}
            </>
          )}

          {optionsError && <p className="error">{optionsError}</p>}

          <div className="row">
            <div className="grow">
              <label htmlFor="assignment-assignedAt">วันที่มอบหมาย{!isEdit && ' *'}</label>
              <input
                id="assignment-assignedAt"
                ref={isEdit ? firstInputRef : undefined}
                type="date"
                value={form.assignedAt}
                onChange={(e) => update('assignedAt', e.target.value)}
                disabled={isEdit}
                className={fieldErrors.assignedAt ? 'invalid' : ''}
              />
              {fieldErrors.assignedAt && <p className="field-error">{fieldErrors.assignedAt}</p>}
            </div>
            <div className="grow">
              <label htmlFor="assignment-expectedReturnDate">วันที่คาดว่าจะคืน</label>
              <input
                id="assignment-expectedReturnDate"
                type="date"
                value={form.expectedReturnDate}
                onChange={(e) => update('expectedReturnDate', e.target.value)}
                className={fieldErrors.expectedReturnDate ? 'invalid' : ''}
              />
              {fieldErrors.expectedReturnDate && <p className="field-error">{fieldErrors.expectedReturnDate}</p>}
            </div>
          </div>

          <label htmlFor="assignment-conditionBefore">สภาพก่อนมอบหมาย</label>
          <select id="assignment-conditionBefore" value={form.conditionBefore} onChange={(e) => update('conditionBefore', e.target.value)}>
            <option value="">ไม่ระบุ</option>
            {CONDITION_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <label htmlFor="assignment-remark">หมายเหตุ</label>
          <textarea
            id="assignment-remark"
            rows={2}
            value={form.remark}
            onChange={(e) => update('remark', e.target.value)}
          />

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

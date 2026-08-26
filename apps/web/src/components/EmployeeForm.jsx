import { useEffect, useRef, useState } from 'react'
import { UserRound, X } from 'lucide-react'
import DateInput from './DateInput.jsx'
import { useDialogDismiss } from '../hooks/useDialogDismiss.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function initialForm(item) {
  return {
    employeeCode: item?.employeeCode || '',
    firstName: item?.firstName || '',
    lastName: item?.lastName || '',
    email: item?.email || '',
    phone: item?.phone || '',
    departmentId: item?.departmentId || '',
    position: item?.position || '',
    status: item?.status || 'ACTIVE',
    hireDate: item?.hireDate ? item.hireDate.slice(0, 10) : '',
    remark: item?.remark || '',
    isActive: item?.isActive ?? true,
  }
}

export default function EmployeeForm({ employee, departments, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => initialForm(employee))
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef(null)
  const firstInputRef = useRef(null)
  const titleId = 'employee-form-title'
  const isEdit = Boolean(employee)

  useDialogDismiss(onCancel, busy, dialogRef)

  useEffect(() => { firstInputRef.current?.focus() }, [])

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
    if (fieldErrors[name]) {
      setFieldErrors((current) => { const next = { ...current }; delete next[name]; return next })
    }
  }

  function describedBy(name) {
    return fieldErrors[name] ? `employee-${name}-error` : undefined
  }

  async function submit(event) {
    event.preventDefault()
    setError('')

    const trimmed = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]))
    const errors = {}
    if (!trimmed.employeeCode) errors.employeeCode = 'กรุณาใส่รหัสพนักงาน'
    if (!trimmed.firstName) errors.firstName = 'กรุณาใส่ชื่อ'
    if (!trimmed.lastName) errors.lastName = 'กรุณาใส่นามสกุล'
    if (trimmed.email && !EMAIL_PATTERN.test(trimmed.email)) errors.email = 'อีเมลไม่ถูกต้อง'
    if (Object.keys(errors).length) { setFieldErrors(errors); return }

    const payload = { ...trimmed, employeeCode: trimmed.employeeCode.toUpperCase() }
    for (const name of ['email', 'phone', 'departmentId', 'position', 'hireDate', 'remark']) {
      if (!payload[name]) payload[name] = null
    }

    setBusy(true)
    try {
      await onSubmit(payload)
    } catch (err) {
      setError(err.message)
      const next = {}
      err.errors?.forEach(({ field, message }) => { next[field] = message })
      setFieldErrors(next)
      setBusy(false)
    }
  }

  function field(name, label, { type = 'text', required = false, placeholder = '' } = {}) {
    const id = `employee-${name}`
    return <div className="employee-field">
      <label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>
      <input
        id={id}
        ref={name === 'employeeCode' ? firstInputRef : undefined}
        type={type}
        value={form[name]}
        placeholder={placeholder}
        required={required}
        aria-invalid={Boolean(fieldErrors[name])}
        aria-describedby={describedBy(name)}
        onChange={(event) => update(name, event.target.value)}
      />
      {fieldErrors[name] && <p id={`${id}-error`} className="field-error">{fieldErrors[name]}</p>}
    </div>
  }

  return <div className="overlay" onClick={busy ? undefined : onCancel}>
    <div ref={dialogRef} className="card modal employee-form-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
      <header className="employee-form-header">
        <div><span><UserRound size={18} /></span><div><h2 id={titleId}>{isEdit ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงาน'}</h2><p>ข้อมูลบุคลากรสำหรับการดำเนินงานภายในองค์กร</p></div></div>
        <button type="button" onClick={onCancel} disabled={busy} aria-label="ปิดฟอร์ม"><X size={19} /></button>
      </header>
      <form onSubmit={submit} noValidate>
        <div className="employee-form-grid">
          {field('employeeCode', 'รหัสพนักงาน', { required: true, placeholder: 'เช่น EMP-0001' })}
          {field('position', 'ตำแหน่ง', { placeholder: 'เช่น IT Support' })}
          {field('firstName', 'ชื่อ', { required: true })}
          {field('lastName', 'นามสกุล', { required: true })}
          {field('email', 'อีเมล', { type: 'email', placeholder: 'name@company.com' })}
          {field('phone', 'เบอร์โทรศัพท์', { type: 'tel', placeholder: '0812345678' })}

          <div className="employee-field">
            <label htmlFor="employee-departmentId">แผนก</label>
            <select id="employee-departmentId" value={form.departmentId} onChange={(event) => update('departmentId', event.target.value)} aria-invalid={Boolean(fieldErrors.departmentId)} aria-describedby={describedBy('departmentId')}>
              <option value="">ไม่ระบุแผนก</option>
              {departments.map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}
            </select>
            {fieldErrors.departmentId && <p id="employee-departmentId-error" className="field-error">{fieldErrors.departmentId}</p>}
          </div>

          <div className="employee-field">
            <label htmlFor="employee-status">สถานะพนักงาน</label>
            <select id="employee-status" value={form.status} onChange={(event) => update('status', event.target.value)}>
              <option value="ACTIVE">ปฏิบัติงาน</option>
              <option value="INACTIVE">ไม่ใช้งาน</option>
              <option value="ON_LEAVE">ลางาน</option>
              <option value="RESIGNED">ลาออก</option>
            </select>
          </div>

          <div className="employee-field">
            <label htmlFor="employee-hireDate">วันที่เริ่มงาน</label>
            <DateInput id="employee-hireDate" value={form.hireDate} onChange={(value) => update('hireDate', value)} ariaDescribedBy={describedBy('hireDate')} ariaInvalid={Boolean(fieldErrors.hireDate)} />
            {fieldErrors.hireDate && <p id="employee-hireDate-error" className="field-error">{fieldErrors.hireDate}</p>}
          </div>

          <label className="employee-active-field">
            <input type="checkbox" checked={form.isActive} onChange={(event) => update('isActive', event.target.checked)} />
            <span><strong>เปิดใช้งาน</strong><small>อนุญาตให้เลือกพนักงานรายนี้ใน workflow ในอนาคต</small></span>
          </label>

          <div className="employee-field employee-field-wide">
            <label htmlFor="employee-remark">หมายเหตุ</label>
            <textarea id="employee-remark" rows="3" value={form.remark} onChange={(event) => update('remark', event.target.value)} />
          </div>
        </div>

        {error && <p className="employee-form-error" role="alert">{error}</p>}
        <footer className="employee-form-actions">
          <button type="button" className="secondary" onClick={onCancel} disabled={busy}>ยกเลิก</button>
          <button type="submit" disabled={busy}>{busy ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มพนักงาน'}</button>
        </footer>
      </form>
    </div>
  </div>
}

// ---------------------------------------------------------------------------
// AssetForm — ฟอร์มเดียวใช้ได้ทั้ง "เพิ่มครุภัณฑ์ใหม่" และ "แก้ไขครุภัณฑ์"
// ถ้ามี prop `asset` = โหมดแก้ไข, ถ้าไม่มี = โหมดเพิ่มใหม่
//
// ตั้งแต่ Milestone 2: หมวดหมู่/สถานที่/แผนก/ผู้ขาย เป็น dropdown ที่โหลดจาก master data API
// (หมวดหมู่บังคับเลือก ที่เหลือเลือกหรือไม่ก็ได้)
// ---------------------------------------------------------------------------
import { useState, useRef, useEffect } from 'react'
import { Boxes, X } from 'lucide-react'

export const STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'พร้อมใช้งาน' },
  { value: 'IN_USE', label: 'กำลังใช้งาน' },
  { value: 'REPAIR', label: 'ซ่อมบำรุง' },
  { value: 'DISPOSED', label: 'เลิกใช้งาน' },
]

// สภาพครุภัณฑ์ — ต้องตรงกับ enum AssetCondition ใน schema.prisma (Milestone 3)
export const CONDITION_OPTIONS = [
  { value: 'NEW', label: 'ใหม่' },
  { value: 'GOOD', label: 'สภาพดี' },
  { value: 'FAIR', label: 'สภาพปานกลาง' },
  { value: 'POOR', label: 'สภาพไม่ดี' },
  { value: 'DAMAGED', label: 'ชำรุด' },
]

// dropdown master data ทั้ง 4 ตัว — key ต้องตรงกับ field ใน Asset (categoryId, locationId, ...)
// (ตัวเลือกจริงโหลดผ่าน useMasterDataOptions hook — ที่นี่เก็บแค่ metadata สำหรับ render)
// navTarget = ชื่อแท็บใน App.jsx ที่จะพาไปสร้างข้อมูลใหม่ ถ้ายังไม่มีตัวเลือกเลย
const MASTER_DATA_FIELDS = [
  { key: 'categoryId', label: 'หมวดหมู่', required: true, navTarget: 'categories' },
  { key: 'locationId', label: 'สถานที่ตั้ง', required: false, navTarget: 'locations' },
  { key: 'departmentId', label: 'แผนก', required: false, navTarget: 'departments' },
  { key: 'vendorId', label: 'ผู้ขาย/ผู้ผลิต', required: false, navTarget: 'vendors' },
]

// ฟิลด์ text ธรรมดาของฟอร์ม (ใช้ตอน trim ก่อนส่ง) — ไม่รวม dropdown/select/วันที่/ตัวเลข
// ตั้งแต่ Milestone 3: เพิ่มฟิลด์รายละเอียดครุภัณฑ์ (purchase/hardware/network/notes)
const TEXT_FIELDS = [
  'assetTag', 'name', 'brand', 'model', 'serialNumber',
  'currency', 'supplierReference', 'invoiceNumber', 'remark',
  'hostname', 'ipAddress', 'macAddress', 'operatingSystem', 'osVersion',
  'cpu', 'ram', 'storage', 'graphics', 'monitorSize', 'domainName', 'description',
]

// ฟิลด์วันที่ของฟอร์ม (ใช้ <input type="date">) — แปลงจาก ISO string ที่ backend ส่งมาตอนแก้ไข
const DATE_FIELDS = ['purchaseDate', 'warrantyExpiry', 'lastSeenAt']

const REQUIRED_MESSAGES = {
  assetTag: 'กรุณาใส่เลขทะเบียนครุภัณฑ์',
  name: 'กรุณาใส่ชื่ออุปกรณ์',
  brand: 'กรุณาใส่ยี่ห้อ',
  model: 'กรุณาใส่รุ่น',
  categoryId: 'กรุณาเลือกหมวดหมู่',
}

const emptyForm = {
  assetTag: '',
  name: '',
  brand: '',
  model: '',
  serialNumber: '',
  status: 'AVAILABLE',
  categoryId: '',
  locationId: '',
  departmentId: '',
  vendorId: '',
  // Milestone 3: การจัดซื้อ
  purchaseDate: '',
  purchasePrice: '',
  currency: '',
  supplierReference: '',
  invoiceNumber: '',
  warrantyExpiry: '',
  // Milestone 3: ฮาร์ดแวร์
  cpu: '',
  ram: '',
  storage: '',
  graphics: '',
  monitorSize: '',
  assetCondition: '',
  // Milestone 3: เครือข่าย
  hostname: '',
  ipAddress: '',
  macAddress: '',
  operatingSystem: '',
  osVersion: '',
  domainName: '',
  lastSeenAt: '',
  // Milestone 3: หมายเหตุ
  description: '',
  remark: '',
}

// ตัด ISO datetime ที่ backend ส่งมาให้เหลือแค่ yyyy-mm-dd เพื่อใส่ใน <input type="date">
function toDateInputValue(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

// options/optionsError — ตัวเลือก dropdown master data มาจาก Assets.jsx (useMasterDataOptions โหลดครั้งเดียวที่นั่น
// แล้วส่งต่อลงมา) กันไม่ให้เปิดฟอร์มแล้วยิง request master data ซ้ำ 4 ตัวทั้งที่หน้ารายการมีข้อมูลอยู่แล้ว
export default function AssetForm({ asset, onSubmit, onCancel, onNavigateToMaster, options, optionsError }) {
  const isEdit = Boolean(asset)
  const [form, setForm] = useState(() => {
    if (!asset) return emptyForm
    const next = { ...emptyForm, ...asset }
    DATE_FIELDS.forEach((f) => { next[f] = toDateInputValue(asset[f]) })
    next.purchasePrice = (asset.purchasePrice === null || asset.purchasePrice === undefined) ? '' : String(asset.purchasePrice)
    next.assetCondition = asset.assetCondition || ''
    return next
  })
  const [error, setError] = useState('')             // ข้อความ error ทั่วไป
  const [fieldErrors, setFieldErrors] = useState({})  // error รายฟิลด์ เช่น { assetTag: '...' }
  const [busy, setBusy] = useState(false)
  const firstInputRef = useRef(null)

  // auto-focus ช่องแรกทันทีที่เปิดฟอร์ม ให้พิมพ์ต่อได้เลยโดยไม่ต้องคลิก
  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [busy, onCancel])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    // พิมพ์แก้ไขแล้ว ให้ error เดิมของฟิลด์นั้นหายไป จะได้ไม่ค้างข้อความผิด ๆ
    if (fieldErrors[field]) {
      setFieldErrors((fe) => { const next = { ...fe }; delete next[field]; return next })
    }
  }

  function goCreateMaster(navTarget) {
    onCancel()
    onNavigateToMaster?.(navTarget)
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    // ตัดช่องว่างหัว-ท้ายทุกฟิลด์ก่อนตรวจ/ส่ง กันไม่ให้ผ่านด้วยค่าที่เป็นช่องว่างล้วน
    const trimmed = { ...form }
    for (const field of TEXT_FIELDS) {
      trimmed[field] = (trimmed[field] || '').trim()
    }

    // เช็กฝั่งหน้าเว็บก่อนยิง request — ฟิลด์บังคับห้ามว่าง
    const requiredFields = ['assetTag', 'name', 'brand', 'model', 'categoryId']
    const missing = requiredFields.filter((f) => !trimmed[f])
    if (missing.length > 0) {
      const errs = {}
      missing.forEach((f) => { errs[f] = REQUIRED_MESSAGES[f] })
      setFieldErrors(errs)
      return
    }

    setBusy(true)
    try {
      const payload = {
        ...trimmed,
        serialNumber: trimmed.serialNumber || null,
        locationId: trimmed.locationId || null,
        departmentId: trimmed.departmentId || null,
        vendorId: trimmed.vendorId || null,
      }
      await onSubmit(payload)
      // สำเร็จ: ไม่ต้อง setBusy(false) เพราะ component นี้จะถูกปิด/unmount โดย parent
    } catch (err) {
      // เก็บค่าที่กรอกไว้เหมือนเดิม (ไม่เคลียร์ form) ให้แก้ไขแล้วลองใหม่ได้ทันที
      setForm(trimmed)
      setError(err.message)
      if (err.errors) {
        const errs = {}
        err.errors.forEach(({ field, message }) => { errs[field] = message })
        setFieldErrors(errs)
      }
      setBusy(false)
    }
  }

  const busyLabel = isEdit ? 'กำลังอัปเดต...' : 'กำลังสร้าง...'

  // ---- dropdown master data ตัวหนึ่ง: ปกติ (มีตัวเลือก) / ว่างเปล่า (ให้ลิงก์ไปสร้างก่อน) / กำลังโหลด ----
  function renderMasterDataField(f) {
    const fieldId = `asset-${f.key}`
    const list = options?.[f.key]
    if (!options) {
      return (
        <div key={f.key} className="grow">
          <label htmlFor={fieldId}>{f.label}{f.required && ' *'}</label>
          <p className="muted" id={fieldId}>กำลังโหลดตัวเลือก...</p>
        </div>
      )
    }
    if (list.length === 0) {
      return (
        <div key={f.key} className="grow">
          <label htmlFor={fieldId}>{f.label}{f.required && ' *'}</label>
          <div className="empty-dropdown" id={fieldId}>
            <p className="muted">ยังไม่มี{f.label}ในระบบ</p>
            {onNavigateToMaster && (
              <button type="button" className="link" onClick={() => goCreateMaster(f.navTarget)}>
                + ไปสร้าง{f.label}
              </button>
            )}
          </div>
        </div>
      )
    }
    return (
      <div key={f.key} className="grow">
        <label htmlFor={fieldId}>{f.label}{f.required && ' *'}</label>
        <select
          id={fieldId}
          value={form[f.key] || ''}
          onChange={(e) => update(f.key, e.target.value)}
          className={fieldErrors[f.key] ? 'invalid' : ''}
        >
          <option value="">{f.required ? '-- เลือก' + f.label + ' --' : 'ไม่ระบุ'}</option>
          {list.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        {fieldErrors[f.key] && <p className="field-error">{fieldErrors[f.key]}</p>}
      </div>
    )
  }

  // ---- ช่อง input ธรรมดา (text/number/date) ตัวหนึ่ง — ใช้ซ้ำกับฟิลด์รายละเอียดของ Milestone 3 ----
  function renderInput(key, label, { type = 'text', placeholder, step, min } = {}) {
    const fieldId = `asset-${key}`
    return (
      <div className="grow">
        <label htmlFor={fieldId}>{label}</label>
        <input
          id={fieldId}
          type={type}
          value={form[key] || ''}
          placeholder={placeholder}
          step={step}
          min={min}
          onChange={(e) => update(key, e.target.value)}
          className={fieldErrors[key] ? 'invalid' : ''}
        />
        {fieldErrors[key] && <p className="field-error">{fieldErrors[key]}</p>}
      </div>
    )
  }

  // ---- ช่อง textarea เต็มความกว้าง — ใช้กับ description/remark ----
  function renderTextarea(key, label) {
    const fieldId = `asset-${key}`
    return (
      <>
        <label htmlFor={fieldId}>{label}</label>
        <textarea
          id={fieldId}
          rows={2}
          value={form[key] || ''}
          onChange={(e) => update(key, e.target.value)}
          className={fieldErrors[key] ? 'invalid' : ''}
        />
        {fieldErrors[key] && <p className="field-error">{fieldErrors[key]}</p>}
      </>
    )
  }

  return (
    <div className="overlay" onClick={busy ? undefined : onCancel}>
      <div className="card modal asset-form-modal" role="dialog" aria-modal="true" aria-labelledby="asset-form-title" onClick={(e) => e.stopPropagation()}>
        <header className="assets-modal-header">
          <div className="assets-modal-title">
            <span><Boxes size={20} /></span>
            <div>
              <h2 id="asset-form-title">{isEdit ? 'แก้ไขครุภัณฑ์' : 'เพิ่มครุภัณฑ์ใหม่'}</h2>
              <p>{isEdit ? `อัปเดตข้อมูล ${asset.assetTag}` : 'บันทึกข้อมูลและรายละเอียดครุภัณฑ์เข้าสู่ระบบ'}</p>
            </div>
          </div>
          <button type="button" className="assets-modal-close" onClick={onCancel} disabled={busy} aria-label="ปิดหน้าต่าง">
            <X size={18} />
          </button>
        </header>
        <form onSubmit={submit} noValidate>
          <h3 className="form-section-title">ข้อมูลทั่วไป</h3>
          <label htmlFor="asset-assetTag">เลขทะเบียนครุภัณฑ์ (Asset Tag)</label>
          <input
            id="asset-assetTag"
            ref={firstInputRef}
            type="text"
            value={form.assetTag}
            onChange={(e) => update('assetTag', e.target.value)}
            className={fieldErrors.assetTag ? 'invalid' : ''}
          />
          {fieldErrors.assetTag && <p className="field-error">{fieldErrors.assetTag}</p>}

          <label htmlFor="asset-name">ชื่ออุปกรณ์</label>
          <input
            id="asset-name"
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            className={fieldErrors.name ? 'invalid' : ''}
          />
          {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}

          <div className="row">
            <div className="grow">
              <label htmlFor="asset-brand">ยี่ห้อ</label>
              <input
                id="asset-brand"
                type="text"
                value={form.brand}
                onChange={(e) => update('brand', e.target.value)}
                className={fieldErrors.brand ? 'invalid' : ''}
              />
              {fieldErrors.brand && <p className="field-error">{fieldErrors.brand}</p>}
            </div>
            <div className="grow">
              <label htmlFor="asset-model">รุ่น</label>
              <input
                id="asset-model"
                type="text"
                value={form.model}
                onChange={(e) => update('model', e.target.value)}
                className={fieldErrors.model ? 'invalid' : ''}
              />
              {fieldErrors.model && <p className="field-error">{fieldErrors.model}</p>}
            </div>
          </div>

          <label htmlFor="asset-serialNumber">Serial Number (ถ้ามี)</label>
          <input
            id="asset-serialNumber"
            type="text"
            value={form.serialNumber || ''}
            onChange={(e) => update('serialNumber', e.target.value)}
            className={fieldErrors.serialNumber ? 'invalid' : ''}
          />
          {fieldErrors.serialNumber && <p className="field-error">{fieldErrors.serialNumber}</p>}

          <label htmlFor="asset-status">สถานะ</label>
          <select id="asset-status" value={form.status} onChange={(e) => update('status', e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {optionsError && <p className="error">{optionsError}</p>}

          <div className="row">
            {renderMasterDataField(MASTER_DATA_FIELDS[0])}
            {renderMasterDataField(MASTER_DATA_FIELDS[1])}
          </div>
          <div className="row">
            {renderMasterDataField(MASTER_DATA_FIELDS[2])}
            {renderMasterDataField(MASTER_DATA_FIELDS[3])}
          </div>

          <h3 className="form-section-title">การจัดซื้อ</h3>
          <div className="row">
            {renderInput('purchaseDate', 'วันที่ซื้อ', { type: 'date' })}
            {renderInput('purchasePrice', 'ราคาซื้อ', { type: 'number', step: '0.01', min: '0' })}
          </div>
          <div className="row">
            {renderInput('currency', 'สกุลเงิน', { placeholder: 'เช่น THB, USD' })}
            {renderInput('warrantyExpiry', 'วันหมดประกัน', { type: 'date' })}
          </div>
          <div className="row">
            {renderInput('invoiceNumber', 'เลขที่ใบแจ้งหนี้')}
            {renderInput('supplierReference', 'เลขอ้างอิงผู้ขาย')}
          </div>

          <h3 className="form-section-title">ฮาร์ดแวร์</h3>
          <div className="row">
            {renderInput('cpu', 'CPU')}
            {renderInput('ram', 'RAM')}
          </div>
          <div className="row">
            {renderInput('storage', 'พื้นที่จัดเก็บ')}
            {renderInput('graphics', 'การ์ดจอ')}
          </div>
          <div className="row">
            {renderInput('monitorSize', 'ขนาดหน้าจอ')}
            <div className="grow">
              <label htmlFor="asset-assetCondition">สภาพครุภัณฑ์</label>
              <select id="asset-assetCondition" value={form.assetCondition || ''} onChange={(e) => update('assetCondition', e.target.value)}>
                <option value="">ไม่ระบุ</option>
                {CONDITION_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <h3 className="form-section-title">เครือข่าย</h3>
          <div className="row">
            {renderInput('hostname', 'Hostname')}
            {renderInput('ipAddress', 'IP Address', { placeholder: '192.168.1.10' })}
          </div>
          <div className="row">
            {renderInput('macAddress', 'MAC Address', { placeholder: '00:1A:2B:3C:4D:5E' })}
            {renderInput('operatingSystem', 'ระบบปฏิบัติการ')}
          </div>
          <div className="row">
            {renderInput('osVersion', 'เวอร์ชันระบบปฏิบัติการ')}
            {renderInput('domainName', 'โดเมน')}
          </div>
          {renderInput('lastSeenAt', 'พบเห็นล่าสุด', { type: 'date' })}

          <h3 className="form-section-title">หมายเหตุ</h3>
          {renderTextarea('description', 'รายละเอียด')}
          {renderTextarea('remark', 'หมายเหตุ')}

          {error && <p className="error">{error}</p>}

          <div className="row mt end assets-modal-actions">
            <button type="button" className="secondary" onClick={onCancel} disabled={busy}>ยกเลิก</button>
            <button type="submit" disabled={busy}>
              {busy ? busyLabel : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

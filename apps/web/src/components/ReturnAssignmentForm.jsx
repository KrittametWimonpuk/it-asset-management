import { useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock3, ShieldCheck, UserRound, XCircle } from 'lucide-react'
import { CONDITION_OPTIONS } from './AssetForm.jsx'
import { useDialogDismiss } from '../hooks/useDialogDismiss.js'
import DateInput from './DateInput.jsx'
import { assignmentHolderName } from '../utils/assignmentHolder.js'
import { formatDateTime } from '../utils/format.js'

export const ASSIGNMENT_STATUS_OPTIONS = [
  { value: 'ASSIGNED', label: 'กำลังถือครอง' },
  { value: 'RETURNED', label: 'คืนแล้ว' },
  { value: 'LOST', label: 'สูญหาย' },
  { value: 'DAMAGED', label: 'เสียหาย' },
]

const RETURN_WORKFLOW_META = {
  PENDING_INSPECTION: { label: 'รอตรวจรับ', tone: 'amber', icon: Clock3 },
  PASSED: { label: 'ผ่านการตรวจ', tone: 'green', icon: CheckCircle2 },
  FAILED: { label: 'ไม่ผ่านการตรวจ', tone: 'red', icon: XCircle },
  RETURNED: { label: 'คืนเสร็จสมบูรณ์', tone: 'green', icon: CheckCircle2 },
  DAMAGED: { label: 'รับคืนแบบชำรุด', tone: 'amber', icon: AlertTriangle },
  LOST: { label: 'สูญหาย', tone: 'red', icon: XCircle },
}

const RETURN_STATUS_OPTIONS = [
  { value: 'RETURNED', label: 'คืนปกติ — ผ่านการตรวจ' },
  { value: 'DAMAGED', label: 'ชำรุด — ไม่ผ่านการตรวจ' },
  { value: 'LOST', label: 'สูญหาย' },
]

function todayInputValue() { return new Date().toISOString().slice(0, 10) }

function WorkflowBadge({ status }) {
  const meta = RETURN_WORKFLOW_META[status]
  if (!meta) return null
  const Icon = meta.icon
  return <span className={`return-workflow-badge tone-${meta.tone}`}><Icon size={14} aria-hidden="true" />{meta.label}</span>
}

export default function ReturnAssignmentForm({ assignment, operator, onStart, onInspect, onCancel }) {
  const [current, setCurrent] = useState(assignment)
  const [status, setStatus] = useState('RETURNED')
  const [conditionAfter, setConditionAfter] = useState(assignment.asset?.assetCondition || '')
  const [inspectionNotes, setInspectionNotes] = useState('')
  const [inspectedAt, setInspectedAt] = useState(todayInputValue())
  const [returnedAt, setReturnedAt] = useState(todayInputValue())
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef(null)
  useDialogDismiss(onCancel, busy, dialogRef)

  const pending = current.returnStatus === 'PENDING_INSPECTION' && !current.returnedAt
  const completed = Boolean(current.returnedAt)
  const timeline = current.returnEvents || []
  const inspectorName = operator?.name || operator?.email || 'บัญชีที่เข้าสู่ระบบ'

  async function startInspection() {
    setBusy(true); setError('')
    try { setCurrent(await onStart({ notes: 'เริ่มตรวจรับคืนจากหน้า Assignment' })) }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  function changeStatus(nextStatus) {
    setStatus(nextStatus)
    if (nextStatus === 'DAMAGED') setConditionAfter('DAMAGED')
    if (nextStatus === 'LOST') setConditionAfter('')
  }

  async function submitInspection(event) {
    event.preventDefault(); setError(''); setFieldErrors({}); setBusy(true)
    try { setCurrent(await onInspect({ status, conditionAfter, inspectionNotes: inspectionNotes.trim(), inspectedAt, returnedAt })) }
    catch (err) {
      setError(err.message)
      if (err.errors) {
        const nextErrors = {}
        err.errors.forEach(({ field, message }) => { nextErrors[field] = message })
        setFieldErrors(nextErrors)
      }
    } finally { setBusy(false) }
  }

  return (
    <div className="overlay" onClick={busy ? undefined : onCancel}>
      <div ref={dialogRef} className="card modal return-inspection-modal" role="dialog" aria-modal="true" aria-labelledby="return-dialog-title" onClick={(event) => event.stopPropagation()}>
        <header className="return-dialog-header">
          <div><span><ClipboardCheck size={20} aria-hidden="true" /></span><div><h2 id="return-dialog-title">ตรวจรับคืนครุภัณฑ์</h2><p>ตรวจสภาพและบันทึกประวัติก่อนปิดการมอบหมาย</p></div></div>
          <WorkflowBadge status={current.returnStatus} />
        </header>

        <div className="return-assignment-summary"><strong>{current.asset?.assetTag} · {current.asset?.name}</strong><span>ผู้ส่งคืน: {assignmentHolderName(current)}</span></div>

        {!pending && !completed && <section className="return-start-panel" aria-labelledby="return-start-heading">
          <span><ShieldCheck size={25} aria-hidden="true" /></span><div><h3 id="return-start-heading">เริ่มกระบวนการตรวจรับ</h3><p>Assignment จะยังไม่ถูกปิดจนกว่าผู้ตรวจจะบันทึกผลและยืนยันการรับคืน</p></div>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="row mt end"><button type="button" className="secondary" onClick={onCancel} disabled={busy}>ยกเลิก</button><button type="button" autoFocus onClick={startInspection} disabled={busy}>{busy ? 'กำลังเริ่ม...' : 'เริ่มตรวจรับคืน'}</button></div>
        </section>}

        {pending && <form className="return-inspection-form" onSubmit={submitInspection} noValidate>
          <section className="return-inspection-section" aria-labelledby="inspection-heading">
            <div className="return-section-title"><ShieldCheck size={18} aria-hidden="true" /><div><h3 id="inspection-heading">ข้อมูลการตรวจรับ</h3><p>ข้อมูลผู้ตรวจจะบันทึกจากบัญชีที่เข้าสู่ระบบ</p></div></div>
            <div className="return-form-grid">
              <label htmlFor="return-inspector">ผู้ตรวจรับ<input id="return-inspector" value={inspectorName} readOnly aria-readonly="true" /></label>
              <label htmlFor="return-status">ผลลัพธ์<select id="return-status" value={status} onChange={(event) => changeStatus(event.target.value)}>{RETURN_STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <label htmlFor="return-inspectedAt">วันที่ตรวจรับ<DateInput id="return-inspectedAt" value={inspectedAt} onChange={setInspectedAt} className={fieldErrors.inspectedAt ? 'invalid' : ''} /></label>
              <label htmlFor="return-returnedAt">วันที่คืน<DateInput id="return-returnedAt" value={returnedAt} onChange={setReturnedAt} className={fieldErrors.returnedAt ? 'invalid' : ''} /></label>
              <label htmlFor="return-conditionAfter">สภาพหลังคืน<select id="return-conditionAfter" value={conditionAfter} disabled={status === 'LOST'} onChange={(event) => setConditionAfter(event.target.value)} className={fieldErrors.conditionAfter ? 'invalid' : ''}><option value="">{status === 'LOST' ? 'ไม่สามารถตรวจสภาพได้' : 'เลือกสภาพครุภัณฑ์'}</option>{CONDITION_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>{fieldErrors.conditionAfter && <small className="field-error">{fieldErrors.conditionAfter}</small>}</label>
              <label className="return-notes-field" htmlFor="return-inspectionNotes">บันทึกการตรวจรับ<textarea id="return-inspectionNotes" rows="3" maxLength="2000" value={inspectionNotes} onChange={(event) => setInspectionNotes(event.target.value)} className={fieldErrors.inspectionNotes ? 'invalid' : ''} aria-describedby={fieldErrors.inspectionNotes ? 'return-notes-error' : undefined} placeholder="ระบุผลการตรวจ อุปกรณ์ที่ได้รับคืน และข้อสังเกต" />{fieldErrors.inspectionNotes && <small id="return-notes-error" className="field-error">{fieldErrors.inspectionNotes}</small>}</label>
            </div>
          </section>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="row mt end"><button type="button" className="secondary" onClick={onCancel} disabled={busy}>ปิด</button><button type="submit" autoFocus disabled={busy}>{busy ? 'กำลังบันทึก...' : 'ยืนยันผลตรวจและปิดการคืน'}</button></div>
        </form>}

        {completed && <section className="return-complete-summary" aria-live="polite"><CheckCircle2 size={30} aria-hidden="true" /><div><h3>บันทึกการรับคืนเรียบร้อย</h3><p>{current.inspectedBy?.name || current.inspectedBy?.email || 'ไม่ทราบผู้ตรวจ'} · {formatDateTime(current.inspectedAt)}</p></div><button type="button" autoFocus onClick={onCancel}>ปิด</button></section>}

        <section className="return-timeline-section" aria-labelledby="return-timeline-heading">
          <div className="return-section-title"><Clock3 size={18} aria-hidden="true" /><div><h3 id="return-timeline-heading">Return Timeline</h3><p>ประวัติการรับคืนแบบไม่เขียนทับ</p></div></div>
          {timeline.length ? <ol className="return-event-list">{timeline.map((item) => { const meta = RETURN_WORKFLOW_META[item.status] || RETURN_WORKFLOW_META.PENDING_INSPECTION; const Icon = meta.icon; return <li key={item.id} className={`tone-${meta.tone}`}><span><Icon size={14} aria-hidden="true" /></span><div><strong>{meta.label}</strong><p>{item.notes || 'ไม่มีบันทึก'}{item.condition ? ` · ${CONDITION_OPTIONS.find((option) => option.value === item.condition)?.label || item.condition}` : ''}</p><small><UserRound size={12} aria-hidden="true" /> {item.actorUser?.name || item.actorUser?.email || 'ข้อมูลเดิม'} · {formatDateTime(item.createdAt)}</small></div></li> })}</ol> : <p className="return-timeline-empty">ยังไม่มีเหตุการณ์รับคืน</p>}
        </section>
      </div>
    </div>
  )
}

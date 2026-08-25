import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, Ban, CalendarClock, Check, CheckCircle2, ChevronLeft, ChevronRight,
  ClipboardList, Clock3, Eye, FileClock, MessageSquareText, PackageOpen, Plus,
  RefreshCw, Search, SearchX, UserCheck, X,
} from 'lucide-react'
import { api } from '../api.js'
import DateInput from '../components/DateInput.jsx'
import { useDialogDismiss } from '../hooks/useDialogDismiss.js'
import { formatDate, formatDateTime } from '../utils/format.js'
import './BorrowRequests.css'

const PAGE_SIZE = 20
const BORROW_REQUEST_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'รออนุมัติ', tone: 'warning' },
  { value: 'APPROVED', label: 'อนุมัติแล้ว', tone: 'info' },
  { value: 'REJECTED', label: 'ปฏิเสธ', tone: 'danger' },
  { value: 'CANCELLED', label: 'ยกเลิก', tone: 'neutral' },
  { value: 'COMPLETED', label: 'อนุมัติแล้ว', tone: 'success' },
]

function StatusBadge({ status }) {
  const option = BORROW_REQUEST_STATUS_OPTIONS.find((item) => item.value === status)
  return <span className={`borrow-status is-${option?.tone || 'neutral'}`}><i />{option?.label || status}</span>
}

function RequestForm({ assets, onSubmit, onClose }) {
  const [form, setForm] = useState({ assetId: '', expectedReturnDate: '', reason: '', remark: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const dialogRef = useRef(null)
  useDialogDismiss(onClose, saving, dialogRef)

  async function submit(event) {
    event.preventDefault()
    setSaving(true); setError('')
    try { await onSubmit(form) } catch (err) { setError(err.message); setSaving(false) }
  }

  return <div className="borrow-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section ref={dialogRef} className="borrow-modal" role="dialog" aria-modal="true" aria-labelledby="borrow-form-title">
      <header><div><span><PackageOpen size={18} /></span><div><h2 id="borrow-form-title">สร้างคำขอยืมครุภัณฑ์</h2><p>เลือกครุภัณฑ์ที่ยังไม่มีผู้ถือครอง</p></div></div><button type="button" onClick={onClose} disabled={saving} aria-label="ปิด"><X size={19} /></button></header>
      <form onSubmit={submit}>
        {error && <div className="borrow-form-error" role="alert"><AlertCircle size={17} />{error}</div>}
        <label htmlFor="borrow-asset">ครุภัณฑ์ <b>*</b><select id="borrow-asset" value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })} required autoFocus><option value="">เลือกครุภัณฑ์</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.assetTag} — {asset.name}</option>)}</select></label>
        <label htmlFor="borrow-return-date">วันที่คาดว่าจะคืน<DateInput id="borrow-return-date" value={form.expectedReturnDate} min={new Date().toISOString().slice(0, 10)} onChange={(value) => setForm({ ...form, expectedReturnDate: value })} /></label>
        <label htmlFor="borrow-reason">เหตุผลที่ขอ <b>*</b><textarea id="borrow-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows="4" minLength="3" maxLength="1000" required placeholder="ระบุวัตถุประสงค์ในการใช้งาน" /></label>
        <label htmlFor="borrow-remark">หมายเหตุ<textarea id="borrow-remark" value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} rows="2" placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" /></label>
        <footer><button className="btn-secondary" type="button" onClick={onClose} disabled={saving}>ยกเลิก</button><button className="btn-primary" type="submit" disabled={saving || assets.length === 0}>{saving ? <RefreshCw className="borrow-spin" size={17} /> : <Check size={17} />}ส่งคำขอ</button></footer>
      </form>
    </section>
  </div>
}

function RejectForm({ request, onSubmit, onClose }) {
  const [rejectedReason, setRejectedReason] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const dialogRef = useRef(null)
  useDialogDismiss(onClose, saving, dialogRef)

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('')
    try { await onSubmit({ rejectedReason, comment }) } catch (err) { setError(err.message); setSaving(false) }
  }

  return <div className="borrow-modal-backdrop" role="presentation">
    <section ref={dialogRef} className="borrow-modal borrow-reject-modal" role="dialog" aria-modal="true" aria-labelledby="reject-title">
      <header><div><span className="is-danger"><Ban size={18} /></span><div><h2 id="reject-title">ปฏิเสธ {request.requestNumber}</h2><p>{request.asset.assetTag} — {request.asset.name}</p></div></div><button type="button" onClick={onClose} disabled={saving} aria-label="ปิด"><X size={19} /></button></header>
      <form onSubmit={submit}>{error && <div className="borrow-form-error" role="alert"><AlertCircle size={17} />{error}</div>}<label htmlFor="reject-reason">เหตุผลที่ปฏิเสธ <b>*</b><textarea id="reject-reason" value={rejectedReason} onChange={(e) => setRejectedReason(e.target.value)} minLength="3" maxLength="1000" rows="4" required autoFocus /></label><label htmlFor="reject-comment">ความคิดเห็นของผู้พิจารณา<textarea id="reject-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength="1000" rows="3" placeholder="รายละเอียดภายในเพิ่มเติม (ไม่บังคับ)" /></label><footer><button className="btn-secondary" type="button" onClick={onClose} disabled={saving}>กลับ</button><button className="btn-danger" type="submit" disabled={saving}>{saving ? <RefreshCw className="borrow-spin" size={17} /> : <Ban size={17} />}ยืนยันปฏิเสธ</button></footer></form>
    </section>
  </div>
}

function ApproveForm({ request, onSubmit, onClose }) {
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const dialogRef = useRef(null)
  useDialogDismiss(onClose, saving, dialogRef)

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('')
    try { await onSubmit({ comment }) } catch (err) { setError(err.message); setSaving(false) }
  }

  return <div className="borrow-modal-backdrop" role="presentation">
    <section ref={dialogRef} className="borrow-modal" role="dialog" aria-modal="true" aria-labelledby="approve-title">
      <header><div><span className="is-success"><UserCheck size={18} /></span><div><h2 id="approve-title">อนุมัติ {request.requestNumber}</h2><p>{request.employee.fullName} · {request.asset.assetTag}</p></div></div><button type="button" onClick={onClose} disabled={saving} aria-label="ปิด"><X size={19} /></button></header>
      <form onSubmit={submit}>{error && <div className="borrow-form-error" role="alert"><AlertCircle size={17} />{error}</div>}<div className="borrow-approval-note"><CheckCircle2 size={18} /><p>เมื่อยืนยัน ระบบจะสร้าง Assignment ให้พนักงานโดยอัตโนมัติ</p></div><label htmlFor="approve-comment">ความคิดเห็นการอนุมัติ<textarea id="approve-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength="1000" rows="4" autoFocus placeholder="เงื่อนไขหรือหมายเหตุสำหรับการอนุมัติ (ไม่บังคับ)" /></label><footer><button className="btn-secondary" type="button" onClick={onClose} disabled={saving}>กลับ</button><button className="btn-primary" type="submit" disabled={saving}>{saving ? <RefreshCw className="borrow-spin" size={17} /> : <Check size={17} />}อนุมัติและสร้าง Assignment</button></footer></form>
    </section>
  </div>
}

const APPROVAL_ACTION_LABELS = { STARTED: 'เริ่มกระบวนการอนุมัติ', APPROVED: 'อนุมัติคำขอ', REJECTED: 'ปฏิเสธคำขอ' }

function TimelineModal({ request, onClose }) {
  const dialogRef = useRef(null)
  useDialogDismiss(onClose, false, dialogRef)
  const timeline = request.approvalHistory || []
  return <div className="borrow-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className="borrow-modal borrow-timeline-modal" role="dialog" aria-modal="true" aria-labelledby="timeline-title">
      <header><div><span><FileClock size={18} /></span><div><h2 id="timeline-title">Approval Timeline</h2><p>{request.requestNumber} · {request.employee.fullName}</p></div></div><button type="button" onClick={onClose} aria-label="ปิด" autoFocus><X size={19} /></button></header>
      <div className="borrow-timeline-body">
        <dl className="borrow-request-facts"><div><dt>ครุภัณฑ์</dt><dd>{request.asset.assetTag} — {request.asset.name}</dd></div><div><dt>สถานะ</dt><dd><StatusBadge status={request.status} /></dd></div><div><dt>วันที่ส่งคำขอ</dt><dd>{formatDateTime(request.requestedAt)}</dd></div><div><dt>เหตุผล</dt><dd>{request.reason}</dd></div></dl>
        <ol className="borrow-timeline">{timeline.map((entry) => <li className={`is-${entry.action.toLowerCase()}`} key={entry.id}><span>{entry.action === 'APPROVED' ? <Check size={16} /> : entry.action === 'REJECTED' ? <Ban size={16} /> : <Clock3 size={16} />}</span><div><div><strong>{APPROVAL_ACTION_LABELS[entry.action] || entry.action}</strong><time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time></div><p><UserCheck size={14} />{entry.actorUser ? (entry.actorUser.name || entry.actorUser.email) : 'ไม่ทราบผู้ดำเนินการ'}</p>{entry.comment && <blockquote><MessageSquareText size={14} />{entry.comment}</blockquote>}{entry.action === 'REJECTED' && request.rejectedReason && <small>เหตุผลที่ปฏิเสธ: {request.rejectedReason}</small>}</div></li>)}</ol>
      </div>
      <footer className="borrow-timeline-footer"><button className="btn-secondary" type="button" onClick={onClose}>ปิด</button></footer>
    </section>
  </div>
}

function Skeleton() {
  return <div className="borrow-skeleton" aria-busy="true" aria-label="กำลังโหลดคำขอยืม"><span /><span /><span /><span /></div>
}

export default function BorrowRequests({ role }) {
  const canApprove = role === 'ADMIN' || role === 'IT_STAFF'
  const canCreate = role === 'EMPLOYEE'
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState({ page: 1, totalItems: 0, totalPages: 1 })
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState(canApprove ? 'PENDING' : '')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [assets, setAssets] = useState([])
  const [rejectTarget, setRejectTarget] = useState(null)
  const [approveTarget, setApproveTarget] = useState(null)
  const [timelineTarget, setTimelineTarget] = useState(null)
  const [workingId, setWorkingId] = useState('')

  useEffect(() => { const timer = setTimeout(() => setSearch(searchInput.trim()), 400); return () => clearTimeout(timer) }, [searchInput])
  useEffect(() => setPage(1), [search, status])

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const result = await api.borrowRequests.list({ page, pageSize: PAGE_SIZE, status, search, sortBy: 'requestedAt', sortOrder: 'desc' })
      setItems(result.items); setMeta(result); setError('')
    } catch (err) { setError(err.message) } finally { setLoading(false); setRefreshing(false) }
  }, [page, search, status])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!canCreate) return
    api.borrowRequests.availableAssets().then((response) => setAssets(response.items)).catch(() => setAssets([]))
  }, [canCreate])

  const counts = useMemo(() => ({ pending: items.filter((item) => item.status === 'PENDING').length, completed: items.filter((item) => item.status === 'COMPLETED').length, rejected: items.filter((item) => item.status === 'REJECTED').length }), [items])

  async function create(payload) {
    await api.borrowRequests.add(payload); setFormOpen(false)
    const options = await api.borrowRequests.availableAssets(); setAssets(options.items); setStatus(''); setPage(1); load()
  }
  async function approve(payload) {
    const item = approveTarget
    setWorkingId(item.id)
    try { await api.borrowRequests.approve(item.id, payload); setApproveTarget(null); await load() } catch (err) { setWorkingId(''); throw err } finally { setWorkingId('') }
  }
  async function reject(payload) { await api.borrowRequests.reject(rejectTarget.id, payload); setRejectTarget(null); load() }
  async function cancel(item) {
    if (!window.confirm(`ยืนยันยกเลิกคำขอ ${item.requestNumber}?`)) return
    setWorkingId(item.id)
    try { await api.borrowRequests.cancel(item.id); await load() } catch (err) { setError(err.message) } finally { setWorkingId('') }
  }

  return <section className="borrow-page">
    <header className="borrow-hero"><div><span className="borrow-eyebrow"><ClipboardList size={15} /> Borrow workflow</span><h1>{canApprove ? 'คิวอนุมัติคำขอยืม' : 'คำขอยืมครุภัณฑ์'}</h1><p>{canApprove ? 'ตรวจสอบและดำเนินการคำขอก่อนสร้างการมอบหมาย' : 'ส่งคำขอ ติดตามสถานะ และดูประวัติการยืมได้ในที่เดียว'}</p></div>{canCreate && <button className="btn-primary borrow-create" type="button" onClick={() => setFormOpen(true)}><Plus size={18} /> สร้างคำขอยืม</button>}</header>

    <div className="borrow-metrics" aria-label="สรุปรายการในหน้านี้"><article><span className="is-warning"><Clock3 size={19} /></span><div><strong>{counts.pending}</strong><small>รออนุมัติในหน้านี้</small></div></article><article><span className="is-success"><CheckCircle2 size={19} /></span><div><strong>{counts.completed}</strong><small>เสร็จสิ้นในหน้านี้</small></div></article><article><span className="is-danger"><Ban size={19} /></span><div><strong>{counts.rejected}</strong><small>ปฏิเสธในหน้านี้</small></div></article></div>

    <div className="borrow-toolbar"><label htmlFor="borrow-search"><Search size={18} /><input id="borrow-search" type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="ค้นหาเลขที่คำขอ พนักงาน แผนก หรือครุภัณฑ์..." />{refreshing && <RefreshCw className="borrow-spin" size={16} />}</label><select aria-label="กรองตามสถานะ" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">ทุกสถานะ</option>{BORROW_REQUEST_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
    {canApprove && <nav className="borrow-quick" aria-label="ตัวกรองคิวอนุมัติ"><button type="button" className={status === 'PENDING' ? 'is-active' : ''} onClick={() => setStatus('PENDING')}>รออนุมัติ</button><button type="button" className={status === 'COMPLETED' ? 'is-active' : ''} onClick={() => setStatus('COMPLETED')}>อนุมัติแล้ว</button><button type="button" className={status === 'REJECTED' ? 'is-active' : ''} onClick={() => setStatus('REJECTED')}>ปฏิเสธ</button><button type="button" className={status === '' ? 'is-active' : ''} onClick={() => setStatus('')}>ทั้งหมด</button></nav>}
    {error && <div className="borrow-error" role="alert"><AlertCircle size={18} /><span>{error}</span><button type="button" onClick={load}>ลองใหม่</button></div>}

    {loading ? <Skeleton /> : items.length === 0 ? <div className="borrow-empty"><span><SearchX size={28} /></span><h2>{search || status ? 'ไม่พบคำขอที่ตรงกับเงื่อนไข' : 'ยังไม่มีคำขอยืม'}</h2><p>{canCreate && !search && !status ? 'เริ่มต้นด้วยการส่งคำขอยืมครุภัณฑ์ชิ้นแรก' : 'ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ'}</p>{canCreate && !search && !status && <button className="btn-primary" type="button" onClick={() => setFormOpen(true)}><Plus size={17} /> สร้างคำขอ</button>}</div> : <div className={`borrow-table-card${refreshing ? ' is-refreshing' : ''}`}>
      <div className="borrow-table-head"><div><h2>{canApprove && status === 'PENDING' ? 'รายการรออนุมัติ' : 'ประวัติคำขอยืม'}</h2><p>แสดง {items.length} จาก {meta.totalItems} รายการ</p></div><FileClock size={20} /></div>
      <div className="borrow-table-scroll"><table><thead><tr><th scope="col">เลขที่คำขอ</th><th scope="col">พนักงาน</th><th scope="col">ครุภัณฑ์</th><th scope="col">วันที่ขอ / คืน</th><th scope="col">เหตุผล</th><th scope="col">สถานะ / ผู้พิจารณา</th><th scope="col" className="borrow-actions-column">ดำเนินการ</th></tr></thead><tbody>{items.map((item) => { const decision = [...(item.approvalHistory || [])].reverse().find((entry) => entry.action === 'APPROVED' || entry.action === 'REJECTED'); return <tr key={item.id}><td data-label="เลขที่คำขอ"><strong className="borrow-number">{item.requestNumber}</strong><small>{formatDate(item.requestedAt)}</small></td><td data-label="พนักงาน"><strong>{item.employee.fullName}</strong><small>{item.employee.employeeCode} · {item.employee.department?.name || 'ไม่ระบุแผนก'}{item.employee.position ? ` · ${item.employee.position}` : ''}</small></td><td data-label="ครุภัณฑ์"><strong>{item.asset.assetTag}</strong><small>{item.asset.name}</small></td><td data-label="วันที่ขอ / คืน"><span><CalendarClock size={14} />{formatDate(item.requestedAt)}</span><small>คาดว่าจะคืน {formatDate(item.expectedReturnDate)}</small></td><td data-label="เหตุผล"><p className="borrow-reason">{item.reason}</p>{item.rejectedReason && <small className="borrow-rejected-reason">ปฏิเสธ: {item.rejectedReason}</small>}</td><td data-label="สถานะ / ผู้พิจารณา"><StatusBadge status={item.status} />{decision && <small>{decision.actorUser ? (decision.actorUser.name || decision.actorUser.email) : 'ไม่ทราบผู้พิจารณา'} · {formatDateTime(decision.createdAt)}</small>}</td><td data-label="ดำเนินการ" className="borrow-actions-column"><div className="borrow-actions">{canApprove && item.status === 'PENDING' && <><button className="is-approve" type="button" disabled={workingId === item.id} onClick={() => setApproveTarget(item)}>{workingId === item.id ? <RefreshCw className="borrow-spin" size={15} /> : <Check size={15} />}อนุมัติ</button><button className="is-reject" type="button" onClick={() => setRejectTarget(item)}><Ban size={15} />ปฏิเสธ</button></>}{canCreate && item.status === 'PENDING' && <button className="borrow-cancel" type="button" disabled={workingId === item.id} onClick={() => cancel(item)}><X size={15} />ยกเลิกคำขอ</button>}<button type="button" onClick={() => setTimelineTarget(item)}><Eye size={15} />Timeline</button></div></td></tr> })}</tbody></table></div>
      <footer className="borrow-pagination"><p>หน้า {meta.page} จาก {meta.totalPages} · ทั้งหมด {meta.totalItems} รายการ</p><div><button type="button" aria-label="หน้าก่อนหน้า" disabled={refreshing || meta.page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={17} /></button><span>{meta.page}</span><button type="button" aria-label="หน้าถัดไป" disabled={refreshing || meta.page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}><ChevronRight size={17} /></button></div></footer>
    </div>}
    {formOpen && <RequestForm assets={assets} onSubmit={create} onClose={() => setFormOpen(false)} />}
    {approveTarget && <ApproveForm request={approveTarget} onSubmit={approve} onClose={() => setApproveTarget(null)} />}
    {rejectTarget && <RejectForm request={rejectTarget} onSubmit={reject} onClose={() => setRejectTarget(null)} />}
    {timelineTarget && <TimelineModal request={timelineTarget} onClose={() => setTimelineTarget(null)} />}
  </section>
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownToLine, Box, CheckCircle2, ChevronLeft, ChevronRight, CirclePause,
  Clock3, FileClock, FileDown, FilePlus2, FileX2, FilterX, History,
  LogIn, MapPin, PackageCheck, Pencil, RefreshCw, RotateCcw, Search, SearchX,
  ShieldCheck, Store, Tag, Ticket, UserRound, Users, Wrench, XCircle,
} from 'lucide-react'
import { api } from '../api.js'
import AuditLogDetail from '../components/AuditLogDetail.jsx'
import { formatDateTime } from '../utils/format.js'
import DateInput from '../components/DateInput.jsx'
import { ACTION_LABELS, ENTITY_TYPE_LABELS } from '../utils/auditLabels.js'
import './AuditLog.css'

const PAGE_SIZE = 20
const ACTION_OPTIONS = Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))
const ENTITY_TYPE_OPTIONS = Object.entries(ENTITY_TYPE_LABELS).map(([value, label]) => ({ value, label }))
const EMPTY_FILTERS = { action: '', entityType: '', performedBy: '', dateFrom: '', dateTo: '' }

const ACTION_UI = {
  CREATE: ['green', FilePlus2], UPDATE: ['blue', Pencil], DELETE: ['red', FileX2], RESTORE: ['green', RotateCcw],
  ASSIGN: ['violet', PackageCheck], RETURN: ['cyan', RotateCcw], OPEN: ['blue', Ticket],
  START_PROGRESS: ['amber', Wrench], ON_HOLD: ['amber', CirclePause], RESOLVE: ['green', CheckCircle2],
  CLOSE: ['slate', XCircle], LOGIN: ['cyan', LogIn], EXPORT_REPORT: ['violet', FileDown],
}
const ENTITY_ICONS = { Asset: Box, Assignment: PackageCheck, Ticket, Employee: Users, Category: Tag, Department: Users, Location: MapPin, Vendor: Store, User: UserRound, Report: FileClock }

function AuditSkeleton() {
  return <div className="audit-skeleton" aria-label="กำลังโหลด Audit Log" aria-busy="true">{[1, 2, 3, 4].map((item) => <div className="audit-shimmer" key={item} />)}</div>
}

export default function AuditLog() {
  const [logs, setLogs] = useState([])
  const [meta, setMeta] = useState({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [userOptions, setUserOptions] = useState(null)
  const [detailLog, setDetailLog] = useState(null)

  useEffect(() => {
    let cancelled = false
    api.users.list({ pageSize: 100, sortBy: 'name', sortOrder: 'asc' }).then((result) => { if (!cancelled) setUserOptions(result.items) }).catch(() => {})
    return () => { cancelled = true }
  }, [])
  useEffect(() => { const timer = setTimeout(() => setSearch(searchInput.trim()), 400); return () => clearTimeout(timer) }, [searchInput])

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const result = await api.audit.list({ page, pageSize: PAGE_SIZE, search, ...filters })
      setLogs(result.items); setMeta(result); setError('')
    } catch (err) { setError(err.message) } finally { setLoading(false); setRefreshing(false) }
  }, [filters, page, search])

  useEffect(() => { setPage(1) }, [search, filters])
  useEffect(() => { load() }, [load])

  const actionSummary = useMemo(() => logs.reduce((result, log) => ({ ...result, [log.action]: (result[log.action] || 0) + 1 }), {}), [logs])
  const activeCount = Object.values(filters).filter(Boolean).length + (search ? 1 : 0)
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }))
  const quickFilter = (value) => setFilters((current) => ({ ...current, action: current.action === value ? '' : value }))
  const resetFilters = () => { setSearchInput(''); setSearch(''); setFilters({ ...EMPTY_FILTERS }) }

  return <section className="audit-page">
    <header className="audit-hero">
      <div><span className="audit-eyebrow"><ShieldCheck size={15} /> System integrity</span><h1>Audit Log</h1><p>ตรวจสอบทุกความเคลื่อนไหวสำคัญ พร้อมหลักฐานการเปลี่ยนแปลงที่ย้อนดูได้</p></div>
      <div className="audit-hero-stat"><History size={25} /><span><strong>{meta.totalItems}</strong><small>เหตุการณ์ทั้งหมด</small></span></div>
    </header>

    <div className="audit-toolbar">
      <label className="audit-search" htmlFor="audit-search"><Search size={18} /><input id="audit-search" type="search" placeholder="ค้นหาคำอธิบาย หรือรหัสรายการ..." value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />{refreshing && <RefreshCw className="audit-spin" size={16} />}</label>
      <button className={filtersOpen ? 'is-active' : ''} type="button" onClick={() => setFiltersOpen((open) => !open)}><FilterX size={17} /> ตัวกรอง {activeCount > 0 && <b>{activeCount}</b>}</button>
    </div>

    {filtersOpen && <div className="audit-filters">
      <label>การกระทำ<select value={filters.action} onChange={(e) => setFilter('action', e.target.value)}><option value="">ทั้งหมด</option>{ACTION_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label>ประเภทข้อมูล<select value={filters.entityType} onChange={(e) => setFilter('entityType', e.target.value)}><option value="">ทั้งหมด</option>{ENTITY_TYPE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label>ผู้ทำรายการ<select value={filters.performedBy} onChange={(e) => setFilter('performedBy', e.target.value)} disabled={!userOptions}><option value="">ทั้งหมด</option>{userOptions?.map((item) => <option key={item.id} value={item.id}>{item.name || item.email}</option>)}</select></label>
      <label>ตั้งแต่วันที่<DateInput value={filters.dateFrom} onChange={(value) => setFilter('dateFrom', value)} /></label>
      <label>ถึงวันที่<DateInput value={filters.dateTo} onChange={(value) => setFilter('dateTo', value)} /></label>
      <button className="audit-reset" type="button" onClick={resetFilters} disabled={!activeCount}><FilterX size={16} /> ล้างตัวกรอง</button>
    </div>}

    <nav className="audit-quick" aria-label="ตัวกรองการกระทำด่วน"><span>ดูด่วน</span>{[['LOGIN', LogIn], ['CREATE', FilePlus2], ['UPDATE', Pencil], ['DELETE', FileX2], ['EXPORT_REPORT', ArrowDownToLine]].map(([value, Icon]) => <button className={filters.action === value ? 'is-active' : ''} type="button" key={value} onClick={() => quickFilter(value)}><Icon size={14} />{ACTION_LABELS[value]}<b>{actionSummary[value] || 0}</b></button>)}</nav>
    {error && <div className="audit-error" role="alert"><XCircle size={18} />{error}<button onClick={load}>ลองใหม่</button></div>}

    {loading ? <AuditSkeleton /> : logs.length === 0 ? <div className="audit-empty"><span><SearchX size={28} /></span><h2>{activeCount ? 'ไม่พบเหตุการณ์ที่ค้นหา' : 'ยังไม่มี Audit Log'}</h2><p>{activeCount ? 'ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง' : 'ประวัติการทำรายการสำคัญจะปรากฏที่นี่'}</p>{activeCount > 0 && <button onClick={resetFilters}><FilterX size={16} /> ล้างตัวกรอง</button>}</div> :
      <div className={`audit-panel${refreshing ? ' is-refreshing' : ''}`}>
        <div className="audit-panel-head"><div><h2>ลำดับเหตุการณ์</h2><p>แสดง {logs.length} จาก {meta.totalItems} รายการ · เรียงล่าสุดก่อน</p></div><span><Clock3 size={15} /> Live history</span></div>
        <ol className="audit-timeline">{logs.map((log) => {
          const [tone, ActionIcon] = ACTION_UI[log.action] || ['slate', History]
          const EntityIcon = ENTITY_ICONS[log.entityType] || FileClock
          return <li key={log.id} className={`is-${tone}`}>
            <div className="audit-time"><strong>{formatDateTime(log.performedAt)}</strong><small>{log.ipAddress || 'ไม่ระบุ IP'}</small></div>
            <span className="audit-node"><ActionIcon size={17} /></span>
            <article className="audit-event">
              <div className="audit-event-head"><div><span className={`audit-action is-${tone}`}><ActionIcon size={13} />{ACTION_LABELS[log.action] || log.action}</span><span className="audit-entity"><EntityIcon size={13} />{ENTITY_TYPE_LABELS[log.entityType] || log.entityType}</span></div><button type="button" onClick={() => setDetailLog(log)}>ดูการเปลี่ยนแปลง</button></div>
              <h3>{log.description || 'ไม่มีคำอธิบายเพิ่มเติม'}</h3>
              <div className="audit-actor"><span><UserRound size={15} /></span><div><small>ดำเนินการโดย</small><strong>{log.performedBy ? (log.performedBy.name || log.performedBy.email) : 'ระบบ/ไม่ทราบ'}</strong></div>{log.entityId && <code>{log.entityId}</code>}</div>
            </article>
          </li>
        })}</ol>
        <div className="audit-pagination"><span>หน้า {meta.page} จาก {meta.totalPages} · ทั้งหมด {meta.totalItems} รายการ</span><div><button aria-label="หน้าก่อนหน้า" disabled={refreshing || meta.page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={17} /></button><b>{meta.page}</b><button aria-label="หน้าถัดไป" disabled={refreshing || meta.page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}><ChevronRight size={17} /></button></div></div>
      </div>}

    {detailLog && <AuditLogDetail log={detailLog} onClose={() => setDetailLog(null)} />}
  </section>
}

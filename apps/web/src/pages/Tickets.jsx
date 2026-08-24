import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, CircleDot, Clock3, Edit3, FilterX, Headphones, Inbox, Laptop, Plus, RefreshCw, Search, SearchX, SlidersHorizontal, Sparkles, Tag, UserRound, UserRoundCheck, Wrench } from 'lucide-react'
import { api } from '../api.js'
import TicketForm, { TICKET_STATUS_OPTIONS, TICKET_PRIORITY_OPTIONS, TICKET_CATEGORY_OPTIONS } from '../components/TicketForm.jsx'
import ResolveTicketForm from '../components/ResolveTicketForm.jsx'
import CloseTicketForm from '../components/CloseTicketForm.jsx'
import { formatDate } from '../utils/format.js'
import './Tickets.css'

const PAGE_SIZE = 20
const EMPTY_FILTERS = { priority: '', status: '', category: '', assignedToId: '', reportedById: '', assetId: '' }
const EDITABLE_STATUSES = ['OPEN', 'IN_PROGRESS', 'ON_HOLD']
const PRIORITIES = { LOW: ['ต่ำ', 'slate'], MEDIUM: ['ปานกลาง', 'blue'], HIGH: ['สูง', 'amber'], CRITICAL: ['วิกฤต', 'red'] }
const STATUSES = {
  OPEN: ['เปิดใหม่', 'blue', CircleDot], IN_PROGRESS: ['กำลังดำเนินการ', 'violet', RefreshCw], ON_HOLD: ['พักงาน', 'amber', Clock3],
  RESOLVED: ['แก้ไขสำเร็จ', 'green', CheckCircle2], CLOSED: ['ปิดงานแล้ว', 'slate', Inbox],
}
const SORTS = [
  ['openedAt:desc', 'แจ้งล่าสุด'], ['openedAt:asc', 'แจ้งเก่าสุด'], ['priority:desc', 'ความสำคัญสูงสุด'], ['ticketNumber:asc', 'เลขที่ใบแจ้ง'],
]
const categoryLabel = (value) => TICKET_CATEGORY_OPTIONS.find((item) => item.value === value)?.label || value

function StatusChip({ value }) {
  const [label, tone, Icon] = STATUSES[value] || [value, 'slate', CircleDot]
  return <span className={`hd-status is-${tone}`}><Icon size={13} />{label}</span>
}

function PriorityChip({ value }) {
  const [label, tone] = PRIORITIES[value] || [value, 'slate']
  return <span className={`hd-priority is-${tone}`}><i />{label}</span>
}

function Skeleton() {
  return <div className="hd-grid hd-skeleton" aria-busy="true" aria-label="กำลังโหลด"><div className="hd-stack">{[1, 2, 3, 4].map((item) => <div className="hd-skeleton-ticket hd-shimmer" key={item} />)}</div><div className="hd-skeleton-side hd-shimmer" /></div>
}

export default function Tickets({ role, initialAssetId }) {
  const canManage = role === 'ADMIN' || role === 'IT_STAFF'
  const [tickets, setTickets] = useState([])
  const [meta, setMeta] = useState({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('openedAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(() => ({ ...EMPTY_FILTERS, assetId: initialAssetId || '' }))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingTicket, setEditingTicket] = useState(null)
  const [resolveTarget, setResolveTarget] = useState(null)
  const [closeTarget, setCloseTarget] = useState(null)
  const [assetOptions, setAssetOptions] = useState(null)
  const [userOptions, setUserOptions] = useState(null)

  useEffect(() => {
    let cancelled = false
    const requests = [api.listAssets({ pageSize: 100, sortBy: 'assetTag', sortOrder: 'asc' })]
    if (canManage) requests.push(api.users.list({ pageSize: 100, sortBy: 'name', sortOrder: 'asc' }))
    Promise.all(requests).then(([assets, users]) => {
      if (!cancelled) { setAssetOptions(assets.items); if (users) setUserOptions(users.items) }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [canManage])

  useEffect(() => { const timer = setTimeout(() => setSearch(searchInput.trim()), 400); return () => clearTimeout(timer) }, [searchInput])

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const result = await api.tickets.list({ page, pageSize: PAGE_SIZE, sortBy, sortOrder, search, ...filters })
      setTickets(result.items); setMeta(result); setError('')
    } catch (err) { setError(err.message) } finally { setLoading(false); setRefreshing(false) }
  }, [filters, page, search, sortBy, sortOrder])

  useEffect(() => { setPage(1) }, [search, sortBy, sortOrder, filters])
  useEffect(() => { load() }, [load])

  const counts = useMemo(() => Object.keys(PRIORITIES).reduce((result, key) => ({ ...result, [key]: tickets.filter((ticket) => ticket.priority === key).length }), {}), [tickets])
  const timeline = useMemo(() => [...tickets].sort((a, b) => new Date(b.closedAt || b.resolvedAt || b.openedAt) - new Date(a.closedAt || a.resolvedAt || a.openedAt)).slice(0, 5), [tickets])
  const activeCount = Object.values(filters).filter(Boolean).length + (search ? 1 : 0)
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }))
  const quickFilter = (key, value) => setFilters((current) => ({ ...current, [key]: current[key] === value ? '' : value }))
  const resetFilters = () => { setSearchInput(''); setSearch(''); setFilters({ ...EMPTY_FILTERS }) }
  const openCreate = () => { setEditingTicket(null); setFormOpen(true) }

  async function handleSubmit(payload) {
    if (editingTicket) await api.tickets.update(editingTicket.id, payload)
    else {
      const created = await api.tickets.add(payload)
      window.dispatchEvent(new CustomEvent('helpdesk-ticket-created', { detail: created }))
    }
    setFormOpen(false); setEditingTicket(null); load()
  }
  async function handleResolve(payload) { await api.tickets.resolve(resolveTarget.id, payload); setResolveTarget(null); load() }
  async function handleClose(payload) { await api.tickets.close(closeTarget.id, payload); setCloseTarget(null); load() }

  return (
    <section className="helpdesk-page">
      <header className="hd-hero">
        <div><span className="hd-eyebrow"><Headphones size={15} /> Service desk</span><h1>Helpdesk</h1><p>ติดตาม จัดลำดับความสำคัญ และจัดการทุกปัญหาไอทีในที่เดียว</p></div>
        <button className="hd-create" type="button" onClick={openCreate}><Plus size={18} /> แจ้งปัญหาใหม่</button>
      </header>

      <div className="hd-priority-grid" aria-label="สรุปความสำคัญในหน้านี้">
        {Object.entries(PRIORITIES).map(([value, [label, tone]]) => <button type="button" className={`hd-priority-card is-${tone}${filters.priority === value ? ' is-active' : ''}`} key={value} onClick={() => quickFilter('priority', value)} aria-pressed={filters.priority === value}><span><AlertCircle size={18} /></span><div><strong>{counts[value] || 0}</strong><small>{label}</small></div></button>)}
      </div>

      <div className="hd-toolbar">
        <label className="hd-search" htmlFor="ticket-search"><Search size={18} /><input id="ticket-search" type="search" placeholder="ค้นหาเลขที่ใบแจ้ง หัวข้อ ครุภัณฑ์ หรือผู้แจ้ง..." value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />{refreshing && <RefreshCw className="hd-spin" size={16} />}</label>
        <button className={filtersOpen ? 'is-active' : ''} type="button" onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal size={17} /> ตัวกรอง {activeCount > 0 && <b>{activeCount}</b>}</button>
        <select aria-label="เรียงรายการ" value={`${sortBy}:${sortOrder}`} onChange={(event) => { const [field, order] = event.target.value.split(':'); setSortBy(field); setSortOrder(order) }}>{SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      </div>

      {filtersOpen && <div className="hd-filters">
        <label>ความสำคัญ<select value={filters.priority} onChange={(e) => setFilter('priority', e.target.value)}><option value="">ทั้งหมด</option>{TICKET_PRIORITY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>สถานะ<select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}><option value="">ทั้งหมด</option>{TICKET_STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>หมวดหมู่<select value={filters.category} onChange={(e) => setFilter('category', e.target.value)}><option value="">ทั้งหมด</option>{TICKET_CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>ครุภัณฑ์<select value={filters.assetId} onChange={(e) => setFilter('assetId', e.target.value)} disabled={!assetOptions}><option value="">ทั้งหมด</option>{assetOptions?.map((item) => <option key={item.id} value={item.id}>{item.assetTag} — {item.name}</option>)}</select></label>
        {canManage && <label>ผู้ดูแล<select value={filters.assignedToId} onChange={(e) => setFilter('assignedToId', e.target.value)} disabled={!userOptions}><option value="">ทั้งหมด</option>{userOptions?.filter((item) => item.role !== 'EMPLOYEE').map((item) => <option key={item.id} value={item.id}>{item.name || item.email}</option>)}</select></label>}
        {canManage && <label>ผู้แจ้ง<select value={filters.reportedById} onChange={(e) => setFilter('reportedById', e.target.value)} disabled={!userOptions}><option value="">ทั้งหมด</option>{userOptions?.map((item) => <option key={item.id} value={item.id}>{item.name || item.email}</option>)}</select></label>}
        <button className="hd-reset" type="button" onClick={resetFilters} disabled={!activeCount}><FilterX size={16} /> ล้างตัวกรอง</button>
      </div>}

      <nav className="hd-quick" aria-label="ตัวกรองด่วน"><span><Sparkles size={15} /> ดูด่วน</span>{[['OPEN', 'เปิดใหม่'], ['IN_PROGRESS', 'กำลังดำเนินการ'], ['RESOLVED', 'แก้ไขสำเร็จ']].map(([value, label]) => <button className={filters.status === value ? 'is-active' : ''} type="button" key={value} onClick={() => quickFilter('status', value)}>{label}</button>)}<button className={filters.priority === 'CRITICAL' ? 'is-active is-critical' : ''} type="button" onClick={() => quickFilter('priority', 'CRITICAL')}>วิกฤต</button></nav>
      {error && <div className="hd-error" role="alert"><AlertCircle size={18} />{error}<button type="button" onClick={load}>ลองใหม่</button></div>}

      {loading ? <Skeleton /> : tickets.length === 0 ? <div className="hd-empty"><span><SearchX size={28} /></span><h2>{activeCount ? 'ไม่พบใบแจ้งที่ค้นหา' : 'ยังไม่มีใบแจ้งซ่อม'}</h2><p>{activeCount ? 'ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง' : 'สร้างใบแจ้งแรกเพื่อเริ่มติดตามปัญหาไอที'}</p><button type="button" onClick={activeCount ? resetFilters : openCreate}>{activeCount ? <><FilterX size={16} /> ล้างตัวกรอง</> : <><Plus size={16} /> แจ้งปัญหาใหม่</>}</button></div> :
        <div className={`hd-grid${refreshing ? ' is-refreshing' : ''}`}>
          <div className="hd-list-panel">
            <div className="hd-panel-head"><div><h2>รายการใบแจ้ง</h2><p>แสดง {tickets.length} จาก {meta.totalItems} รายการ</p></div><span>หน้า {meta.page}/{meta.totalPages}</span></div>
            <div className="hd-stack">{tickets.map((ticket) => {
              const tone = PRIORITIES[ticket.priority]?.[1] || 'slate'
              return <article className={`hd-ticket is-${tone}`} key={ticket.id}>
                <div className="hd-ticket-main"><div className="hd-ticket-meta"><strong>{ticket.ticketNumber}</strong><PriorityChip value={ticket.priority} /><StatusChip value={ticket.status} /></div><h3>{ticket.title}</h3>{ticket.description && <p className="hd-description">{ticket.description}</p>}<div className="hd-details"><span><Laptop size={15} /><b>{ticket.asset?.assetTag || '—'}</b>{ticket.asset?.name && ` · ${ticket.asset.name}`}</span><span><Tag size={15} />{categoryLabel(ticket.category)}</span><span><UserRound size={15} />{ticket.reportedBy?.name || ticket.reportedBy?.email || '—'}</span><span><CalendarClock size={15} />{formatDate(ticket.openedAt)}</span></div></div>
                <aside className="hd-ticket-side"><div className={`hd-assignee${ticket.assignedTo ? ' is-assigned' : ''}`}><span>{ticket.assignedTo ? <UserRoundCheck size={17} /> : <UserRound size={17} />}</span><div><small>ผู้ดูแล</small><strong>{ticket.assignedTo ? (ticket.assignedTo.name || ticket.assignedTo.email) : 'ยังไม่มอบหมาย'}</strong></div></div>{canManage && <div className="hd-actions">{EDITABLE_STATUSES.includes(ticket.status) && <button type="button" onClick={() => { setEditingTicket(ticket); setFormOpen(true) }}><Edit3 size={15} /> แก้ไข/มอบหมาย</button>}{ticket.status === 'IN_PROGRESS' && <button className="is-success" type="button" onClick={() => setResolveTarget(ticket)}><Wrench size={15} /> แก้ไขสำเร็จ</button>}{ticket.status === 'RESOLVED' && <button className="is-success" type="button" onClick={() => setCloseTarget(ticket)}><CheckCircle2 size={15} /> ปิดงาน</button>}</div>}</aside>
              </article>
            })}</div>
            <div className="hd-pagination"><p>หน้า {meta.page} จาก {meta.totalPages} · ทั้งหมด {meta.totalItems} รายการ</p><div><button type="button" aria-label="หน้าก่อนหน้า" disabled={refreshing || meta.page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={17} /></button><span>{meta.page}</span><button type="button" aria-label="หน้าถัดไป" disabled={refreshing || meta.page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}><ChevronRight size={17} /></button></div></div>
          </div>
          <aside className="hd-timeline-panel"><div className="hd-panel-head"><div><h2>ความเคลื่อนไหวล่าสุด</h2><p>อัปเดตจากรายการในหน้านี้</p></div><Clock3 size={18} /></div><ol className="hd-timeline">{timeline.map((ticket) => { const [label, tone, Icon] = STATUSES[ticket.status] || STATUSES.OPEN; return <li key={ticket.id}><span className={`is-${tone}`}><Icon size={15} /></span><div><strong>{ticket.ticketNumber}</strong><p>{ticket.title}</p><small>{label} · {formatDate(ticket.closedAt || ticket.resolvedAt || ticket.openedAt)}</small></div></li> })}</ol></aside>
        </div>}

      {formOpen && <TicketForm ticket={editingTicket} onSubmit={handleSubmit} onCancel={() => { setFormOpen(false); setEditingTicket(null) }} />}
      {resolveTarget && <ResolveTicketForm ticket={resolveTarget} onSubmit={handleResolve} onCancel={() => setResolveTarget(null)} />}
      {closeTarget && <CloseTicketForm ticket={closeTarget} onSubmit={handleClose} onCancel={() => setCloseTarget(null)} />}
    </section>
  )
}

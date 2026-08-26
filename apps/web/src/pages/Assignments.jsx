import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  Eye,
  History,
  Inbox,
  PackageCheck,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SearchX,
  Undo2,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react'
import { api } from '../api.js'
import AssignmentForm from '../components/AssignmentForm.jsx'
import ReturnAssignmentForm, { ASSIGNMENT_STATUS_OPTIONS } from '../components/ReturnAssignmentForm.jsx'
import { formatDate } from '../utils/format.js'
import { assignmentHolderCode, assignmentHolderDepartment, assignmentHolderName, assignmentHolderPosition } from '../utils/assignmentHolder.js'
import './Assignments.css'

const PAGE_SIZE = 20
const EMPTY_FILTERS = { status: '', assetId: '', employeeId: '' }

const SORT_COLUMNS = [
  { field: 'assignedAt', label: 'วันที่มอบหมาย' },
  { field: 'returnedAt', label: 'วันที่คืน' },
  { field: 'status', label: 'สถานะ' },
]

const STATUS_META = {
  ASSIGNED: { label: 'กำลังถือครอง', icon: UserCheck, tone: 'blue' },
  RETURNED: { label: 'คืนแล้ว', icon: CheckCircle2, tone: 'green' },
  LOST: { label: 'สูญหาย', icon: AlertTriangle, tone: 'red' },
  DAMAGED: { label: 'เสียหาย', icon: Wrench, tone: 'amber' },
}

const RETURN_WORKFLOW_META = {
  PENDING_INSPECTION: { label: 'รอตรวจรับ', tone: 'amber', icon: Clock3 },
  PASSED: { label: 'ผ่านการตรวจ', tone: 'green', icon: CheckCircle2 },
  FAILED: { label: 'ไม่ผ่านการตรวจ', tone: 'red', icon: AlertTriangle },
  RETURNED: { label: 'คืนเสร็จสมบูรณ์', tone: 'green', icon: CheckCircle2 },
  DAMAGED: { label: 'รับคืนแบบชำรุด', tone: 'amber', icon: Wrench },
  LOST: { label: 'สูญหาย', tone: 'red', icon: AlertTriangle },
}

function statusLabel(status) {
  return ASSIGNMENT_STATUS_OPTIONS.find((option) => option.value === status)?.label || status
}

function ReturnWorkflowBadge({ status }) {
  const config = RETURN_WORKFLOW_META[status]
  if (!config) return null
  const Icon = config.icon
  return <span className={`assignment-return-badge tone-${config.tone}`}><Icon size={12} aria-hidden="true" />{config.label}</span>
}

function pagesFor(current, total) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1)
  return [...new Set([1, current - 1, current, current + 1, total])]
    .filter((page) => page > 0 && page <= total)
    .sort((a, b) => a - b)
}

function AssignmentsSkeleton() {
  return (
    <div className="assignments-skeleton" aria-label="กำลังโหลดข้อมูลการมอบหมาย" aria-busy="true">
      <div className="assignments-skeleton-filters assignment-shimmer" />
      <div className="assignments-status-grid">
        {Array.from({ length: 5 }, (_, index) => <div className="assignments-skeleton-card assignment-shimmer" key={index} />)}
      </div>
      <div className="assignments-overview-grid">
        <div className="assignments-skeleton-panel assignment-shimmer" />
        <div className="assignments-skeleton-panel assignment-shimmer" />
      </div>
      <div className="assignments-skeleton-table assignment-shimmer" />
    </div>
  )
}

function SortHeader({ field, label, sortBy, sortOrder, refreshing, onSort }) {
  const active = field === sortBy
  return (
    <th aria-sort={active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button className={`assignment-sort-button${active ? ' is-active' : ''}`} onClick={() => onSort(field)} disabled={refreshing}>
        {label}{active ? (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : null}
      </button>
    </th>
  )
}

export default function Assignments({ role, user, initialAssetId }) {
  const canManage = role === 'ADMIN' || role === 'IT_STAFF'
  const [assignments, setAssignments] = useState([])
  const [meta, setMeta] = useState({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('assignedAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(() => ({ ...EMPTY_FILTERS, assetId: initialAssetId || '' }))
  const [formOpen, setFormOpen] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState(null)
  const [returnTarget, setReturnTarget] = useState(null)
  const [assetOptions, setAssetOptions] = useState(null)
  const [employeeOptions, setEmployeeOptions] = useState(null)

  useEffect(() => {
    let cancelled = false
    const requests = [api.listAssets({ pageSize: 100, sortBy: 'assetTag', sortOrder: 'asc' })]
    if (canManage) requests.push(api.employees.list({ pageSize: 100, sortBy: 'employeeCode', sortOrder: 'asc', status: 'ACTIVE', isActive: true }))
    Promise.all(requests)
      .then(([assetsResponse, employeesResponse]) => {
        if (cancelled) return
        setAssetOptions(assetsResponse.items)
        if (employeesResponse) setEmployeeOptions(employeesResponse.items)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [canManage])

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => { setPage(1) }, [search, sortBy, sortOrder, filters])

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const response = await api.assignments.list({ page, pageSize: PAGE_SIZE, sortBy, sortOrder, search, ...filters })
      setAssignments(response.items)
      setMeta(response)
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [page, sortBy, sortOrder, search, filters])

  useEffect(() => { load() }, [load])

  const currentHolders = useMemo(
    () => assignments.filter((assignment) => assignment.status === 'ASSIGNED').slice(0, 4),
    [assignments],
  )
  const recentTimeline = useMemo(
    () => [...assignments]
      .sort((left, right) => new Date(right.returnedAt || right.assignedAt) - new Date(left.returnedAt || left.assignedAt))
      .slice(0, 5),
    [assignments],
  )
  const statusCounts = useMemo(
    () => Object.fromEntries(Object.keys(STATUS_META).map((status) => [status, assignments.filter((item) => item.status === status).length])),
    [assignments],
  )
  const hasActiveFilters = search.length > 0 || Object.values(filters).some(Boolean)
  const activeFilterCount = (search ? 1 : 0) + Object.values(filters).filter(Boolean).length
  const isEmpty = !loading && assignments.length === 0
  const paginationPages = pagesFor(meta.page, meta.totalPages)

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function resetFilters() {
    setSearchInput('')
    setSearch('')
    setFilters(EMPTY_FILTERS)
  }

  function toggleSort(field) {
    if (refreshing) return
    if (sortBy === field) setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'))
    else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  function openCreate() {
    setEditingAssignment(null)
    setFormOpen(true)
  }

  function openEdit(assignment) {
    setEditingAssignment(assignment)
    setFormOpen(true)
  }

  async function handleSubmit(payload) {
    if (editingAssignment) await api.assignments.update(editingAssignment.id, payload)
    else await api.assignments.add(payload)
    setFormOpen(false)
    setEditingAssignment(null)
    load()
  }

  async function handleReturnStart(payload) {
    const updated = await api.assignments.startReturn(returnTarget.id, payload)
    setReturnTarget(updated)
    await load()
    return updated
  }

  async function handleReturnInspection(payload) {
    const updated = await api.assignments.inspectReturn(returnTarget.id, payload)
    setReturnTarget(updated)
    await load()
    return updated
  }

  return (
    <div className="assignments-page">
      <header className="assignments-page-header">
        <div>
          <span className="assignments-eyebrow"><PackageCheck size={15} /> ASSET LIFECYCLE</span>
          <h1>การมอบหมายครุภัณฑ์</h1>
          <p>ติดตามผู้ถือครองปัจจุบัน ประวัติการใช้งาน และสถานะการรับคืนในมุมมองเดียว</p>
        </div>
        {canManage && <button type="button" className="assignment-create-button" onClick={openCreate}><Plus size={18} /> มอบหมายครุภัณฑ์</button>}
      </header>

      <section className="assignments-filter-card" aria-label="ค้นหาและกรองรายการมอบหมาย">
        <div className="assignment-search-wrap">
          <Search size={18} aria-hidden="true" />
          <input
            id="assignment-search"
            type="search"
            placeholder="ค้นหา Asset Tag, ครุภัณฑ์, พนักงาน, Hostname หรือ Serial Number..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="ค้นหารายการมอบหมาย"
          />
        </div>
        <div className="assignment-filter-field">
          <label htmlFor="assignment-filter-status">สถานะ</label>
          <select id="assignment-filter-status" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="">ทุกสถานะ</option>
            {ASSIGNMENT_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="assignment-filter-field assignment-asset-filter">
          <label htmlFor="assignment-filter-asset">ครุภัณฑ์</label>
          <select id="assignment-filter-asset" value={filters.assetId} onChange={(event) => updateFilter('assetId', event.target.value)} disabled={!assetOptions}>
            <option value="">ทุกครุภัณฑ์</option>
            {assetOptions?.map((asset) => <option key={asset.id} value={asset.id}>{asset.assetTag} — {asset.name}</option>)}
          </select>
        </div>
        {canManage && (
          <div className="assignment-filter-field">
            <label htmlFor="assignment-filter-holder">ผู้ถือครอง</label>
            <select id="assignment-filter-holder" value={filters.employeeId} onChange={(event) => updateFilter('employeeId', event.target.value)} disabled={!employeeOptions}>
              <option value="">ทุกคน</option>
              {employeeOptions?.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeCode} — {employee.fullName}</option>)}
            </select>
          </div>
        )}
        <button type="button" className="assignment-reset-button" onClick={resetFilters} disabled={!activeFilterCount}>
          <RotateCcw size={16} /> รีเซ็ต
        </button>
      </section>

      {error && <div className="assignment-error" role="alert"><AlertTriangle size={18} /><span>{error}</span><button type="button" onClick={load}><RefreshCw size={15} /> ลองใหม่</button></div>}

      {loading ? <AssignmentsSkeleton /> : isEmpty ? (
        <div className="assignment-empty-state">
          <span>{hasActiveFilters ? <SearchX size={32} /> : <Inbox size={32} />}</span>
          <h2>{hasActiveFilters ? 'ไม่พบรายการที่ตรงกับตัวกรอง' : 'ยังไม่มีรายการมอบหมาย'}</h2>
          <p>{hasActiveFilters ? 'ลองเปลี่ยนคำค้นหาหรือรีเซ็ตตัวกรองเพื่อดูผลลัพธ์เพิ่มเติม' : (canManage ? 'เริ่มต้นติดตามวงจรครุภัณฑ์ด้วยการสร้างรายการมอบหมายแรก' : 'ยังไม่มีครุภัณฑ์ที่มอบหมายให้คุณ')}</p>
          {hasActiveFilters ? <button type="button" className="assignment-empty-secondary" onClick={resetFilters}><RotateCcw size={16} /> รีเซ็ตตัวกรอง</button> : canManage ? <button type="button" onClick={openCreate}><Plus size={16} /> มอบหมายครุภัณฑ์</button> : null}
        </div>
      ) : (
        <>
          <section className="assignments-status-grid" aria-label="สรุปสถานะการมอบหมายในหน้าปัจจุบัน">
            <button type="button" className={`assignment-status-card tone-all${!filters.status ? ' is-active' : ''}`} onClick={() => updateFilter('status', '')}>
              <span><History size={19} /></span><div><small>ผลลัพธ์ทั้งหมด</small><strong>{meta.totalItems.toLocaleString('th-TH')}</strong><em>ทุกสถานะ</em></div>
            </button>
            {Object.entries(STATUS_META).map(([status, config]) => {
              const StatusIcon = config.icon
              return (
                <button type="button" className={`assignment-status-card tone-${config.tone}${filters.status === status ? ' is-active' : ''}`} key={status} onClick={() => updateFilter('status', status)}>
                  <span><StatusIcon size={19} /></span><div><small>{config.label}</small><strong>{statusCounts[status]}</strong><em>ในหน้าปัจจุบัน</em></div>
                </button>
              )
            })}
          </section>

          <div className="assignments-overview-grid">
            <section className="assignment-overview-card current-holders-card">
              <div className="assignment-section-heading">
                <div><span><Users size={18} /></span><div><h2>ผู้ถือครองปัจจุบัน</h2><p>รายการที่กำลังใช้งานล่าสุด</p></div></div>
                <strong>{statusCounts.ASSIGNED}</strong>
              </div>
              {currentHolders.length === 0 ? (
                <div className="assignment-panel-empty"><UserCheck size={25} /><span>ไม่มีผู้ถือครองในผลลัพธ์นี้</span></div>
              ) : (
                <div className="current-holder-list">
                  {currentHolders.map((assignment) => (
                    <article className="current-holder-item" key={assignment.id}>
                      <span className="holder-avatar">{assignmentHolderName(assignment).charAt(0).toUpperCase()}</span>
                      <div className="holder-copy"><strong>{assignmentHolderName(assignment)}</strong><span>{assignmentHolderCode(assignment)} · {assignmentHolderDepartment(assignment)} · {assignmentHolderPosition(assignment)}</span></div>
                      <time><Clock3 size={13} /> {formatDate(assignment.assignedAt)}</time>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="assignment-overview-card timeline-card">
              <div className="assignment-section-heading">
                <div><span><History size={18} /></span><div><h2>Lifecycle Timeline</h2><p>เหตุการณ์มอบหมายล่าสุด</p></div></div>
              </div>
              <ol className="assignment-timeline">
                {recentTimeline.map((assignment) => {
                  const config = STATUS_META[assignment.status] || STATUS_META.ASSIGNED
                  const TimelineIcon = config.icon
                  return (
                    <li className={`tone-${config.tone}`} key={assignment.id}>
                      <span className="timeline-marker"><TimelineIcon size={14} /></span>
                      <div><strong>{assignment.asset?.assetTag} · {statusLabel(assignment.status)}</strong><p>{assignmentHolderName(assignment)} · {assignmentHolderCode(assignment)} · {assignment.asset?.name}</p></div>
                      <time>{formatDate(assignment.returnedAt || assignment.assignedAt)}</time>
                    </li>
                  )
                })}
              </ol>
            </section>
          </div>

          <section className="assignment-history-card" aria-label="ประวัติการมอบหมาย">
            <header className="assignment-history-header">
              <div><span><History size={18} /></span><div><h2>ประวัติการมอบหมาย</h2><p>แสดง {assignments.length} จาก {meta.totalItems} รายการ</p></div></div>
              {refreshing && <span className="assignment-refreshing"><RefreshCw size={15} /> กำลังอัปเดต</span>}
            </header>
            <div className={`assignment-table-scroll${refreshing ? ' is-refreshing' : ''}`}>
              <table className="assignment-data-table">
                <thead><tr>
                  <th>ครุภัณฑ์</th>
                  <th>ผู้ถือครอง</th>
                  <th>มอบหมายโดย</th>
                  {SORT_COLUMNS.map((column) => <SortHeader key={column.field} {...column} sortBy={sortBy} sortOrder={sortOrder} refreshing={refreshing} onSort={toggleSort} />)}
                  <th>กำหนดคืน</th>
                  {canManage && <th>จัดการ</th>}
                </tr></thead>
                <tbody>
                  {assignments.map((assignment) => {
                    const config = STATUS_META[assignment.status] || STATUS_META.ASSIGNED
                    const StatusIcon = config.icon
                    return (
                      <tr key={assignment.id}>
                        <td><div className="assignment-asset-cell"><span><Boxes size={17} /></span><div><strong>{assignment.asset?.assetTag}</strong><small>{assignment.asset?.name}</small></div></div></td>
                        <td><div className="assignment-holder-cell"><span>{assignmentHolderName(assignment).charAt(0).toUpperCase()}</span><div><strong>{assignmentHolderName(assignment)}</strong><small>{assignmentHolderCode(assignment)} · {assignmentHolderDepartment(assignment)} · {assignmentHolderPosition(assignment)} · {assignment.status === 'ASSIGNED' ? 'ผู้ถือครองปัจจุบัน' : 'ผู้ถือครองในอดีต'}</small></div></div></td>
                        <td>{assignment.assignedBy?.name || assignment.assignedBy?.email}</td>
                        <td>{formatDate(assignment.assignedAt)}</td>
                        <td>{assignment.returnedAt ? formatDate(assignment.returnedAt) : <span className="assignment-muted">—</span>}</td>
                        <td><span className="assignment-status-stack"><span className={`assignment-status-badge tone-${config.tone}`}><StatusIcon size={13} />{statusLabel(assignment.status)}</span><ReturnWorkflowBadge status={assignment.returnStatus} /></span></td>
                        <td>{assignment.expectedReturnDate ? formatDate(assignment.expectedReturnDate) : <span className="assignment-muted">ไม่ระบุ</span>}</td>
                        {canManage && <td className="assignment-row-actions">{assignment.status === 'ASSIGNED' ? <><button type="button" onClick={() => openEdit(assignment)} title="แก้ไข" aria-label={`แก้ไข ${assignment.asset?.assetTag}`}><Edit3 size={16} /></button><button type="button" className="return-action" onClick={() => setReturnTarget(assignment)} title={assignment.returnStatus === 'PENDING_INSPECTION' ? 'ตรวจรับคืน' : 'เริ่มรับคืน'} aria-label={`${assignment.returnStatus === 'PENDING_INSPECTION' ? 'ตรวจรับคืน' : 'เริ่มรับคืน'} ${assignment.asset?.assetTag}`}><Undo2 size={16} /></button></> : assignment.returnEvents?.length ? <button type="button" onClick={() => setReturnTarget(assignment)} title="ดูประวัติรับคืน" aria-label={`ดูประวัติรับคืน ${assignment.asset?.assetTag}`}><Eye size={16} /></button> : <span>—</span>}</td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <footer className="assignment-pagination">
              <span>หน้า <strong>{meta.page}</strong> จาก <strong>{meta.totalPages}</strong> · ทั้งหมด {meta.totalItems} รายการ</span>
              <nav aria-label="แบ่งหน้าประวัติการมอบหมาย">
                <button type="button" disabled={refreshing || meta.page <= 1} onClick={() => setPage((current) => current - 1)} aria-label="หน้าก่อนหน้า"><ChevronLeft size={17} /></button>
                {paginationPages.map((pageNumber, index) => <span className={`assignment-page-wrap${pageNumber === meta.page ? ' is-current-wrap' : ''}`} key={pageNumber}>{index > 0 && pageNumber - paginationPages[index - 1] > 1 && <i>…</i>}<button type="button" className={pageNumber === meta.page ? 'is-current' : ''} onClick={() => setPage(pageNumber)} aria-current={pageNumber === meta.page ? 'page' : undefined}>{pageNumber}</button></span>)}
                <button type="button" disabled={refreshing || meta.page >= meta.totalPages} onClick={() => setPage((current) => current + 1)} aria-label="หน้าถัดไป"><ChevronRight size={17} /></button>
              </nav>
            </footer>
          </section>
        </>
      )}

      {formOpen && <AssignmentForm assignment={editingAssignment} onSubmit={handleSubmit} onCancel={() => { setFormOpen(false); setEditingAssignment(null) }} />}
      {returnTarget && <ReturnAssignmentForm assignment={returnTarget} operator={user} onStart={handleReturnStart} onInspect={handleReturnInspection} onCancel={() => setReturnTarget(null)} />}
    </div>
  )
}

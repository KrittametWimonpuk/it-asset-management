// ---------------------------------------------------------------------------
// หน้า Helpdesk — list + search + filter + sort + pagination + แจ้งปัญหาใหม่ + แก้ไข/มอบหมาย +
// แก้ไขสำเร็จ + ปิดงาน — Milestone 7: Helpdesk & Maintenance
//
// ทุก role แจ้งปัญหาได้ (รวม EMPLOYEE) แต่แก้ไข/มอบหมาย/แก้ไขสำเร็จ/ปิดงานได้เฉพาะ ADMIN/IT_STAFF
// EMPLOYEE เห็นเฉพาะตั๋วที่ตัวเองแจ้ง — backend คืนเฉพาะรายการที่ตัวเองแจ้งมาให้แล้ว (ดู routes/tickets.js: scopeForRead)
// ---------------------------------------------------------------------------
import { useState, useEffect } from 'react'
import { api } from '../api.js'
import TicketForm, { TICKET_STATUS_OPTIONS, TICKET_PRIORITY_OPTIONS, TICKET_CATEGORY_OPTIONS } from '../components/TicketForm.jsx'
import ResolveTicketForm from '../components/ResolveTicketForm.jsx'
import CloseTicketForm from '../components/CloseTicketForm.jsx'
import { formatDate } from '../utils/format.js'

const PAGE_SIZE = 20

const SORT_COLUMNS = [
  { field: 'ticketNumber', label: 'เลขที่ใบแจ้ง' },
  { field: 'priority', label: 'ความสำคัญ' },
  { field: 'status', label: 'สถานะ' },
  { field: 'openedAt', label: 'วันที่แจ้ง' },
]

const EMPTY_FILTERS = { priority: '', status: '', category: '', assignedToId: '', reportedById: '', assetId: '' }

// ตั๋วที่แก้ไข/มอบหมายได้ผ่านฟอร์มทั่วไป — ต้องตรงกับ PUT_EDITABLE_STATUSES ฝั่ง backend (utils/ticketHelpers.js)
const EDITABLE_STATUSES = ['OPEN', 'IN_PROGRESS', 'ON_HOLD']

function priorityLabel(priority) {
  return TICKET_PRIORITY_OPTIONS.find((p) => p.value === priority)?.label || priority
}
function statusLabel(status) {
  return TICKET_STATUS_OPTIONS.find((s) => s.value === status)?.label || status
}
function categoryLabel(category) {
  return TICKET_CATEGORY_OPTIONS.find((c) => c.value === category)?.label || category
}

// initialAssetId — Milestone 7: มาจาก Assets.jsx ปุ่ม "ดูใบแจ้งซ่อม" (กรองมาเฉพาะ asset นั้นตั้งแต่เปิดหน้า)
// (เหมือนแพทเทิร์นเดียวกับ initialAssetId ของ Assignments.jsx ใน Milestone 5)
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

  const [formOpen, setFormOpen] = useState(false)
  const [editingTicket, setEditingTicket] = useState(null)
  const [resolveTarget, setResolveTarget] = useState(null)
  const [closeTarget, setCloseTarget] = useState(null)

  // ตัวเลือกของตัวกรอง Asset/ผู้แจ้ง/ผู้ดูแล — โหลดครั้งเดียว (ผู้แจ้ง/ผู้ดูแล เฉพาะ canManage เท่านั้นที่ใช้)
  const [assetOptions, setAssetOptions] = useState(null)
  const [userOptions, setUserOptions] = useState(null)

  useEffect(() => {
    let cancelled = false
    const requests = [api.listAssets({ pageSize: 100, sortBy: 'assetTag', sortOrder: 'asc' })]
    if (canManage) requests.push(api.users.list({ pageSize: 100, sortBy: 'name', sortOrder: 'asc' }))
    Promise.all(requests)
      .then(([assetsRes, usersRes]) => {
        if (cancelled) return
        setAssetOptions(assetsRes.items)
        if (usersRes) setUserOptions(usersRes.items)
      })
      .catch(() => {}) // ตัวเลือกตัวกรองโหลดไม่สำเร็จไม่ critical — ยังกรองด้วย search/สถานะได้ตามปกติ
    return () => { cancelled = true }
  }, [canManage])

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => { setPage(1) }, [search, sortBy, sortOrder, filters])
  useEffect(() => { load() }, [page, sortBy, sortOrder, search, filters])

  async function load() {
    setRefreshing(true)
    try {
      const res = await api.tickets.list({ page, pageSize: PAGE_SIZE, sortBy, sortOrder, search, ...filters })
      setTickets(res.items)
      setMeta(res)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  function updateFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }))
  }

  function resetFilters() {
    setSearchInput('')
    setSearch('')
    setFilters(EMPTY_FILTERS)
  }

  function toggleSort(field) {
    if (refreshing) return
    if (sortBy === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  function openCreate() {
    setEditingTicket(null)
    setFormOpen(true)
  }

  function openEdit(ticket) {
    setEditingTicket(ticket)
    setFormOpen(true)
  }

  async function handleSubmit(payload) {
    if (editingTicket) {
      await api.tickets.update(editingTicket.id, payload)
    } else {
      await api.tickets.add(payload)
    }
    setFormOpen(false)
    setEditingTicket(null)
    load()
  }

  async function handleResolve(payload) {
    await api.tickets.resolve(resolveTarget.id, payload)
    setResolveTarget(null)
    load()
  }

  async function handleClose(payload) {
    await api.tickets.close(closeTarget.id, payload)
    setCloseTarget(null)
    load()
  }

  const hasSearch = search.length > 0
  const hasActiveFilters = hasSearch || Object.values(filters).some(Boolean)
  const isEmpty = !loading && tickets.length === 0

  return (
    <div>
      <div className="between">
        <h2 className="section-title">Helpdesk — ใบแจ้งซ่อม/ปัญหาครุภัณฑ์</h2>
      </div>

      <div className="filter-bar mt">
        <div className="filter-field">
          <label htmlFor="ticket-search">ค้นหา</label>
          <input
            id="ticket-search"
            type="text"
            className="search-input"
            placeholder="ค้นหาเลขที่ใบแจ้ง, หัวข้อ, Asset Tag, ชื่อครุภัณฑ์, ชื่อผู้แจ้ง, ผู้ดูแล..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="ticket-filter-priority">ความสำคัญ</label>
          <select id="ticket-filter-priority" value={filters.priority} onChange={(e) => updateFilter('priority', e.target.value)}>
            <option value="">ทั้งหมด</option>
            {TICKET_PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="ticket-filter-status">สถานะ</label>
          <select id="ticket-filter-status" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
            <option value="">ทั้งหมด</option>
            {TICKET_STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="ticket-filter-category">หมวดหมู่</label>
          <select id="ticket-filter-category" value={filters.category} onChange={(e) => updateFilter('category', e.target.value)}>
            <option value="">ทั้งหมด</option>
            {TICKET_CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="ticket-filter-asset">ครุภัณฑ์</label>
          <select
            id="ticket-filter-asset"
            value={filters.assetId}
            onChange={(e) => updateFilter('assetId', e.target.value)}
            disabled={!assetOptions}
          >
            <option value="">ทั้งหมด</option>
            {assetOptions?.map((a) => (
              <option key={a.id} value={a.id}>{a.assetTag} — {a.name}</option>
            ))}
          </select>
        </div>

        {canManage && (
          <>
            <div className="filter-field">
              <label htmlFor="ticket-filter-assignee">ผู้ดูแล</label>
              <select
                id="ticket-filter-assignee"
                value={filters.assignedToId}
                onChange={(e) => updateFilter('assignedToId', e.target.value)}
                disabled={!userOptions}
              >
                <option value="">ทั้งหมด</option>
                {userOptions?.filter((u) => u.role !== 'EMPLOYEE').map((u) => (
                  <option key={u.id} value={u.id}>{u.name || u.email}</option>
                ))}
              </select>
            </div>
            <div className="filter-field">
              <label htmlFor="ticket-filter-reporter">ผู้แจ้ง</label>
              <select
                id="ticket-filter-reporter"
                value={filters.reportedById}
                onChange={(e) => updateFilter('reportedById', e.target.value)}
                disabled={!userOptions}
              >
                <option value="">ทั้งหมด</option>
                {userOptions?.map((u) => (
                  <option key={u.id} value={u.id}>{u.name || u.email}</option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="filter-actions">
          <button type="button" className="secondary" onClick={resetFilters}>รีเซ็ตตัวกรอง</button>
          <button type="button" onClick={openCreate}>+ แจ้งปัญหาใหม่</button>
        </div>
      </div>

      {!loading && <p className="muted mt">แสดง {tickets.length} จาก {meta.totalItems} รายการ</p>}

      {error && <p className="error mt">{error}</p>}

      {loading ? (
        <p className="muted mt">กำลังโหลด...</p>
      ) : isEmpty ? (
        hasActiveFilters ? (
          <div className="empty-state mt">
            <h3>ไม่พบผลลัพธ์</h3>
            <p className="muted">ไม่พบใบแจ้งซ่อมที่ตรงกับตัวกรอง ลองเปลี่ยนคำค้นหาหรือรีเซ็ตตัวกรอง</p>
            <button className="secondary" onClick={resetFilters}>รีเซ็ตตัวกรอง</button>
          </div>
        ) : (
          <div className="empty-state mt">
            <h3>ยังไม่มีใบแจ้งซ่อม</h3>
            <p className="muted">เริ่มต้นแจ้งปัญหาครุภัณฑ์รายการแรก</p>
            <button onClick={openCreate}>+ แจ้งปัญหาใหม่</button>
          </div>
        )
      ) : (
        <>
          <div className={`table-wrap mt${refreshing ? ' is-refreshing' : ''}`}>
            <table>
              <thead>
                <tr>
                  {SORT_COLUMNS.map((col) => (
                    <th key={col.field} className="sortable" onClick={() => toggleSort(col.field)}>
                      {col.label}
                      {sortBy === col.field && <span className="sort-arrow">{sortOrder === 'asc' ? ' ▲' : ' ▼'}</span>}
                    </th>
                  ))}
                  <th>หัวข้อ</th>
                  <th>ครุภัณฑ์</th>
                  <th>หมวดหมู่</th>
                  <th>ผู้แจ้ง</th>
                  <th>ผู้ดูแล</th>
                  {canManage && <th>จัดการ</th>}
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td>{t.ticketNumber}</td>
                    <td><span className={`badge badge-priority-${t.priority.toLowerCase()}`}>{priorityLabel(t.priority)}</span></td>
                    <td><span className={`badge badge-ticket-${t.status.toLowerCase()}`}>{statusLabel(t.status)}</span></td>
                    <td>{formatDate(t.openedAt)}</td>
                    <td>{t.title}</td>
                    <td>{t.asset?.assetTag} — {t.asset?.name}</td>
                    <td>{categoryLabel(t.category)}</td>
                    <td>{t.reportedBy?.name || t.reportedBy?.email}</td>
                    <td>{t.assignedTo ? (t.assignedTo.name || t.assignedTo.email) : 'ยังไม่มอบหมาย'}</td>
                    {canManage && (
                      <td>
                        <div className="row">
                          {EDITABLE_STATUSES.includes(t.status) && (
                            <button className="link" onClick={() => openEdit(t)}>แก้ไข/มอบหมาย</button>
                          )}
                          {t.status === 'IN_PROGRESS' && (
                            <button className="link" onClick={() => setResolveTarget(t)}>แก้ไขสำเร็จ</button>
                          )}
                          {t.status === 'RESOLVED' && (
                            <button className="link" onClick={() => setCloseTarget(t)}>ปิดงาน</button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row between mt">
            <span className="muted">
              หน้า {meta.page} จาก {meta.totalPages} • ทั้งหมด {meta.totalItems} รายการ
              {refreshing && ' • กำลังโหลด...'}
            </span>
            <div className="row">
              <button
                className="secondary"
                disabled={refreshing || meta.page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ก่อนหน้า
              </button>
              <button
                className="secondary"
                disabled={refreshing || meta.page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                ถัดไป
              </button>
            </div>
          </div>
        </>
      )}

      {formOpen && (
        <TicketForm
          ticket={editingTicket}
          onSubmit={handleSubmit}
          onCancel={() => { setFormOpen(false); setEditingTicket(null) }}
        />
      )}

      {resolveTarget && (
        <ResolveTicketForm
          ticket={resolveTarget}
          onSubmit={handleResolve}
          onCancel={() => setResolveTarget(null)}
        />
      )}

      {closeTarget && (
        <CloseTicketForm
          ticket={closeTarget}
          onSubmit={handleClose}
          onCancel={() => setCloseTarget(null)}
        />
      )}
    </div>
  )
}

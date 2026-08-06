// ---------------------------------------------------------------------------
// หน้าการมอบหมายครุภัณฑ์ — list + search + filter + sort + pagination + มอบหมายใหม่ + แก้ไข + รับคืน
// Milestone 5: Asset Assignment & Lifecycle
//
// ADMIN/IT_STAFF จัดการได้เต็มที่ (มอบหมาย/แก้ไข/รับคืน) ส่วน EMPLOYEE ดูได้อย่างเดียว และ
// backend คืนเฉพาะรายการที่ตัวเองเป็นผู้ถือครองมาให้แล้ว (ดู routes/assignments.js: scopeForRead)
// ---------------------------------------------------------------------------
import { useState, useEffect } from 'react'
import { api } from '../api.js'
import AssignmentForm from '../components/AssignmentForm.jsx'
import ReturnAssignmentForm, { ASSIGNMENT_STATUS_OPTIONS } from '../components/ReturnAssignmentForm.jsx'
import { formatDate } from '../utils/format.js'

const PAGE_SIZE = 20

const SORT_COLUMNS = [
  { field: 'assignedAt', label: 'วันที่มอบหมาย' },
  { field: 'returnedAt', label: 'วันที่คืน' },
  { field: 'status', label: 'สถานะ' },
]

const EMPTY_FILTERS = { status: '', assetId: '', userId: '' }

function statusLabel(status) {
  return ASSIGNMENT_STATUS_OPTIONS.find((s) => s.value === status)?.label || status
}

// initialAssetId — Milestone 5: มาจาก Assets.jsx "ดูประวัติ" (กรองมาเฉพาะ asset นั้นตั้งแต่เปิดหน้า)
export default function Assignments({ role, initialAssetId }) {
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

  // ตัวเลือกของตัวกรอง Asset/Current Holder — โหลดครั้งเดียว (Current Holder เฉพาะ canManage เท่านั้นที่ใช้)
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
      const res = await api.assignments.list({ page, pageSize: PAGE_SIZE, sortBy, sortOrder, search, ...filters })
      setAssignments(res.items)
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
    setEditingAssignment(null)
    setFormOpen(true)
  }

  function openEdit(assignment) {
    setEditingAssignment(assignment)
    setFormOpen(true)
  }

  async function handleSubmit(payload) {
    if (editingAssignment) {
      await api.assignments.update(editingAssignment.id, payload)
    } else {
      await api.assignments.add(payload)
    }
    setFormOpen(false)
    setEditingAssignment(null)
    load()
  }

  async function handleReturn(payload) {
    await api.assignments.return(returnTarget.id, payload)
    setReturnTarget(null)
    load()
  }

  const hasSearch = search.length > 0
  const hasActiveFilters = hasSearch || Object.values(filters).some(Boolean)
  const isEmpty = !loading && assignments.length === 0

  return (
    <div>
      <div className="between">
        <h2 className="section-title">การมอบหมายครุภัณฑ์</h2>
      </div>

      <div className="filter-bar mt">
        <div className="filter-field">
          <label htmlFor="assignment-search">ค้นหา</label>
          <input
            id="assignment-search"
            type="text"
            className="search-input"
            placeholder="ค้นหา Asset Tag, ชื่อครุภัณฑ์, ชื่อพนักงาน, Hostname, Serial Number..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="assignment-filter-status">สถานะ</label>
          <select id="assignment-filter-status" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
            <option value="">ทั้งหมด</option>
            {ASSIGNMENT_STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="assignment-filter-asset">ครุภัณฑ์</label>
          <select
            id="assignment-filter-asset"
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
          <div className="filter-field">
            <label htmlFor="assignment-filter-holder">ผู้ถือครอง</label>
            <select
              id="assignment-filter-holder"
              value={filters.userId}
              onChange={(e) => updateFilter('userId', e.target.value)}
              disabled={!userOptions}
            >
              <option value="">ทั้งหมด</option>
              {userOptions?.map((u) => (
                <option key={u.id} value={u.id}>{u.name || u.email}</option>
              ))}
            </select>
          </div>
        )}

        <div className="filter-actions">
          <button type="button" className="secondary" onClick={resetFilters}>รีเซ็ตตัวกรอง</button>
          {canManage && <button type="button" onClick={openCreate}>+ มอบหมายครุภัณฑ์ใหม่</button>}
        </div>
      </div>

      {!loading && <p className="muted mt">แสดง {assignments.length} จาก {meta.totalItems} รายการ</p>}

      {error && <p className="error mt">{error}</p>}

      {loading ? (
        <p className="muted mt">กำลังโหลด...</p>
      ) : isEmpty ? (
        hasActiveFilters ? (
          <div className="empty-state mt">
            <h3>ไม่พบผลลัพธ์</h3>
            <p className="muted">ไม่พบรายการมอบหมายที่ตรงกับตัวกรอง ลองเปลี่ยนคำค้นหาหรือรีเซ็ตตัวกรอง</p>
            <button className="secondary" onClick={resetFilters}>รีเซ็ตตัวกรอง</button>
          </div>
        ) : (
          <div className="empty-state mt">
            <h3>ยังไม่มีรายการมอบหมาย</h3>
            <p className="muted">
              {canManage ? 'เริ่มต้นมอบหมายครุภัณฑ์ให้พนักงานถือครอง' : 'ยังไม่มีครุภัณฑ์ที่มอบหมายให้คุณ'}
            </p>
            {canManage && <button onClick={openCreate}>+ มอบหมายครุภัณฑ์ใหม่</button>}
          </div>
        )
      ) : (
        <>
          <div className={`table-wrap mt${refreshing ? ' is-refreshing' : ''}`}>
            <table>
              <thead>
                <tr>
                  <th>Asset Tag</th>
                  <th>ครุภัณฑ์</th>
                  <th>ผู้ถือครอง</th>
                  <th>มอบหมายโดย</th>
                  {SORT_COLUMNS.map((col) => (
                    <th key={col.field} className="sortable" onClick={() => toggleSort(col.field)}>
                      {col.label}
                      {sortBy === col.field && <span className="sort-arrow">{sortOrder === 'asc' ? ' ▲' : ' ▼'}</span>}
                    </th>
                  ))}
                  <th>วันที่คาดว่าจะคืน</th>
                  {canManage && <th>จัดการ</th>}
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td>{a.asset?.assetTag}</td>
                    <td>{a.asset?.name}</td>
                    <td>{a.user?.name || a.user?.email}</td>
                    <td>{a.assignedBy?.name || a.assignedBy?.email}</td>
                    <td>{formatDate(a.assignedAt)}</td>
                    <td>{a.returnedAt ? formatDate(a.returnedAt) : '-'}</td>
                    <td><span className={`badge badge-${a.status.toLowerCase()}`}>{statusLabel(a.status)}</span></td>
                    <td>{a.expectedReturnDate ? formatDate(a.expectedReturnDate) : '-'}</td>
                    {canManage && (
                      <td>
                        <div className="row">
                          {a.status === 'ASSIGNED' && (
                            <>
                              <button className="link" onClick={() => openEdit(a)}>แก้ไข</button>
                              <button className="link" onClick={() => setReturnTarget(a)}>รับคืน</button>
                            </>
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
        <AssignmentForm
          assignment={editingAssignment}
          onSubmit={handleSubmit}
          onCancel={() => { setFormOpen(false); setEditingAssignment(null) }}
        />
      )}

      {returnTarget && (
        <ReturnAssignmentForm
          assignment={returnTarget}
          onSubmit={handleReturn}
          onCancel={() => setReturnTarget(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// หน้า Audit Log — Milestone 9: ประวัติการกระทำสำคัญทางธุรกิจทั้งระบบ
//
// เฉพาะ ADMIN/IT_STAFF เข้าได้ (backend คืน 403 ให้ EMPLOYEE — ไม่ต้องเช็ก role ซ้ำที่นี่ เพราะ App.jsx
// ซ่อนแท็บนี้ไปเลยสำหรับ EMPLOYEE อยู่แล้ว เหมือนแพทเทิร์นเดียวกับ MasterDataPage)
// อ่านอย่างเดียว — ไม่มีปุ่มแก้ไข/ลบ เพราะ audit log เป็นประวัติที่แก้ไข/ลบไม่ได้ (immutable)
// เรียงตามเวลาล่าสุดก่อนเสมอ (performedAt desc) — ไม่มี sort ให้เลือกเหมือนหน้าอื่น (ตาม spec)
// ---------------------------------------------------------------------------
import { useState, useEffect } from 'react'
import { api } from '../api.js'
import AuditLogDetail from '../components/AuditLogDetail.jsx'
import { formatDateTime } from '../utils/format.js'
import { ACTION_LABELS, ENTITY_TYPE_LABELS } from '../utils/auditLabels.js'

const PAGE_SIZE = 20

const ACTION_OPTIONS = Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))
const ENTITY_TYPE_OPTIONS = Object.entries(ENTITY_TYPE_LABELS).map(([value, label]) => ({ value, label }))

const EMPTY_FILTERS = { action: '', entityType: '', performedBy: '', dateFrom: '', dateTo: '' }

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

  const [userOptions, setUserOptions] = useState(null)
  const [detailLog, setDetailLog] = useState(null)

  // รายชื่อผู้ใช้ไว้ใช้เป็นตัวกรอง "ผู้ทำรายการ" — โหลดครั้งเดียว
  useEffect(() => {
    let cancelled = false
    api.users.list({ pageSize: 100, sortBy: 'name', sortOrder: 'asc' })
      .then((res) => { if (!cancelled) setUserOptions(res.items) })
      .catch(() => {}) // ตัวกรองโหลดไม่สำเร็จไม่ critical — ยังกรองด้วยตัวอื่นได้ตามปกติ
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => { setPage(1) }, [search, filters])
  useEffect(() => { load() }, [page, search, filters])

  async function load() {
    setRefreshing(true)
    try {
      const res = await api.audit.list({ page, pageSize: PAGE_SIZE, search, ...filters })
      setLogs(res.items)
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

  const hasSearch = search.length > 0
  const hasActiveFilters = hasSearch || Object.values(filters).some(Boolean)
  const isEmpty = !loading && logs.length === 0

  return (
    <div>
      <div className="between">
        <h2 className="section-title">Audit Log — ประวัติการทำรายการ</h2>
      </div>

      <div className="filter-bar mt">
        <div className="filter-field">
          <label htmlFor="audit-search">ค้นหา</label>
          <input
            id="audit-search"
            type="text"
            className="search-input"
            placeholder="ค้นหาในคำอธิบาย, entity id..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="audit-filter-action">การกระทำ</label>
          <select id="audit-filter-action" value={filters.action} onChange={(e) => updateFilter('action', e.target.value)}>
            <option value="">ทั้งหมด</option>
            {ACTION_OPTIONS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="audit-filter-entity">ประเภท</label>
          <select id="audit-filter-entity" value={filters.entityType} onChange={(e) => updateFilter('entityType', e.target.value)}>
            <option value="">ทั้งหมด</option>
            {ENTITY_TYPE_OPTIONS.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="audit-filter-user">ผู้ทำรายการ</label>
          <select
            id="audit-filter-user"
            value={filters.performedBy}
            onChange={(e) => updateFilter('performedBy', e.target.value)}
            disabled={!userOptions}
          >
            <option value="">ทั้งหมด</option>
            {userOptions?.map((u) => (
              <option key={u.id} value={u.id}>{u.name || u.email}</option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="audit-filter-from">ตั้งแต่วันที่</label>
          <input
            id="audit-filter-from"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => updateFilter('dateFrom', e.target.value)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="audit-filter-to">ถึงวันที่</label>
          <input
            id="audit-filter-to"
            type="date"
            value={filters.dateTo}
            onChange={(e) => updateFilter('dateTo', e.target.value)}
          />
        </div>

        <div className="filter-actions">
          <button type="button" className="secondary" onClick={resetFilters}>รีเซ็ตตัวกรอง</button>
        </div>
      </div>

      {!loading && <p className="muted mt">แสดง {logs.length} จาก {meta.totalItems} รายการ</p>}

      {error && <p className="error mt">{error}</p>}

      {loading ? (
        <p className="muted mt">กำลังโหลด...</p>
      ) : isEmpty ? (
        hasActiveFilters ? (
          <div className="empty-state mt">
            <h3>ไม่พบผลลัพธ์</h3>
            <p className="muted">ไม่พบ audit log ที่ตรงกับตัวกรอง ลองเปลี่ยนคำค้นหาหรือรีเซ็ตตัวกรอง</p>
            <button className="secondary" onClick={resetFilters}>รีเซ็ตตัวกรอง</button>
          </div>
        ) : (
          <div className="empty-state mt">
            <h3>ยังไม่มี audit log</h3>
            <p className="muted">ประวัติการทำรายการจะปรากฏที่นี่เมื่อมีการสร้าง/แก้ไข/ลบข้อมูลในระบบ</p>
          </div>
        )
      ) : (
        <>
          <div className={`table-wrap mt${refreshing ? ' is-refreshing' : ''}`}>
            <table>
              <thead>
                <tr>
                  <th>เวลา</th>
                  <th>ผู้ทำรายการ</th>
                  <th>การกระทำ</th>
                  <th>ประเภท</th>
                  <th>รายละเอียด</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.performedAt)}</td>
                    <td>{log.performedBy ? (log.performedBy.name || log.performedBy.email) : 'ระบบ/ไม่ทราบ'}</td>
                    <td><span className={`badge badge-audit-${log.action.toLowerCase().replace(/_/g, '-')}`}>{ACTION_LABELS[log.action] || log.action}</span></td>
                    <td>{ENTITY_TYPE_LABELS[log.entityType] || log.entityType}</td>
                    <td>{log.description || '-'}</td>
                    <td><button className="link" onClick={() => setDetailLog(log)}>ดูรายละเอียด</button></td>
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

      {detailLog && <AuditLogDetail log={detailLog} onClose={() => setDetailLog(null)} />}
    </div>
  )
}

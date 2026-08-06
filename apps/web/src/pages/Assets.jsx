// หน้ารายการครุภัณฑ์ IT — list + search + filter + sort + pagination + create + edit + delete
// (header/logout ย้ายไปอยู่ที่ App.jsx แล้ว เพราะใช้ shell ร่วมกับแท็บ master data)
import { useState, useEffect } from 'react'
import { api } from '../api.js'
import AssetForm, { STATUS_OPTIONS, CONDITION_OPTIONS } from '../components/AssetForm.jsx'
import AssetFilterBar from '../components/AssetFilterBar.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { useMasterDataOptions } from '../hooks/useMasterDataOptions.js'
import { formatDate } from '../utils/format.js'
import { ASSIGNMENT_STATUS_OPTIONS } from '../components/ReturnAssignmentForm.jsx'

const PAGE_SIZE = 20

// คอลัมน์ที่กดหัวตารางเพื่อเรียงลำดับได้ (ต้องตรงกับ SORTABLE_FIELDS ฝั่ง backend)
const SORT_COLUMNS = [
  { field: 'assetTag', label: 'Asset Tag' },
  { field: 'name', label: 'ชื่ออุปกรณ์' },
  { field: 'status', label: 'สถานะ' },
  { field: 'createdAt', label: 'วันที่สร้าง' },
]

const WARRANTY_WARNING_DAYS = 30

// ---- Milestone 4.1: ตัวกรองว่าง = ไม่กรอง (ใช้ทั้งสร้าง state เริ่มต้นและตอน reset) ----
const EMPTY_FILTERS = { categoryId: '', status: '', locationId: '', departmentId: '', vendorId: '' }

// ---- Milestone 4.1: คอลัมน์ที่ผู้ใช้เลือกซ่อน/แสดงได้ — จำค่าไว้ใน localStorage ----
// ตั้งแต่ Milestone 5: เพิ่มคอลัมน์เกี่ยวกับการมอบหมาย (มาจาก asset.currentAssignment/assignmentHistoryCount)
// ตั้งแต่ Milestone 7: เพิ่มคอลัมน์เกี่ยวกับใบแจ้งซ่อม (มาจาก asset.openTicketsCount/ticketHistoryCount)
const OPTIONAL_COLUMNS = [
  { key: 'brand', label: 'ยี่ห้อ' },
  { key: 'model', label: 'รุ่น' },
  { key: 'hostname', label: 'Hostname' },
  { key: 'ipAddress', label: 'IP Address' },
  { key: 'warrantyExpiry', label: 'วันหมดประกัน' },
  { key: 'currentHolder', label: 'ผู้ถือครองปัจจุบัน' },
  { key: 'assignmentStatus', label: 'สถานะการมอบหมาย' },
  { key: 'assignedDate', label: 'วันที่มอบหมาย' },
  { key: 'expectedReturn', label: 'วันที่คาดว่าจะคืน' },
  { key: 'historyCount', label: 'จำนวนประวัติ' },
  { key: 'openTickets', label: 'ใบแจ้งซ่อมที่เปิดอยู่' },
  { key: 'ticketHistory', label: 'จำนวนใบแจ้งซ่อมทั้งหมด' },
]
const COLUMNS_STORAGE_KEY = 'assetVisibleColumns'

function defaultColumnPrefs() {
  return Object.fromEntries(OPTIONAL_COLUMNS.map((c) => [c.key, true]))
}

// อ่านค่าที่จำไว้จาก localStorage — ถ้าไม่มี/parse ไม่ได้/โครงสร้างไม่ตรง (เช่นเวอร์ชันเก่า) ใช้ค่า default แทน
function loadColumnPrefs() {
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return OPTIONAL_COLUMNS.every((c) => typeof parsed[c.key] === 'boolean') ? parsed : null
  } catch {
    return null
  }
}

function statusLabel(status) {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label || status
}

function conditionLabel(condition) {
  return CONDITION_OPTIONS.find((c) => c.value === condition)?.label || '-'
}

function assignmentStatusLabel(status) {
  return ASSIGNMENT_STATUS_OPTIONS.find((s) => s.value === status)?.label || status
}

// สถานะประกัน: หมดแล้ว / ใกล้หมดภายใน 30 วัน / ยังไม่ใกล้หมด (คืน null ถ้าไม่ต้องโชว์ badge)
function warrantyBadge(warrantyExpiry) {
  if (!warrantyExpiry) return null
  const diffDays = Math.ceil((new Date(warrantyExpiry) - new Date()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { label: 'หมดประกัน', className: 'badge-warranty-expired' }
  if (diffDays <= WARRANTY_WARNING_DAYS) return { label: 'ใกล้หมดประกัน', className: 'badge-warranty-soon' }
  return null
}

// role: ADMIN/IT_STAFF จัดการ asset ได้เต็มที่ (เพิ่ม/แก้/ลบ ของใครก็ได้)
// EMPLOYEE เห็นได้อย่างเดียว (backend คืนเฉพาะ asset ของตัวเองมาให้แล้ว) — Milestone 4
// onNavigateToMaster(tabKey) — ให้ AssetForm พาไปหน้า master data ที่เกี่ยวข้องได้ เมื่อ dropdown ว่าง
// onViewHistory(assetId) — Milestone 5: พาไปแท็บ "การมอบหมาย" กรองเฉพาะ asset นี้ (ทุก role ดูได้)
// onViewTickets(assetId) — Milestone 7: พาไปแท็บ "Helpdesk" กรองเฉพาะ asset นี้ (ทุก role ดูได้)
export default function Assets({ role, onNavigateToMaster, onViewHistory, onViewTickets }) {
  const canManage = role === 'ADMIN' || role === 'IT_STAFF'
  const [assets, setAssets] = useState([])
  const [meta, setMeta] = useState({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 })
  const [error, setError] = useState('')

  const [loading, setLoading] = useState(true)       // true เฉพาะตอนโหลดครั้งแรก (ยังไม่เคยมีข้อมูล)
  const [refreshing, setRefreshing] = useState(false) // true ทุกครั้งที่ยิง request ใหม่ (โหลดหน้าอื่น/ค้นหา/เรียง)

  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [searchInput, setSearchInput] = useState('')  // ค่าที่พิมพ์ในกล่องค้นหาสด ๆ
  const [search, setSearch] = useState('')            // ค่าที่ debounce แล้ว ใช้ยิง request จริง
  const [filters, setFilters] = useState(EMPTY_FILTERS) // Milestone 4.1: categoryId/status/locationId/departmentId/vendorId

  const [formOpen, setFormOpen] = useState(false)     // เปิดฟอร์ม เพิ่ม/แก้ไข
  const [editingAsset, setEditingAsset] = useState(null) // null = โหมดเพิ่มใหม่, object = โหมดแก้ไข
  const [deleteTarget, setDeleteTarget] = useState(null) // asset ที่กำลังจะลบ (รอยืนยัน)
  const [deleting, setDeleting] = useState(false)

  // Milestone 4.1: ตัวเลือก dropdown ของตัวกรอง (category/location/department/vendor) — โหลดครั้งเดียว ใช้ร่วมกับ AssetForm ได้
  const { options: filterOptions, error: filterOptionsError } = useMasterDataOptions()

  // Milestone 4.1: คอลัมน์ที่ผู้ใช้เลือกโชว์/ซ่อน — จำไว้ใน localStorage ให้คงอยู่ข้ามการรีเฟรช
  const [visibleColumns, setVisibleColumns] = useState(() => loadColumnPrefs() || defaultColumnPrefs())
  const [columnsOpen, setColumnsOpen] = useState(false)
  useEffect(() => {
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns))
  }, [visibleColumns])

  // debounce กล่องค้นหา — รอผู้ใช้หยุดพิมพ์ 400ms ก่อนค่อยยิง request จริง กันยิงถี่เกินไป
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  // เปลี่ยนคำค้นหา/ตัวกรอง/การเรียงลำดับ -> กลับไปหน้า 1 เสมอ (ผลลัพธ์ชุดใหม่ไม่ควรค้างอยู่หน้ากลาง ๆ)
  useEffect(() => {
    setPage(1)
  }, [search, sortBy, sortOrder, filters])

  // โหลดข้อมูลทุกครั้งที่หน้า/การเรียง/คำค้นหา/ตัวกรองเปลี่ยน
  useEffect(() => { load() }, [page, sortBy, sortOrder, search, filters])

  async function load() {
    setRefreshing(true)
    try {
      const res = await api.listAssets({ page, pageSize: PAGE_SIZE, sortBy, sortOrder, search, ...filters })
      setAssets(res.items)
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

  function toggleColumn(key) {
    setVisibleColumns((v) => ({ ...v, [key]: !v[key] }))
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
    setEditingAsset(null)
    setFormOpen(true)
  }

  function openEdit(asset) {
    setEditingAsset(asset)
    setFormOpen(true)
  }

  async function handleSubmit(payload) {
    if (editingAsset) {
      await api.updateAsset(editingAsset.id, payload)
    } else {
      await api.addAsset(payload)
    }
    setFormOpen(false)
    setEditingAsset(null)
    load()
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      await api.deleteAsset(deleteTarget.id)
      setDeleteTarget(null)
      // ถ้าลบรายการสุดท้ายของหน้านี้ (และไม่ใช่หน้าแรก) ให้ถอยกลับไปหน้าก่อนหน้าอัตโนมัติ
      if (assets.length === 1 && page > 1) {
        setPage((p) => p - 1)
      } else {
        load()
      }
    } catch (err) {
      setError(err.message)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const hasSearch = search.length > 0
  const hasActiveFilters = hasSearch || Object.values(filters).some(Boolean)
  const isEmpty = !loading && assets.length === 0
  const columnsForPicker = OPTIONAL_COLUMNS.map((c) => ({ ...c, visible: visibleColumns[c.key] }))

  return (
    <div>
      <div className="between">
        <h2 className="section-title">ครุภัณฑ์ทั้งหมด</h2>
      </div>

      <AssetFilterBar
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        filters={filters}
        onFilterChange={updateFilter}
        onReset={resetFilters}
        options={filterOptions}
        optionsError={filterOptionsError}
        canManage={canManage}
        onAddAsset={openCreate}
        columns={columnsForPicker}
        onToggleColumn={toggleColumn}
        columnsOpen={columnsOpen}
        onToggleColumnsPanel={() => setColumnsOpen((v) => !v)}
      />

      {!loading && <p className="muted mt">แสดง {assets.length} จาก {meta.totalItems} รายการ</p>}

      {error && <p className="error mt">{error}</p>}

      {loading ? (
        <p className="muted mt">กำลังโหลด...</p>
      ) : isEmpty ? (
        hasActiveFilters ? (
          <div className="empty-state mt">
            <h3>ไม่พบผลลัพธ์</h3>
            <p className="muted">ไม่พบครุภัณฑ์ที่ตรงกับตัวกรอง ลองเปลี่ยนคำค้นหาหรือรีเซ็ตตัวกรอง</p>
            <button className="secondary" onClick={resetFilters}>รีเซ็ตตัวกรอง</button>
          </div>
        ) : (
          <div className="empty-state mt">
            <h3>ยังไม่มีครุภัณฑ์</h3>
            <p className="muted">
              {canManage ? 'เริ่มต้นจัดการครุภัณฑ์ IT ของคุณด้วยการเพิ่มรายการแรก' : 'ยังไม่มีครุภัณฑ์ที่มอบหมายให้คุณ'}
            </p>
            {canManage && <button onClick={openCreate}>+ เพิ่มครุภัณฑ์ใหม่</button>}
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
                  <th>หมวดหมู่</th>
                  {visibleColumns.brand && <th>ยี่ห้อ</th>}
                  {visibleColumns.model && <th>รุ่น</th>}
                  {visibleColumns.hostname && <th>Hostname</th>}
                  {visibleColumns.ipAddress && <th>IP Address</th>}
                  {visibleColumns.warrantyExpiry && <th>วันหมดประกัน</th>}
                  {visibleColumns.currentHolder && <th>ผู้ถือครองปัจจุบัน</th>}
                  {visibleColumns.assignmentStatus && <th>สถานะการมอบหมาย</th>}
                  {visibleColumns.assignedDate && <th>วันที่มอบหมาย</th>}
                  {visibleColumns.expectedReturn && <th>วันที่คาดว่าจะคืน</th>}
                  {visibleColumns.historyCount && <th>จำนวนประวัติ</th>}
                  {visibleColumns.openTickets && <th>ใบแจ้งซ่อมที่เปิดอยู่</th>}
                  {visibleColumns.ticketHistory && <th>จำนวนใบแจ้งซ่อมทั้งหมด</th>}
                  <th>สภาพ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => {
                  const badge = warrantyBadge(asset.warrantyExpiry)
                  const holder = asset.currentAssignment
                  return (
                    <tr key={asset.id}>
                      <td>{asset.assetTag}</td>
                      <td>{asset.name}</td>
                      <td><span className={`badge badge-${asset.status.toLowerCase()}`}>{statusLabel(asset.status)}</span></td>
                      <td>{formatDate(asset.createdAt)}</td>
                      <td>{asset.category?.name || '-'}</td>
                      {visibleColumns.brand && <td>{asset.brand}</td>}
                      {visibleColumns.model && <td>{asset.model}</td>}
                      {visibleColumns.hostname && <td>{asset.hostname || '-'}</td>}
                      {visibleColumns.ipAddress && <td>{asset.ipAddress || '-'}</td>}
                      {visibleColumns.warrantyExpiry && (
                        <td>
                          {asset.warrantyExpiry ? formatDate(asset.warrantyExpiry) : '-'}
                          {badge && <span className={`badge ${badge.className}`}> {badge.label}</span>}
                        </td>
                      )}
                      {visibleColumns.currentHolder && <td>{holder ? (holder.user.name || holder.user.email) : 'ไม่มีผู้ถือครอง'}</td>}
                      {visibleColumns.assignmentStatus && <td>{holder ? assignmentStatusLabel(holder.status) : '-'}</td>}
                      {visibleColumns.assignedDate && <td>{holder ? formatDate(holder.assignedAt) : '-'}</td>}
                      {visibleColumns.expectedReturn && <td>{holder?.expectedReturnDate ? formatDate(holder.expectedReturnDate) : '-'}</td>}
                      {visibleColumns.historyCount && <td>{asset.assignmentHistoryCount}</td>}
                      {visibleColumns.openTickets && (
                        <td>
                          {asset.openTicketsCount > 0
                            ? <span className="badge badge-ticket-open">{asset.openTicketsCount}</span>
                            : '-'}
                        </td>
                      )}
                      {visibleColumns.ticketHistory && <td>{asset.ticketHistoryCount}</td>}
                      <td>{conditionLabel(asset.assetCondition)}</td>
                      <td>
                        <div className="row">
                          <button className="link" onClick={() => onViewHistory?.(asset.id)}>ดูประวัติ</button>
                          <button className="link" onClick={() => onViewTickets?.(asset.id)}>ดูใบแจ้งซ่อม</button>
                          {canManage && <button className="link" onClick={() => openEdit(asset)}>แก้ไข</button>}
                          {canManage && <button className="danger" onClick={() => setDeleteTarget(asset)}>ลบ</button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
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
        <AssetForm
          asset={editingAsset}
          onSubmit={handleSubmit}
          onCancel={() => { setFormOpen(false); setEditingAsset(null) }}
          onNavigateToMaster={onNavigateToMaster}
          options={filterOptions}
          optionsError={filterOptionsError}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="ลบครุภัณฑ์"
          message={
            <div className="delete-summary">
              <div className="delete-summary-tag">{deleteTarget.assetTag}</div>
              <div className="delete-summary-name">{deleteTarget.name}</div>
            </div>
          }
          note="การลบจะซ่อนครุภัณฑ์นี้ออกจากรายการ และไม่สามารถกู้คืนได้จากหน้านี้"
          confirmLabel="ลบ"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

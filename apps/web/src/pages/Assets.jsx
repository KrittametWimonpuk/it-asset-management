import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Edit3,
  History,
  Inbox,
  MoreHorizontal,
  PackageCheck,
  Plus,
  RefreshCw,
  RotateCcw,
  SearchX,
  Trash2,
  Wrench,
} from 'lucide-react'
import { api } from '../api.js'
import AssetForm, { CONDITION_OPTIONS, STATUS_OPTIONS } from '../components/AssetForm.jsx'
import AssetFilterBar from '../components/AssetFilterBar.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { useMasterDataOptions } from '../hooks/useMasterDataOptions.js'
import { formatDate } from '../utils/format.js'
import { ASSIGNMENT_STATUS_OPTIONS } from '../components/ReturnAssignmentForm.jsx'
import './Assets.css'

const PAGE_SIZE = 20
const WARRANTY_WARNING_DAYS = 30
const EMPTY_FILTERS = { categoryId: '', status: '', locationId: '', departmentId: '', vendorId: '' }
const COLUMNS_STORAGE_KEY = 'assetVisibleColumns'

const SORT_COLUMNS = [
  { field: 'assetTag', label: 'Asset Tag' },
  { field: 'name', label: 'ชื่ออุปกรณ์' },
  { field: 'status', label: 'สถานะ' },
  { field: 'createdAt', label: 'วันที่สร้าง' },
]

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

function defaultColumnPrefs() {
  return Object.fromEntries(OPTIONAL_COLUMNS.map((column) => [column.key, true]))
}

function loadColumnPrefs() {
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return OPTIONAL_COLUMNS.every((column) => typeof parsed[column.key] === 'boolean') ? parsed : null
  } catch {
    return null
  }
}

function statusLabel(status) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label || status
}

function conditionLabel(condition) {
  return CONDITION_OPTIONS.find((option) => option.value === condition)?.label || '-'
}

function assignmentStatusLabel(status) {
  return ASSIGNMENT_STATUS_OPTIONS.find((option) => option.value === status)?.label || status
}

function warrantyBadge(warrantyExpiry) {
  if (!warrantyExpiry) return null
  const diffDays = Math.ceil((new Date(warrantyExpiry) - new Date()) / 86400000)
  if (diffDays < 0) return { label: 'หมดประกัน', className: 'is-expired' }
  if (diffDays <= WARRANTY_WARNING_DAYS) return { label: 'ใกล้หมดประกัน', className: 'is-warning' }
  return null
}

function pageNumbers(current, total) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1)
  const pages = new Set([1, total, current - 1, current, current + 1])
  return [...pages].filter((value) => value > 0 && value <= total).sort((a, b) => a - b)
}

function AssetsSkeleton() {
  return (
    <div className="assets-skeleton" aria-label="กำลังโหลดรายการครุภัณฑ์" aria-busy="true">
      <div className="assets-skeleton-toolbar assets-shimmer" />
      <div className="assets-skeleton-table">
        <div className="assets-skeleton-head assets-shimmer" />
        {Array.from({ length: 7 }, (_, index) => <div className="assets-skeleton-row assets-shimmer" key={index} />)}
      </div>
    </div>
  )
}

function SortHeader({ field, label, sortBy, sortOrder, refreshing, onSort }) {
  const active = sortBy === field
  return (
    <th aria-sort={active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button className={`assets-sort-button${active ? ' is-active' : ''}`} onClick={() => onSort(field)} disabled={refreshing}>
        {label}
        {active ? (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <MoreHorizontal size={14} />}
      </button>
    </th>
  )
}

export default function Assets({ role, onNavigateToMaster, onViewHistory, onViewTickets }) {
  const canManage = role === 'ADMIN' || role === 'IT_STAFF'
  const [assets, setAssets] = useState([])
  const [meta, setMeta] = useState({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const { options: filterOptions, error: filterOptionsError } = useMasterDataOptions()
  const [visibleColumns, setVisibleColumns] = useState(() => loadColumnPrefs() || defaultColumnPrefs())
  const [columnsOpen, setColumnsOpen] = useState(false)
  const selectAllRef = useRef(null)

  useEffect(() => {
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns))
  }, [visibleColumns])

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => setPage(1), [search, sortBy, sortOrder, filters])
  useEffect(() => setSelectedIds(new Set()), [page, search, sortBy, sortOrder, filters])

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const response = await api.listAssets({ page, pageSize: PAGE_SIZE, sortBy, sortOrder, search, ...filters })
      setAssets(response.items)
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

  const selectedOnPage = assets.filter((asset) => selectedIds.has(asset.id)).length
  const allOnPageSelected = assets.length > 0 && selectedOnPage === assets.length

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = selectedOnPage > 0 && !allOnPageSelected
  }, [selectedOnPage, allOnPageSelected])

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length + (search ? 1 : 0),
    [filters, search],
  )
  const columnsForPicker = OPTIONAL_COLUMNS.map((column) => ({ ...column, visible: visibleColumns[column.key] }))
  const hasActiveFilters = activeFilterCount > 0
  const isEmpty = !loading && assets.length === 0
  const currentPages = pageNumbers(meta.page, meta.totalPages)

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function resetFilters() {
    setSearchInput('')
    setSearch('')
    setFilters(EMPTY_FILTERS)
  }

  function toggleColumn(key) {
    setVisibleColumns((current) => ({ ...current, [key]: !current[key] }))
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
    setEditingAsset(null)
    setFormOpen(true)
  }

  function openEdit(asset) {
    setEditingAsset(asset)
    setFormOpen(true)
  }

  async function handleSubmit(payload) {
    if (editingAsset) await api.updateAsset(editingAsset.id, payload)
    else await api.addAsset(payload)
    setFormOpen(false)
    setEditingAsset(null)
    load()
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      await api.deleteAsset(deleteTarget.id)
      setDeleteTarget(null)
      if (assets.length === 1 && page > 1) setPage((current) => current - 1)
      else load()
    } catch (requestError) {
      setError(requestError.message)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  async function confirmBulkDelete() {
    setDeleting(true)
    const ids = [...selectedIds]
    const results = await Promise.allSettled(ids.map((id) => api.deleteAsset(id)))
    const failed = results.filter((result) => result.status === 'rejected').length
    setSelectedIds(new Set())
    setBulkDeleteOpen(false)
    setDeleting(false)
    await load()
    if (failed) setError(`ลบสำเร็จ ${ids.length - failed} รายการ และไม่สำเร็จ ${failed} รายการ`)
  }

  function toggleAsset(assetId) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(assetId)) next.delete(assetId)
      else next.add(assetId)
      return next
    })
  }

  function togglePageSelection() {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allOnPageSelected) assets.forEach((asset) => next.delete(asset.id))
      else assets.forEach((asset) => next.add(asset.id))
      return next
    })
  }

  return (
    <div className="assets-page">
      <header className="assets-page-header">
        <div>
          <span className="assets-eyebrow"><Boxes size={15} /> ASSET INVENTORY</span>
          <h1>จัดการครุภัณฑ์</h1>
          <p>ค้นหา ติดตาม และจัดการวงจรชีวิตครุภัณฑ์ไอทีขององค์กร</p>
        </div>
        {!loading && (
          <div className="assets-total-card" aria-label={`ครุภัณฑ์ทั้งหมด ${meta.totalItems} รายการ`}>
            <span><Archive size={18} /></span>
            <div><strong>{meta.totalItems.toLocaleString('th-TH')}</strong><small>รายการทั้งหมด</small></div>
          </div>
        )}
      </header>

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
        onToggleColumnsPanel={() => setColumnsOpen((current) => !current)}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((current) => !current)}
        activeFilterCount={activeFilterCount}
      />

      {error && (
        <div className="assets-error-banner" role="alert">
          <CircleAlert size={18} /><span>{error}</span>
          <button type="button" onClick={load}><RefreshCw size={15} /> ลองใหม่</button>
        </div>
      )}

      {loading ? <AssetsSkeleton /> : isEmpty ? (
        <div className="assets-empty-state">
          <span>{hasActiveFilters ? <SearchX size={32} /> : <Inbox size={32} />}</span>
          <h2>{hasActiveFilters ? 'ไม่พบครุภัณฑ์ที่ค้นหา' : 'ยังไม่มีครุภัณฑ์ในระบบ'}</h2>
          <p>{hasActiveFilters ? 'ลองปรับคำค้นหาหรือตัวกรอง เพื่อดูผลลัพธ์ที่กว้างขึ้น' : (canManage ? 'เริ่มต้นสร้างทะเบียนครุภัณฑ์ด้วยการเพิ่มรายการแรก' : 'ยังไม่มีครุภัณฑ์ที่มอบหมายให้คุณ')}</p>
          {hasActiveFilters ? (
            <button type="button" className="assets-empty-secondary" onClick={resetFilters}><RotateCcw size={17} /> รีเซ็ตตัวกรอง</button>
          ) : canManage ? (
            <button type="button" onClick={openCreate}><Plus size={17} /> เพิ่มครุภัณฑ์</button>
          ) : null}
        </div>
      ) : (
        <section className="assets-table-card" aria-label="รายการครุภัณฑ์">
          <div className="assets-table-meta">
            <div>
              <strong>รายการครุภัณฑ์</strong>
              <span>แสดง {assets.length} จาก {meta.totalItems} รายการ</span>
            </div>
            {refreshing && <span className="assets-refreshing"><RefreshCw size={15} /> กำลังอัปเดต</span>}
          </div>

          {selectedIds.size > 0 && (
            <div className="assets-bulk-bar" role="region" aria-label="การดำเนินการหลายรายการ">
              <div><PackageCheck size={18} /><strong>เลือกแล้ว {selectedIds.size} รายการ</strong><span>เลือกจากหน้าปัจจุบัน {selectedOnPage}</span></div>
              <div>
                <button type="button" className="assets-bulk-clear" onClick={() => setSelectedIds(new Set())}>ยกเลิกการเลือก</button>
                {canManage && <button type="button" className="assets-bulk-delete" onClick={() => setBulkDeleteOpen(true)}><Trash2 size={16} /> ลบที่เลือก</button>}
              </div>
            </div>
          )}

          <div className={`assets-table-scroll${refreshing ? ' is-refreshing' : ''}`}>
            <table className="assets-data-table">
              <thead>
                <tr>
                  <th className="assets-select-cell">
                    <input ref={selectAllRef} type="checkbox" checked={allOnPageSelected} onChange={togglePageSelection} aria-label="เลือกครุภัณฑ์ทั้งหมดในหน้านี้" />
                  </th>
                  {SORT_COLUMNS.map((column) => <SortHeader key={column.field} {...column} sortBy={sortBy} sortOrder={sortOrder} refreshing={refreshing} onSort={toggleSort} />)}
                  <th>หมวดหมู่</th>
                  {visibleColumns.brand && <th>ยี่ห้อ</th>}
                  {visibleColumns.model && <th>รุ่น</th>}
                  {visibleColumns.hostname && <th>Hostname</th>}
                  {visibleColumns.ipAddress && <th>IP Address</th>}
                  <th className="assets-actions-heading">จัดการ</th>
                  {visibleColumns.warrantyExpiry && <th>วันหมดประกัน</th>}
                  {visibleColumns.currentHolder && <th>ผู้ถือครองปัจจุบัน</th>}
                  {visibleColumns.assignmentStatus && <th>สถานะการมอบหมาย</th>}
                  {visibleColumns.assignedDate && <th>วันที่มอบหมาย</th>}
                  {visibleColumns.expectedReturn && <th>วันที่คาดว่าจะคืน</th>}
                  {visibleColumns.historyCount && <th>จำนวนประวัติ</th>}
                  {visibleColumns.openTickets && <th>ใบแจ้งซ่อมที่เปิดอยู่</th>}
                  {visibleColumns.ticketHistory && <th>ใบแจ้งซ่อมทั้งหมด</th>}
                  <th>สภาพ</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => {
                  const warranty = warrantyBadge(asset.warrantyExpiry)
                  const holder = asset.currentAssignment
                  const selected = selectedIds.has(asset.id)
                  return (
                    <tr key={asset.id} className={selected ? 'is-selected' : ''}>
                      <td className="assets-select-cell"><input type="checkbox" checked={selected} onChange={() => toggleAsset(asset.id)} aria-label={`เลือก ${asset.assetTag}`} /></td>
                      <td className="assets-tag-cell"><strong>{asset.assetTag}</strong><small>{asset.serialNumber || 'ไม่มี Serial Number'}</small></td>
                      <td className="assets-name-cell"><span className="assets-device-icon"><Boxes size={17} /></span><strong>{asset.name}</strong></td>
                      <td><span className={`assets-status-badge status-${asset.status.toLowerCase()}`}><i />{statusLabel(asset.status)}</span></td>
                      <td>{formatDate(asset.createdAt)}</td>
                      <td>{asset.category?.name || '-'}</td>
                      {visibleColumns.brand && <td>{asset.brand || '-'}</td>}
                      {visibleColumns.model && <td>{asset.model || '-'}</td>}
                      {visibleColumns.hostname && <td className="assets-mono">{asset.hostname || '-'}</td>}
                      {visibleColumns.ipAddress && <td className="assets-mono">{asset.ipAddress || '-'}</td>}
                      <td className="assets-row-actions">
                        <button type="button" onClick={() => onViewHistory?.(asset.id)} title="ดูประวัติ" aria-label={`ดูประวัติ ${asset.assetTag}`}><History size={16} /></button>
                        <button type="button" onClick={() => onViewTickets?.(asset.id)} title="ดูใบแจ้งซ่อม" aria-label={`ดูใบแจ้งซ่อม ${asset.assetTag}`}><ClipboardList size={16} /></button>
                        {canManage && <button type="button" onClick={() => openEdit(asset)} title="แก้ไข" aria-label={`แก้ไข ${asset.assetTag}`}><Edit3 size={16} /></button>}
                        {canManage && <button type="button" className="is-danger" onClick={() => setDeleteTarget(asset)} title="ลบ" aria-label={`ลบ ${asset.assetTag}`}><Trash2 size={16} /></button>}
                      </td>
                      {visibleColumns.warrantyExpiry && <td>{asset.warrantyExpiry ? formatDate(asset.warrantyExpiry) : '-'}{warranty && <span className={`assets-warranty-badge ${warranty.className}`}>{warranty.label}</span>}</td>}
                      {visibleColumns.currentHolder && <td>{holder ? (holder.user.name || holder.user.email) : <span className="assets-muted-value">ไม่มีผู้ถือครอง</span>}</td>}
                      {visibleColumns.assignmentStatus && <td>{holder ? assignmentStatusLabel(holder.status) : '-'}</td>}
                      {visibleColumns.assignedDate && <td>{holder ? formatDate(holder.assignedAt) : '-'}</td>}
                      {visibleColumns.expectedReturn && <td>{holder?.expectedReturnDate ? formatDate(holder.expectedReturnDate) : '-'}</td>}
                      {visibleColumns.historyCount && <td>{asset.assignmentHistoryCount}</td>}
                      {visibleColumns.openTickets && <td>{asset.openTicketsCount > 0 ? <span className="assets-ticket-count"><Wrench size={13} />{asset.openTicketsCount}</span> : '-'}</td>}
                      {visibleColumns.ticketHistory && <td>{asset.ticketHistoryCount}</td>}
                      <td>{conditionLabel(asset.assetCondition)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <footer className="assets-pagination">
            <span>หน้า <strong>{meta.page}</strong> จาก <strong>{meta.totalPages}</strong> · ทั้งหมด {meta.totalItems} รายการ</span>
            <nav aria-label="แบ่งหน้ารายการครุภัณฑ์">
              <button type="button" disabled={refreshing || meta.page <= 1} onClick={() => setPage((current) => current - 1)} aria-label="หน้าก่อนหน้า"><ChevronLeft size={17} /></button>
              {currentPages.map((pageNumber, index) => (
                <span key={pageNumber} className={`assets-page-number-wrap${pageNumber === meta.page ? ' is-current-wrap' : ''}`}>
                  {index > 0 && pageNumber - currentPages[index - 1] > 1 && <i>…</i>}
                  <button type="button" className={pageNumber === meta.page ? 'is-current' : ''} onClick={() => setPage(pageNumber)} aria-current={pageNumber === meta.page ? 'page' : undefined}>{pageNumber}</button>
                </span>
              ))}
              <button type="button" disabled={refreshing || meta.page >= meta.totalPages} onClick={() => setPage((current) => current + 1)} aria-label="หน้าถัดไป"><ChevronRight size={17} /></button>
            </nav>
          </footer>
        </section>
      )}

      {formOpen && <AssetForm asset={editingAsset} onSubmit={handleSubmit} onCancel={() => { setFormOpen(false); setEditingAsset(null) }} onNavigateToMaster={onNavigateToMaster} options={filterOptions} optionsError={filterOptionsError} />}

      {deleteTarget && (
        <ConfirmDialog
          title="ลบครุภัณฑ์"
          message={<div className="delete-summary"><div className="delete-summary-tag">{deleteTarget.assetTag}</div><div className="delete-summary-name">{deleteTarget.name}</div></div>}
          note="การลบจะซ่อนครุภัณฑ์นี้ออกจากรายการ และไม่สามารถกู้คืนได้จากหน้านี้"
          confirmLabel="ลบ"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {bulkDeleteOpen && (
        <ConfirmDialog
          title={`ลบครุภัณฑ์ ${selectedIds.size} รายการ`}
          message={<div className="assets-bulk-confirm"><Trash2 size={20} /><span>คุณกำลังลบครุภัณฑ์ที่เลือกทั้งหมด</span></div>}
          note="ระบบจะใช้ขั้นตอนการลบเดิมกับแต่ละรายการ กรุณาตรวจสอบก่อนดำเนินการ"
          confirmLabel={`ลบ ${selectedIds.size} รายการ`}
          busy={deleting}
          onConfirm={confirmBulkDelete}
          onCancel={() => setBulkDeleteOpen(false)}
        />
      )}
    </div>
  )
}

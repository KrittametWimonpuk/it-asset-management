// ---------------------------------------------------------------------------
// หน้า Reports — Milestone 8: Reports & Export
//
// การ์ดเลือกรายงาน (6 แบบ) -> คลิกแล้วเข้าโหมด preview: filter bar + ตาราง + ปุ่ม export (CSV/Excel/PDF)
// ทุกอย่างขับเคลื่อนด้วย REPORT_DEFS ด้านล่าง (ไม่มีหน้าแยกทีละรายงาน) เพราะโครงหน้าตาเหมือนกันหมด
// ต่างแค่ filter/columns ที่ใช้ — เหมือนแพทเทิร์นเดียวกับ MasterDataPage.jsx (config-driven)
//
// Preview ใช้ column key ตรงกับที่ routes/reports.js shape ให้ทุกตัวอักษร (shapeAssetRow ฯลฯ) เพื่อให้
// สิ่งที่เห็นในตาราง preview ตรงกับสิ่งที่อยู่ในไฟล์ export เป๊ะ — ไม่มี business logic คำนวณซ้ำฝั่งนี้เลย
// ---------------------------------------------------------------------------
import { useState, useEffect } from 'react'
import { api } from '../api.js'
import { useMasterDataOptions } from '../hooks/useMasterDataOptions.js'
import { STATUS_OPTIONS } from '../components/AssetForm.jsx'
import { ASSIGNMENT_STATUS_OPTIONS } from '../components/ReturnAssignmentForm.jsx'
import { TICKET_STATUS_OPTIONS, TICKET_CATEGORY_OPTIONS } from '../components/TicketForm.jsx'

const PAGE_SIZE = 20

const WARRANTY_BUCKET_OPTIONS = [
  { value: 'expired', label: 'หมดประกันแล้ว' },
  { value: 'expiring30', label: 'ใกล้หมดประกัน (30 วัน)' },
  { value: 'expiring90', label: 'ใกล้หมดประกัน (90 วัน)' },
  { value: 'normal', label: 'ปกติ' },
]

const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel' },
  { value: 'pdf', label: 'PDF' },
]

// ประเภทตัวกรอง -> ชื่อ query param จริงที่ backend อ่าน (ดู utils/reportHelpers.js: parseReportQuery)
const FILTER_PARAM_KEYS = {
  dateRange: ['dateFrom', 'dateTo'],
  bucket: ['bucket'],
  category: ['categoryId'],
  location: ['locationId'],
  department: ['departmentId'],
  vendor: ['vendorId'],
  status: ['status'],
  assignmentStatus: ['assignmentStatus'],
  ticketStatus: ['ticketStatus'],
  ticketCategory: ['ticketCategory'],
}

// นิยามรายงานทั้ง 6 ตัว — key ของ columns ตรงกับที่ routes/reports.js shape ให้ทุกตัวอักษร
const REPORT_DEFS = [
  {
    key: 'assets',
    title: 'Asset Inventory',
    description: 'รายการครุภัณฑ์ทั้งหมด พร้อมผู้ถือครองปัจจุบันและข้อมูลการรับประกัน',
    apiFn: api.reports.assets,
    paginated: true,
    filterFields: ['dateRange', 'category', 'location', 'department', 'vendor', 'status', 'search'],
    sortColumns: [
      { field: 'assetTag', label: 'Asset Tag' },
      { field: 'status', label: 'สถานะ' },
      { field: 'warrantyExpiry', label: 'วันหมดประกัน' },
    ],
    columns: [
      { key: 'assetTag', label: 'Asset Tag' },
      { key: 'name', label: 'ชื่ออุปกรณ์' },
      { key: 'category', label: 'หมวดหมู่' },
      { key: 'location', label: 'สถานที่ตั้ง' },
      { key: 'department', label: 'แผนก' },
      { key: 'vendor', label: 'ผู้ขาย/ผู้ผลิต' },
      { key: 'status', label: 'สถานะ' },
      { key: 'currentHolder', label: 'ผู้ถือครองปัจจุบัน' },
      { key: 'warrantyExpiry', label: 'วันหมดประกัน' },
      { key: 'purchaseDate', label: 'วันที่ซื้อ' },
      { key: 'purchasePrice', label: 'ราคาซื้อ' },
    ],
  },
  {
    key: 'assignments',
    title: 'Asset Assignment',
    description: 'ประวัติการมอบหมาย/รับคืนครุภัณฑ์ทั้งหมด',
    apiFn: api.reports.assignments,
    paginated: true,
    filterFields: ['dateRange', 'category', 'location', 'department', 'vendor', 'assignmentStatus', 'search'],
    sortColumns: [
      { field: 'assignedAt', label: 'วันที่มอบหมาย' },
      { field: 'returnedAt', label: 'วันที่คืน' },
      { field: 'status', label: 'สถานะการมอบหมาย' },
    ],
    columns: [
      { key: 'asset', label: 'ครุภัณฑ์' },
      { key: 'employee', label: 'พนักงาน' },
      { key: 'assignedDate', label: 'วันที่มอบหมาย' },
      { key: 'returnedDate', label: 'วันที่คืน' },
      { key: 'status', label: 'สถานะการมอบหมาย' },
      { key: 'conditionBefore', label: 'สภาพก่อนมอบหมาย' },
      { key: 'conditionAfter', label: 'สภาพหลังคืน' },
      { key: 'remark', label: 'หมายเหตุ' },
    ],
  },
  {
    key: 'warranty',
    title: 'Warranty Report',
    description: 'สถานะการรับประกันครุภัณฑ์ทั้งหมด แยกตามระยะเวลาคงเหลือ',
    apiFn: api.reports.warranty,
    paginated: true,
    filterFields: ['bucket', 'category', 'location', 'department', 'vendor', 'search'],
    sortColumns: [
      { field: 'assetTag', label: 'Asset Tag' },
      { field: 'warrantyExpiry', label: 'วันหมดประกัน' },
    ],
    columns: [
      { key: 'assetTag', label: 'Asset Tag' },
      { key: 'name', label: 'ชื่ออุปกรณ์' },
      { key: 'category', label: 'หมวดหมู่' },
      { key: 'department', label: 'แผนก' },
      { key: 'vendor', label: 'ผู้ขาย/ผู้ผลิต' },
      { key: 'warrantyExpiry', label: 'วันหมดประกัน' },
      { key: 'daysRemaining', label: 'จำนวนวันคงเหลือ' },
      { key: 'bucket', label: 'สถานะประกัน' },
    ],
  },
  {
    key: 'helpdesk',
    title: 'Helpdesk Report',
    description: 'ใบแจ้งซ่อม/ปัญหาครุภัณฑ์ทั้งหมด พร้อมระยะเวลาแก้ไข',
    apiFn: api.reports.helpdesk,
    paginated: true,
    filterFields: ['dateRange', 'category', 'location', 'department', 'vendor', 'ticketStatus', 'ticketCategory', 'search'],
    sortColumns: [
      { field: 'ticketNumber', label: 'เลขที่ใบแจ้ง' },
      { field: 'priority', label: 'ความสำคัญ' },
      { field: 'openedAt', label: 'วันที่แจ้ง' },
    ],
    columns: [
      { key: 'ticketNumber', label: 'เลขที่ใบแจ้ง' },
      { key: 'asset', label: 'ครุภัณฑ์' },
      { key: 'priority', label: 'ความสำคัญ' },
      { key: 'status', label: 'สถานะ' },
      { key: 'assignedStaff', label: 'ผู้ดูแล' },
      { key: 'opened', label: 'วันที่แจ้ง' },
      { key: 'resolved', label: 'วันที่แก้ไขสำเร็จ' },
      { key: 'closed', label: 'วันที่ปิดงาน' },
      { key: 'resolutionTimeHours', label: 'ระยะเวลาแก้ไข (ชั่วโมง)' },
    ],
  },
  {
    key: 'departments',
    title: 'Department Summary',
    description: 'สรุปจำนวนครุภัณฑ์/การมอบหมาย/ใบแจ้งซ่อม แยกตามแผนก',
    apiFn: api.reports.departments,
    paginated: false,
    orgWideOnly: true,
    filterFields: ['dateRange', 'category', 'location', 'vendor'],
    columns: [
      { key: 'department', label: 'แผนก' },
      { key: 'assetsCount', label: 'จำนวนครุภัณฑ์' },
      { key: 'activeAssignmentsCount', label: 'กำลังมอบหมายอยู่' },
      { key: 'ticketsCount', label: 'จำนวนใบแจ้งซ่อมทั้งหมด' },
    ],
  },
  {
    key: 'vendors',
    title: 'Vendor Summary',
    description: 'สรุปจำนวนครุภัณฑ์/การรับประกัน/ใบแจ้งซ่อม แยกตามผู้ขาย/ผู้ผลิต',
    apiFn: api.reports.vendors,
    paginated: false,
    orgWideOnly: true,
    filterFields: ['dateRange', 'category', 'location', 'department'],
    columns: [
      { key: 'vendor', label: 'ผู้ขาย/ผู้ผลิต' },
      { key: 'assetsCount', label: 'จำนวนครุภัณฑ์' },
      { key: 'expiredWarranty', label: 'หมดประกันแล้ว' },
      { key: 'expiringSoon', label: 'ใกล้หมดประกัน (90 วัน)' },
      { key: 'normalWarranty', label: 'ประกันปกติ' },
      { key: 'ticketsCount', label: 'จำนวนใบแจ้งซ่อมทั้งหมด' },
    ],
  },
]

function emptyFiltersFor(report) {
  return Object.fromEntries(
    report.filterFields
      .filter((f) => f !== 'search')
      .flatMap((f) => FILTER_PARAM_KEYS[f].map((k) => [k, '']))
  )
}

// role: EMPLOYEE ไม่เห็นการ์ด Department/Vendor Summary เลย (org-wide ล้วน ๆ ตาม business rule)
// — backend เองก็กัน 403 ไว้อีกชั้นอยู่แล้ว (routes/reports.js: orgWideOnly) นี่เป็นแค่ UX ไม่ให้กดแล้วเจอ error เปล่า ๆ
export default function Reports({ role }) {
  const [activeKey, setActiveKey] = useState(null)
  const visibleReports = REPORT_DEFS.filter((r) => !r.orgWideOnly || role !== 'EMPLOYEE')
  const activeReport = REPORT_DEFS.find((r) => r.key === activeKey)

  return (
    <div>
      <div className="between">
        <h2 className="section-title">{activeReport ? activeReport.title : 'รายงาน'}</h2>
        {activeReport && <button className="secondary" onClick={() => setActiveKey(null)}>← กลับไปหน้ารายงาน</button>}
      </div>

      {!activeReport ? (
        <div className="stat-cards mt">
          {visibleReports.map((r) => (
            <button key={r.key} className="card report-card" onClick={() => setActiveKey(r.key)}>
              <h3>{r.title}</h3>
              <p className="muted">{r.description}</p>
            </button>
          ))}
        </div>
      ) : (
        <ReportView key={activeReport.key} report={activeReport} />
      )}
    </div>
  )
}

function ReportView({ report }) {
  const { options: masterOptions } = useMasterDataOptions()

  const [filters, setFilters] = useState(() => emptyFiltersFor(report))
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState(report.sortColumns?.[0]?.field || '')
  const [sortOrder, setSortOrder] = useState('desc')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [exportingFormat, setExportingFormat] = useState('')
  const [exportError, setExportError] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => { setPage(1) }, [search, sortBy, sortOrder, filters])
  useEffect(() => { load() }, [page, sortBy, sortOrder, search, filters])

  async function load() {
    setRefreshing(true)
    try {
      const params = { ...filters, search, ...(report.paginated ? { page, pageSize: PAGE_SIZE, sortBy, sortOrder } : {}) }
      const res = await report.apiFn(params)
      setData(res)
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
    setFilters(emptyFiltersFor(report))
  }

  function toggleSort(field) {
    if (refreshing) return
    if (sortBy === field) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(field); setSortOrder('asc') }
  }

  async function handleExport(format) {
    setExportingFormat(format)
    setExportError('')
    try {
      await api.reports.download(report.key, { ...filters, search }, format)
    } catch (err) {
      setExportError(err.message)
    } finally {
      setExportingFormat('')
    }
  }

  const items = data?.items || []
  const isEmpty = !loading && items.length === 0
  const hasActiveFilters = search.length > 0 || Object.values(filters).some(Boolean)

  return (
    <div>
      <p className="muted mt">{report.description}</p>

      <div className="filter-bar mt">
        {report.filterFields.includes('dateRange') && (
          <>
            <div className="filter-field">
              <label htmlFor="report-date-from">วันที่เริ่ม</label>
              <input id="report-date-from" type="date" value={filters.dateFrom} onChange={(e) => updateFilter('dateFrom', e.target.value)} />
            </div>
            <div className="filter-field">
              <label htmlFor="report-date-to">วันที่สิ้นสุด</label>
              <input id="report-date-to" type="date" value={filters.dateTo} onChange={(e) => updateFilter('dateTo', e.target.value)} />
            </div>
          </>
        )}

        {report.filterFields.includes('bucket') && (
          <div className="filter-field">
            <label htmlFor="report-bucket">สถานะประกัน</label>
            <select id="report-bucket" value={filters.bucket} onChange={(e) => updateFilter('bucket', e.target.value)}>
              <option value="">ทั้งหมด</option>
              {WARRANTY_BUCKET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}

        {report.filterFields.includes('category') && (
          <div className="filter-field">
            <label htmlFor="report-category">หมวดหมู่</label>
            <select id="report-category" value={filters.categoryId} onChange={(e) => updateFilter('categoryId', e.target.value)} disabled={!masterOptions}>
              <option value="">ทั้งหมด</option>
              {masterOptions?.categoryId.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}

        {report.filterFields.includes('location') && (
          <div className="filter-field">
            <label htmlFor="report-location">สถานที่ตั้ง</label>
            <select id="report-location" value={filters.locationId} onChange={(e) => updateFilter('locationId', e.target.value)} disabled={!masterOptions}>
              <option value="">ทั้งหมด</option>
              {masterOptions?.locationId.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}

        {report.filterFields.includes('department') && (
          <div className="filter-field">
            <label htmlFor="report-department">แผนก</label>
            <select id="report-department" value={filters.departmentId} onChange={(e) => updateFilter('departmentId', e.target.value)} disabled={!masterOptions}>
              <option value="">ทั้งหมด</option>
              {masterOptions?.departmentId.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}

        {report.filterFields.includes('vendor') && (
          <div className="filter-field">
            <label htmlFor="report-vendor">ผู้ขาย/ผู้ผลิต</label>
            <select id="report-vendor" value={filters.vendorId} onChange={(e) => updateFilter('vendorId', e.target.value)} disabled={!masterOptions}>
              <option value="">ทั้งหมด</option>
              {masterOptions?.vendorId.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}

        {report.filterFields.includes('status') && (
          <div className="filter-field">
            <label htmlFor="report-status">สถานะ</label>
            <select id="report-status" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
              <option value="">ทั้งหมด</option>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}

        {report.filterFields.includes('assignmentStatus') && (
          <div className="filter-field">
            <label htmlFor="report-assignment-status">สถานะการมอบหมาย</label>
            <select id="report-assignment-status" value={filters.assignmentStatus} onChange={(e) => updateFilter('assignmentStatus', e.target.value)}>
              <option value="">ทั้งหมด</option>
              {ASSIGNMENT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}

        {report.filterFields.includes('ticketStatus') && (
          <div className="filter-field">
            <label htmlFor="report-ticket-status">สถานะใบแจ้งซ่อม</label>
            <select id="report-ticket-status" value={filters.ticketStatus} onChange={(e) => updateFilter('ticketStatus', e.target.value)}>
              <option value="">ทั้งหมด</option>
              {TICKET_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}

        {report.filterFields.includes('ticketCategory') && (
          <div className="filter-field">
            <label htmlFor="report-ticket-category">หมวดหมู่ปัญหา</label>
            <select id="report-ticket-category" value={filters.ticketCategory} onChange={(e) => updateFilter('ticketCategory', e.target.value)}>
              <option value="">ทั้งหมด</option>
              {TICKET_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}

        {report.filterFields.includes('search') && (
          <div className="filter-field">
            <label htmlFor="report-search">ค้นหา</label>
            <input id="report-search" type="text" className="search-input" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
        )}

        <div className="filter-actions">
          <button type="button" className="secondary" onClick={resetFilters}>รีเซ็ตตัวกรอง</button>
        </div>
      </div>

      <div className="row between mt">
        {!loading && (
          <p className="muted">
            {report.paginated ? `แสดง ${items.length} จาก ${data.totalItems} รายการ` : `ทั้งหมด ${items.length} รายการ`}
          </p>
        )}
        <div className="row">
          <span className="muted">ส่งออก:</span>
          {EXPORT_FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              className="secondary"
              disabled={Boolean(exportingFormat) || isEmpty}
              onClick={() => handleExport(f.value)}
            >
              {exportingFormat === f.value ? 'กำลังส่งออก...' : f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error mt">{error}</p>}
      {exportError && <p className="error mt">{exportError}</p>}

      {loading ? (
        <p className="muted mt">กำลังโหลด...</p>
      ) : isEmpty ? (
        <div className="empty-state mt">
          <h3>ไม่พบข้อมูล</h3>
          <p className="muted">
            {hasActiveFilters ? 'ไม่พบข้อมูลที่ตรงกับตัวกรอง ลองเปลี่ยนคำค้นหาหรือรีเซ็ตตัวกรอง' : 'ยังไม่มีข้อมูลสำหรับรายงานนี้'}
          </p>
          {hasActiveFilters && <button className="secondary" onClick={resetFilters}>รีเซ็ตตัวกรอง</button>}
        </div>
      ) : (
        <>
          <div className={`table-wrap mt${refreshing ? ' is-refreshing' : ''}`}>
            <table>
              <thead>
                <tr>
                  {report.columns.map((col) => {
                    const sortCol = report.sortColumns?.find((s) => s.label === col.label)
                    return sortCol ? (
                      <th key={col.key} className="sortable" onClick={() => toggleSort(sortCol.field)}>
                        {col.label}
                        {sortBy === sortCol.field && <span className="sort-arrow">{sortOrder === 'asc' ? ' ▲' : ' ▼'}</span>}
                      </th>
                    ) : (
                      <th key={col.key}>{col.label}</th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    {report.columns.map((col) => <td key={col.key}>{item[col.key] === '' || item[col.key] == null ? '-' : item[col.key]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {report.paginated && (
            <div className="row between mt">
              <span className="muted">
                หน้า {data.page} จาก {data.totalPages} • ทั้งหมด {data.totalItems} รายการ
                {refreshing && ' • กำลังโหลด...'}
              </span>
              <div className="row">
                <button className="secondary" disabled={refreshing || data.page <= 1} onClick={() => setPage((p) => p - 1)}>ก่อนหน้า</button>
                <button className="secondary" disabled={refreshing || data.page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>ถัดไป</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

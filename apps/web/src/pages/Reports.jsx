// ---------------------------------------------------------------------------
// หน้า Reports — Milestone 8: Reports & Export
//
// การ์ดเลือกรายงาน -> คลิกแล้วเข้าโหมด preview: filter bar + ตาราง + ปุ่ม export (CSV/Excel/PDF)
// ทุกอย่างขับเคลื่อนด้วย REPORT_DEFS ด้านล่าง (ไม่มีหน้าแยกทีละรายงาน) เพราะโครงหน้าตาเหมือนกันหมด
// ต่างแค่ filter/columns ที่ใช้ — เหมือนแพทเทิร์นเดียวกับ MasterDataPage.jsx (config-driven)
//
// Preview ใช้ column key ตรงกับที่ routes/reports.js shape ให้ทุกตัวอักษร (shapeAssetRow ฯลฯ) เพื่อให้
// สิ่งที่เห็นในตาราง preview ตรงกับสิ่งที่อยู่ในไฟล์ export เป๊ะ — ไม่มี business logic คำนวณซ้ำฝั่งนี้เลย
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle, ArrowDown, ArrowLeft, ArrowUp, BarChart3, Boxes, Building2,
  ChevronLeft, ChevronRight, ClipboardList, Download, FileDown, FileSpreadsheet,
  FileText, FilterX, Headphones, RefreshCw, Search, SearchX,
  ShieldCheck, Sparkles, Store, TableProperties, FileClock, UserCheck, RotateCcw,
} from 'lucide-react'
import { api } from '../api.js'
import { useMasterDataOptions } from '../hooks/useMasterDataOptions.js'
import { STATUS_OPTIONS } from '../components/AssetForm.jsx'
import { ASSIGNMENT_STATUS_OPTIONS } from '../components/ReturnAssignmentForm.jsx'
import { TICKET_STATUS_OPTIONS, TICKET_CATEGORY_OPTIONS } from '../components/TicketForm.jsx'
import './Reports.css'
import DateInput from '../components/DateInput.jsx'

const PAGE_SIZE = 20

const WARRANTY_BUCKET_OPTIONS = [
  { value: 'expired', label: 'หมดประกันแล้ว' },
  { value: 'expiring30', label: 'ใกล้หมดประกัน (30 วัน)' },
  { value: 'expiring90', label: 'ใกล้หมดประกัน (90 วัน)' },
  { value: 'normal', label: 'ปกติ' },
]

const BORROW_REQUEST_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'รออนุมัติ' }, { value: 'APPROVED', label: 'อนุมัติแล้ว' },
  { value: 'REJECTED', label: 'ปฏิเสธ' }, { value: 'CANCELLED', label: 'ยกเลิก' },
  { value: 'COMPLETED', label: 'ดำเนินการเสร็จสิ้น' },
]

const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV', icon: FileText },
  { value: 'xlsx', label: 'Excel', icon: FileSpreadsheet },
  { value: 'pdf', label: 'PDF', icon: FileDown },
]

const REPORT_UI = {
  assets: { icon: Boxes, tone: 'blue', short: 'ครุภัณฑ์' },
  assignments: { icon: ClipboardList, tone: 'violet', short: 'การมอบหมาย' },
  returns: { icon: RotateCcw, tone: 'green', short: 'การรับคืน' },
  warranty: { icon: ShieldCheck, tone: 'green', short: 'การรับประกัน' },
  helpdesk: { icon: Headphones, tone: 'amber', short: 'Helpdesk' },
  borrowRequests: { icon: FileClock, tone: 'blue', short: 'คำขอยืม' },
  approvals: { icon: UserCheck, tone: 'violet', short: 'การอนุมัติ' },
  departments: { icon: Building2, tone: 'cyan', short: 'แผนก' },
  vendors: { icon: Store, tone: 'rose', short: 'ผู้ขาย' },
}

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
  borrowRequestStatus: ['borrowRequestStatus'],
}

// นิยามรายงานทั้ง 8 ตัว — key ของ columns ตรงกับที่ routes/reports.js shape ให้ทุกตัวอักษร
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
      { key: 'employeeCode', label: 'รหัสพนักงาน' },
      { key: 'employeeName', label: 'ชื่อพนักงาน' },
      { key: 'department', label: 'แผนก' },
      { key: 'position', label: 'ตำแหน่ง' },
      { key: 'assignedDate', label: 'วันที่มอบหมาย' },
      { key: 'returnedDate', label: 'วันที่คืน' },
      { key: 'status', label: 'สถานะการมอบหมาย' },
      { key: 'conditionBefore', label: 'สภาพก่อนมอบหมาย' },
      { key: 'conditionAfter', label: 'สภาพหลังคืน' },
      { key: 'remark', label: 'หมายเหตุ' },
    ],
  },
  {
    key: 'returns',
    title: 'Return Report',
    description: 'ประวัติการตรวจรับคืน ผู้ตรวจ สภาพ ผลการตรวจ และระยะเวลาดำเนินการ',
    apiFn: api.reports.returns,
    paginated: true,
    filterFields: ['dateRange', 'search'],
    sortColumns: [
      { field: 'returnStartedAt', label: 'วันที่เริ่มรับคืน' },
      { field: 'inspectedAt', label: 'วันที่ตรวจรับ' },
      { field: 'returnedAt', label: 'วันที่คืน' },
      { field: 'returnStatus', label: 'สถานะการรับคืน' },
    ],
    columns: [
      { key: 'employee', label: 'พนักงาน' },
      { key: 'asset', label: 'ครุภัณฑ์' },
      { key: 'returnDate', label: 'วันที่คืน' },
      { key: 'inspector', label: 'ผู้ตรวจรับ' },
      { key: 'condition', label: 'สภาพหลังคืน' },
      { key: 'inspectionResult', label: 'ผลการตรวจ' },
      { key: 'returnStatus', label: 'สถานะการรับคืน' },
      { key: 'processingTimeHours', label: 'ระยะเวลา (ชั่วโมง)' },
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
    key: 'borrowRequests',
    title: 'Borrow Request Report',
    description: 'คำขอยืมครุภัณฑ์ พร้อมพนักงาน ขั้นตอนอนุมัติ และผลการดำเนินการ',
    apiFn: api.reports.borrowRequests,
    paginated: true,
    filterFields: ['dateRange', 'borrowRequestStatus', 'search'],
    sortColumns: [
      { field: 'requestedAt', label: 'วันที่ขอ' }, { field: 'requestNumber', label: 'เลขที่คำขอ' }, { field: 'status', label: 'สถานะ' },
    ],
    columns: [
      { key: 'requestNumber', label: 'เลขที่คำขอ' }, { key: 'employeeCode', label: 'รหัสพนักงาน' },
      { key: 'employeeName', label: 'ชื่อพนักงาน' }, { key: 'department', label: 'แผนก' },
      { key: 'position', label: 'ตำแหน่ง' }, { key: 'asset', label: 'ครุภัณฑ์' },
      { key: 'requestedAt', label: 'วันที่ขอ' }, { key: 'expectedReturnDate', label: 'วันที่คาดว่าจะคืน' },
      { key: 'status', label: 'สถานะ' }, { key: 'approvedBy', label: 'ผู้อนุมัติ' },
      { key: 'approvedAt', label: 'วันที่อนุมัติ' }, { key: 'reason', label: 'เหตุผลที่ขอ' },
      { key: 'rejectedReason', label: 'เหตุผลที่ปฏิเสธ' }, { key: 'remark', label: 'หมายเหตุ' },
    ],
  },
  {
    key: 'approvals',
    title: 'Approval Report',
    description: 'ผลการอนุมัติ ระยะเวลาพิจารณา และผู้อนุมัติที่ดำเนินการสูงสุด',
    apiFn: api.reports.approvals,
    paginated: true,
    orgWideOnly: true,
    filterFields: ['dateRange', 'borrowRequestStatus', 'search'],
    sortColumns: [
      { field: 'updatedAt', label: 'วันที่ตัดสินใจ' }, { field: 'requestedAt', label: 'วันที่ส่งคำขอ' }, { field: 'status', label: 'ผลการตัดสินใจ' },
    ],
    columns: [
      { key: 'requestNumber', label: 'เลขที่คำขอ' }, { key: 'employeeName', label: 'พนักงาน' },
      { key: 'department', label: 'แผนก' }, { key: 'asset', label: 'ครุภัณฑ์' },
      { key: 'decision', label: 'ผลการตัดสินใจ' }, { key: 'reviewer', label: 'ผู้พิจารณา' },
      { key: 'requestedAt', label: 'วันที่ส่งคำขอ' }, { key: 'decisionAt', label: 'วันที่ตัดสินใจ' },
      { key: 'approvalDurationHours', label: 'ระยะเวลา (ชั่วโมง)' }, { key: 'comment', label: 'ความคิดเห็น' },
      { key: 'rejectedReason', label: 'เหตุผลที่ปฏิเสธ' },
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

  return <section className="reports-page">
    {!activeReport ? <>
      <header className="reports-hero">
        <div><span className="reports-eyebrow"><BarChart3 size={15} /> Analytics center</span><h1>ศูนย์รวมรายงาน</h1><p>สำรวจข้อมูลสำคัญขององค์กร ดูตัวอย่าง และส่งออกในรูปแบบที่พร้อมใช้งาน</p></div>
        <div className="reports-hero-mark" aria-hidden="true"><BarChart3 size={34} /><span>{visibleReports.length}</span><small>Reports</small></div>
      </header>
      <div className="reports-intro"><div><Sparkles size={18} /><span><strong>เลือกรายงานที่ต้องการ</strong><small>ข้อมูลทั้งหมดอัปเดตจากระบบปัจจุบัน</small></span></div><span>{visibleReports.length} รายงานพร้อมใช้งาน</span></div>
      <div className="reports-catalog">
        {visibleReports.map((report) => {
          const ui = REPORT_UI[report.key]
          const Icon = ui.icon
          return <button key={report.key} className={`reports-card is-${ui.tone}`} onClick={() => setActiveKey(report.key)}>
            <span className="reports-card-icon"><Icon size={23} /></span>
            <span className="reports-card-copy"><small>{ui.short}</small><strong>{report.title}</strong><p>{report.description}</p></span>
            <span className="reports-card-footer"><span><TableProperties size={14} /> {report.columns.length} คอลัมน์</span><b>ดูรายงาน <ChevronRight size={16} /></b></span>
          </button>
        })}
      </div>
    </> : <>
      <button className="reports-back" type="button" onClick={() => setActiveKey(null)}><ArrowLeft size={17} /> กลับไปหน้ารายงาน</button>
      <ReportView key={activeReport.key} report={activeReport} />
    </>}
  </section>
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

  const load = useCallback(async () => {
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
  }, [filters, page, report, search, sortBy, sortOrder])

  useEffect(() => { setPage(1) }, [search, sortBy, sortOrder, filters])
  useEffect(() => { load() }, [load])

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

  const items = useMemo(() => data?.items || [], [data])
  const isEmpty = !loading && items.length === 0
  const hasActiveFilters = search.length > 0 || Object.values(filters).some(Boolean)
  const chart = useMemo(() => {
    if (!items.length) return []
    const preferred = ['status', 'bucket', 'category', 'department', 'vendor', 'priority']
    const key = preferred.find((candidate) => report.columns.some((column) => column.key === candidate)) || report.columns[0].key
    const counts = items.reduce((result, item) => {
      const label = item[key] === '' || item[key] == null ? 'ไม่ระบุ' : String(item[key])
      result[label] = (result[label] || 0) + 1
      return result
    }, {})
    const values = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6)
    const max = Math.max(...values.map(([, value]) => value), 1)
    return values.map(([label, value]) => ({ label, value, width: `${Math.max(8, (value / max) * 100)}%` }))
  }, [items, report.columns])

  return (
    <div className="report-view">
      <header className={`report-view-hero is-${REPORT_UI[report.key].tone}`}>
        <span><TableProperties size={15} /> Report preview</span>
        <h1>{report.title}</h1>
        <p>{report.description}</p>
      </header>

      <div className="report-filters">
        <div className="report-filters-title"><span><Search size={17} /></span><div><strong>ค้นหาและกรองข้อมูล</strong><small>ปรับเงื่อนไขเพื่อดูข้อมูลที่ต้องการ</small></div></div>
        {report.filterFields.includes('dateRange') && (
          <>
            <div className="filter-field">
              <label htmlFor="report-date-from">วันที่เริ่ม</label>
              <DateInput id="report-date-from" value={filters.dateFrom} onChange={(value) => updateFilter('dateFrom', value)} />
            </div>
            <div className="filter-field">
              <label htmlFor="report-date-to">วันที่สิ้นสุด</label>
              <DateInput id="report-date-to" value={filters.dateTo} onChange={(value) => updateFilter('dateTo', value)} />
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

        {report.filterFields.includes('borrowRequestStatus') && (
          <div className="filter-field">
            <label htmlFor="report-borrow-status">สถานะคำขอยืม</label>
            <select id="report-borrow-status" value={filters.borrowRequestStatus} onChange={(e) => updateFilter('borrowRequestStatus', e.target.value)}>
              <option value="">ทั้งหมด</option>
              {BORROW_REQUEST_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}

        {report.filterFields.includes('search') && (
          <div className="filter-field">
            <label htmlFor="report-search">ค้นหา</label>
            <input id="report-search" type="text" className="search-input" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
        )}

        <button type="button" className="report-reset" onClick={resetFilters} disabled={!hasActiveFilters}><FilterX size={16} /> ล้างตัวกรอง</button>
      </div>

      <div className="report-export-bar">
        <div><span><Download size={18} /></span><div><strong>ส่งออกรายงาน</strong><small>{!loading && (report.paginated ? `${data.totalItems} รายการทั้งหมด` : `${items.length} รายการ`)}</small></div></div>
        <div className="report-export-actions">
          {EXPORT_FORMATS.map((format) => {
            const Icon = format.icon
            return <button key={format.value} type="button" disabled={Boolean(exportingFormat) || isEmpty} onClick={() => handleExport(format.value)}>
              {exportingFormat === format.value ? <RefreshCw className="reports-spin" size={16} /> : <Icon size={16} />}{format.label}
            </button>
          })}
        </div>
      </div>

      {error && <div className="report-error"><AlertCircle size={17} />{error}</div>}
      {exportError && <div className="report-error"><AlertCircle size={17} />{exportError}</div>}

      {loading ? (
        <div className="report-loading" aria-busy="true"><div className="report-shimmer" /><div className="report-shimmer" /></div>
      ) : isEmpty ? (
        <div className="report-empty"><span><SearchX size={28} /></span><h3>ไม่พบข้อมูล</h3><p>{hasActiveFilters ? 'ไม่พบข้อมูลที่ตรงกับตัวกรอง ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง' : 'ยังไม่มีข้อมูลสำหรับรายงานนี้'}</p>
          {hasActiveFilters && <button onClick={resetFilters}><FilterX size={16} /> ล้างตัวกรอง</button>}
        </div>
      ) : (
        <>
          {data.approvalSummary && <section className="approval-report-summary" aria-label="สรุปประสิทธิภาพการอนุมัติ">
            <article><span>เวลาอนุมัติเฉลี่ย</span><strong>{data.approvalSummary.averageApprovalTimeHours.toLocaleString('th-TH')} ชม.</strong></article>
            <article><span>ผู้พิจารณาสูงสุด</span><ol>{data.approvalSummary.topApprovers.length ? data.approvalSummary.topApprovers.map((approver) => <li key={approver.name}><span>{approver.name}</span><b>{approver.decisions} รายการ</b></li>) : <li><span>ยังไม่มีข้อมูล</span></li>}</ol></article>
          </section>}
          <section className="report-chart-panel">
            <div className="report-section-head"><div><span><BarChart3 size={18} /></span><div><h2>ภาพรวมข้อมูล</h2><p>สัดส่วนจากข้อมูลในหน้าปัจจุบัน</p></div></div><b>{items.length} รายการ</b></div>
            <div className="report-bars">{chart.map((item, index) => <div className="report-bar" key={item.label}><div><span>{item.label}</span><strong>{item.value}</strong></div><i><span style={{ width: item.width, '--bar-index': index }} /></i></div>)}</div>
          </section>

          <section className="report-preview-panel">
            <div className="report-section-head"><div><span><TableProperties size={18} /></span><div><h2>ตัวอย่างรายงาน</h2><p>{report.paginated ? `แสดง ${items.length} จาก ${data.totalItems} รายการ` : `ทั้งหมด ${items.length} รายการ`}</p></div></div>{refreshing && <RefreshCw className="reports-spin" size={17} />}</div>
          <div className={`report-table-wrap${refreshing ? ' is-refreshing' : ''}`}>
            <table>
              <thead>
                <tr>
                  {report.columns.map((col) => {
                    const sortCol = report.sortColumns?.find((s) => s.label === col.label)
                    return sortCol ? (
                      <th scope="col" key={col.key}><button className="report-sort" onClick={() => toggleSort(sortCol.field)}>{col.label}{sortBy === sortCol.field && (sortOrder === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}</button></th>
                    ) : (
                      <th scope="col" key={col.key}>{col.label}</th>
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
            <div className="report-pagination">
              <span>หน้า {data.page} จาก {data.totalPages} · ทั้งหมด {data.totalItems} รายการ</span>
              <div>
                <button aria-label="หน้าก่อนหน้า" disabled={refreshing || data.page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={17} /></button>
                <b>{data.page}</b>
                <button aria-label="หน้าถัดไป" disabled={refreshing || data.page >= data.totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight size={17} /></button>
              </div>
            </div>
          )}
          </section>
        </>
      )}
    </div>
  )
}

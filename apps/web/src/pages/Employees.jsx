import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive, BriefcaseBusiness, ChevronLeft, ChevronRight, Edit3, Plus,
  RefreshCw, RotateCcw, Search, SearchX, UserRound, UsersRound,
} from 'lucide-react'
import { api } from '../api.js'
import EmployeeForm from '../components/EmployeeForm.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { formatDate } from '../utils/format.js'
import './Employees.css'

const PAGE_SIZE = 15
const STATUS_LABELS = {
  ACTIVE: 'ปฏิบัติงาน',
  INACTIVE: 'ไม่ใช้งาน',
  ON_LEAVE: 'ลางาน',
  RESIGNED: 'ลาออก',
}

function EmployeeSkeleton() {
  return <div className="employees-skeleton" aria-busy="true" aria-label="กำลังโหลดรายชื่อพนักงาน">
    {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
  </div>
}

export default function Employees({ role }) {
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, totalItems: 0 })
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [scope, setScope] = useState('active')
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [confirmAction, setConfirmAction] = useState('archive')
  const [confirmBusy, setConfirmBusy] = useState(false)

  const isAdmin = role === 'ADMIN'
  const hasFilters = Boolean(search || status || departmentId || scope === 'archived')

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => { setPage(1) }, [search, status, departmentId, scope])

  useEffect(() => {
    let cancelled = false
    api.departments.list({ pageSize: 100, sortBy: 'name', sortOrder: 'asc', isActive: true })
      .then((response) => { if (!cancelled) setDepartments(response.items) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const response = await api.employees.list({
        page, pageSize: PAGE_SIZE, search, status, departmentId, scope,
        sortBy: 'employeeCode', sortOrder: 'asc',
      })
      setItems(response.items)
      setMeta(response)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [departmentId, page, scope, search, status])

  useEffect(() => { load() }, [load])

  function openCreate() {
    if (scope === 'archived') setScope('active')
    setEditingEmployee(null)
    setFormOpen(true)
  }

  function openEdit(employee) {
    setEditingEmployee(employee)
    setFormOpen(true)
  }

  async function submitEmployee(payload) {
    if (editingEmployee) await api.employees.update(editingEmployee.id, payload)
    else await api.employees.add(payload)
    setFormOpen(false)
    setEditingEmployee(null)
    await load()
  }

  function requestAction(employee, action) {
    setConfirmTarget(employee)
    setConfirmAction(action)
  }

  async function confirmEmployeeAction() {
    setConfirmBusy(true)
    try {
      if (confirmAction === 'restore') await api.employees.restore(confirmTarget.id)
      else await api.employees.remove(confirmTarget.id)
      setConfirmTarget(null)
      if (items.length === 1 && page > 1) setPage((current) => current - 1)
      else await load()
    } catch (err) {
      setError(err.message)
      setConfirmTarget(null)
    } finally {
      setConfirmBusy(false)
    }
  }

  function clearFilters() {
    setSearchInput('')
    setSearch('')
    setStatus('')
    setDepartmentId('')
    setScope('active')
  }

  const pageNumbers = useMemo(() => {
    const start = Math.max(1, Math.min(meta.page - 1, meta.totalPages - 2))
    return Array.from({ length: Math.min(3, meta.totalPages) }, (_, index) => start + index)
  }, [meta.page, meta.totalPages])

  return <section className="employees-page">
    <header className="employees-hero">
      <div><span><UsersRound size={15} /> Employee management</span><h1>จัดการพนักงาน</h1><p>ข้อมูลบุคลากรพื้นฐานสำหรับ workflow ขององค์กรในอนาคต</p></div>
      <div className="employees-total"><span><UserRound size={21} /></span><strong>{meta.totalItems}</strong><small>{scope === 'archived' ? 'รายการใน Archive' : 'พนักงานทั้งหมด'}</small></div>
    </header>

    <div className="employees-toolbar">
      <label className="employees-search" htmlFor="employees-search-input"><span className="sr-only">ค้นหาพนักงาน</span><Search size={18} /><input id="employees-search-input" type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="ค้นหารหัส ชื่อ อีเมล หรือเบอร์โทร..." />{refreshing && <RefreshCw className="employees-spin" size={16} aria-hidden="true" />}</label>
      <div className="employees-toolbar-actions">
        <select aria-label="กรองตามสถานะพนักงาน" value={status} onChange={(event) => setStatus(event.target.value)} disabled={scope === 'archived'}>
          <option value="">ทุกสถานะ</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
        <select aria-label="กรองตามแผนก" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
          <option value="">ทุกแผนก</option>
          {departments.map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}
        </select>
        <select aria-label="เลือกขอบเขตรายการพนักงาน" value={scope} onChange={(event) => { setStatus(''); setScope(event.target.value) }}>
          <option value="active">พนักงานปัจจุบัน</option>
          <option value="archived">Archive</option>
        </select>
        <button type="button" onClick={openCreate}><Plus size={17} /> เพิ่มพนักงาน</button>
      </div>
    </div>

    {error && <div className="employees-error" role="alert"><span>{error}</span><button type="button" onClick={load}>ลองใหม่</button></div>}

    <section className="employees-table-card" aria-label="รายชื่อพนักงาน">
      <div className="employees-table-meta"><div><strong>{scope === 'archived' ? 'พนักงานใน Archive' : 'รายชื่อพนักงาน'}</strong><span aria-live="polite">แสดง {items.length} จาก {meta.totalItems} รายการ</span></div>{hasFilters && <button type="button" onClick={clearFilters}>ล้างตัวกรอง</button>}</div>
      {loading ? <EmployeeSkeleton /> : items.length === 0 ? (
        <div className="employees-empty">
          {hasFilters ? <SearchX size={32} /> : <UsersRound size={32} />}
          <h2>{hasFilters ? 'ไม่พบพนักงานที่ค้นหา' : scope === 'archived' ? 'ยังไม่มีพนักงานใน Archive' : 'ยังไม่มีข้อมูลพนักงาน'}</h2>
          <p>{hasFilters ? 'ลองเปลี่ยนคำค้นหาหรือตัวกรองแล้วค้นหาอีกครั้ง' : 'เพิ่มพนักงานคนแรกเพื่อเริ่มต้น Employee Management'}</p>
          {hasFilters ? <button type="button" className="secondary" onClick={clearFilters}>ล้างตัวกรอง</button> : scope !== 'archived' && <button type="button" onClick={openCreate}><Plus size={16} /> เพิ่มพนักงาน</button>}
        </div>
      ) : <>
        <div className={`employees-table-wrap${refreshing ? ' is-refreshing' : ''}`} aria-busy={refreshing}>
          <table>
            <caption className="sr-only">รายชื่อพนักงาน พร้อมแผนก ตำแหน่ง สถานะ และการจัดการ</caption>
            <thead><tr><th scope="col">รหัสพนักงาน</th><th scope="col">พนักงาน</th><th scope="col">แผนก</th><th scope="col">ตำแหน่ง</th><th scope="col">สถานะ</th><th scope="col">วันที่เริ่มงาน</th><th scope="col">การใช้งาน</th><th scope="col">จัดการ</th></tr></thead>
            <tbody>{items.map((employee) => <tr key={employee.id}>
              <td><strong className="employee-code">{employee.employeeCode}</strong></td>
              <td><div className="employee-identity"><span>{employee.firstName?.[0]}{employee.lastName?.[0]}</span><div><strong>{employee.fullName}</strong><small>{employee.email || employee.phone || 'ไม่มีข้อมูลติดต่อ'}</small></div></div></td>
              <td>{employee.department?.name || <span className="employees-muted">ไม่ระบุ</span>}</td>
              <td>{employee.position || <span className="employees-muted">ไม่ระบุ</span>}</td>
              <td><span className={`employee-status status-${employee.status.toLowerCase()}`}><i />{STATUS_LABELS[employee.status] || employee.status}</span></td>
              <td>{employee.hireDate ? formatDate(employee.hireDate) : '-'}</td>
              <td><span className={`employee-availability ${employee.isActive ? 'is-active' : 'is-inactive'}`}>{employee.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span></td>
              <td><div className="employee-row-actions">
                {scope !== 'archived' && <button type="button" onClick={() => openEdit(employee)} aria-label={`แก้ไข ${employee.fullName}`} title="แก้ไข"><Edit3 size={16} /><span>แก้ไข</span></button>}
                {isAdmin && scope !== 'archived' && <button type="button" className="archive" onClick={() => requestAction(employee, 'archive')} aria-label={`Archive ${employee.fullName}`} title="Archive"><Archive size={16} /><span>Archive</span></button>}
                {isAdmin && scope === 'archived' && <button type="button" className="restore" onClick={() => requestAction(employee, 'restore')} aria-label={`กู้คืน ${employee.fullName}`} title="กู้คืน"><RotateCcw size={16} /><span>กู้คืน</span></button>}
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>
        <footer className="employees-pagination"><span>หน้า {meta.page} จาก {meta.totalPages} · ทั้งหมด {meta.totalItems} รายการ</span><nav aria-label="แบ่งหน้ารายชื่อพนักงาน"><button type="button" disabled={refreshing || meta.page <= 1} onClick={() => setPage((current) => current - 1)} aria-label="หน้าก่อนหน้า"><ChevronLeft size={17} /></button>{pageNumbers.map((number) => <button type="button" className={number === meta.page ? 'is-current' : ''} aria-current={number === meta.page ? 'page' : undefined} onClick={() => setPage(number)} key={number}>{number}</button>)}<button type="button" disabled={refreshing || meta.page >= meta.totalPages} onClick={() => setPage((current) => current + 1)} aria-label="หน้าถัดไป"><ChevronRight size={17} /></button></nav></footer>
      </>}
    </section>

    {formOpen && <EmployeeForm employee={editingEmployee} departments={departments} onSubmit={submitEmployee} onCancel={() => { setFormOpen(false); setEditingEmployee(null) }} />}
    {confirmTarget && <ConfirmDialog
      title={confirmAction === 'restore' ? 'กู้คืนพนักงาน' : 'Archive พนักงาน'}
      message={<div className="employee-confirm-summary"><BriefcaseBusiness size={19} /><div><strong>{confirmTarget.employeeCode}</strong><span>{confirmTarget.fullName}</span></div></div>}
      note={confirmAction === 'restore' ? 'ข้อมูลพนักงานจะกลับมาแสดงในรายการปัจจุบัน' : 'ระบบจะเก็บข้อมูลไว้แบบ Soft Delete และสามารถกู้คืนภายหลังได้'}
      confirmLabel={confirmAction === 'restore' ? 'กู้คืน' : 'Archive'}
      busyLabel={confirmAction === 'restore' ? 'กำลังกู้คืน...' : 'กำลัง Archive...'}
      busy={confirmBusy}
      onConfirm={confirmEmployeeAction}
      onCancel={() => setConfirmTarget(null)}
    />}
  </section>
}

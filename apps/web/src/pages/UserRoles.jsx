import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, Search, ShieldCheck, UsersRound } from 'lucide-react'
import { api } from '../api.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { formatDate } from '../utils/format.js'
import './Employees.css'

const PAGE_SIZE = 15
const ROLE_LABELS = {
  ADMIN: 'ผู้ดูแลระบบ',
  IT_STAFF: 'เจ้าหน้าที่ไอที',
  EMPLOYEE: 'พนักงาน',
}
const ROLE_DESCRIPTIONS = {
  ADMIN: 'จัดการได้ทุกส่วน รวมถึงสิทธิ์ผู้ใช้',
  IT_STAFF: 'จัดการงานไอที แต่เปลี่ยนสิทธิ์ผู้ใช้ไม่ได้',
  EMPLOYEE: 'เข้าถึงเฉพาะข้อมูลและงานของตนเอง',
}

function UserRoleSkeleton() {
  return <div className="employees-skeleton" aria-busy="true" aria-label="กำลังโหลดบัญชีผู้ใช้">
    {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
  </div>
}

export default function UserRoles({ currentUser }) {
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, totalItems: 0 })
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [pendingChange, setPendingChange] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => { setPage(1) }, [roleFilter, search])

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const response = await api.users.list({
        page, pageSize: PAGE_SIZE, search, role: roleFilter, sortBy: 'name', sortOrder: 'asc',
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
  }, [page, roleFilter, search])

  useEffect(() => { load() }, [load])

  async function confirmRoleChange() {
    setSaving(true)
    try {
      const updated = await api.users.updateRole(pendingChange.user.id, pendingChange.nextRole)
      setItems((current) => current.map((item) => item.id === updated.id ? updated : item))
      setSuccess(`เปลี่ยนสิทธิ์ ${updated.email} เป็น ${ROLE_LABELS[updated.role]} แล้ว`)
      setError('')
      setPendingChange(null)
    } catch (err) {
      setError(err.message)
      setPendingChange(null)
    } finally {
      setSaving(false)
    }
  }

  const pageNumbers = useMemo(() => {
    const start = Math.max(1, Math.min(meta.page - 1, meta.totalPages - 2))
    return Array.from({ length: Math.min(3, meta.totalPages) }, (_, index) => start + index)
  }, [meta.page, meta.totalPages])

  return <section className="employees-page user-roles-page">
    <header className="employees-hero">
      <div><span><ShieldCheck size={15} /> User access control</span><h1>จัดการสิทธิ์ผู้ใช้</h1><p>กำหนดบทบาทการเข้าถึงระบบโดยผู้ดูแลระบบเท่านั้น</p></div>
      <div className="employees-total"><span><UsersRound size={21} /></span><strong>{meta.totalItems}</strong><small>บัญชีผู้ใช้</small></div>
    </header>

    <div className="employees-toolbar">
      <label className="employees-search" htmlFor="user-role-search"><span className="sr-only">ค้นหาบัญชีผู้ใช้</span><Search size={18} /><input id="user-role-search" type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="ค้นหาชื่อ อีเมล หรือรหัสพนักงาน..." />{refreshing && <RefreshCw className="employees-spin" size={16} aria-hidden="true" />}</label>
      <div className="employees-toolbar-actions">
        <select aria-label="กรองตามสิทธิ์ผู้ใช้" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
          <option value="">ทุกสิทธิ์</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </div>
    </div>

    {error && <div className="employees-error" role="alert"><span>{error}</span><button type="button" onClick={load}>ลองใหม่</button></div>}
    {success && <div className="user-role-success" role="status"><ShieldCheck size={17} /><span>{success}</span><button type="button" onClick={() => setSuccess('')} aria-label="ปิดข้อความสำเร็จ">×</button></div>}

    <section className="employees-table-card" aria-label="บัญชีและสิทธิ์ผู้ใช้">
      <div className="employees-table-meta"><div><strong>บัญชีผู้ใช้</strong><span aria-live="polite">แสดง {items.length} จาก {meta.totalItems} บัญชี</span></div></div>
      {loading ? <UserRoleSkeleton /> : items.length === 0 ? <div className="employees-empty"><UsersRound size={32} /><h2>ไม่พบบัญชีผู้ใช้</h2><p>ลองเปลี่ยนคำค้นหาหรือตัวกรองแล้วค้นหาอีกครั้ง</p></div> : <>
        <div className={`employees-table-wrap${refreshing ? ' is-refreshing' : ''}`} aria-busy={refreshing}>
          <table className="user-role-table">
            <caption className="sr-only">รายชื่อบัญชีผู้ใช้และเครื่องมือเปลี่ยนสิทธิ์</caption>
            <thead><tr><th scope="col">บัญชีผู้ใช้</th><th scope="col">ข้อมูลพนักงาน</th><th scope="col">สิทธิ์ปัจจุบัน</th><th scope="col">กำหนดสิทธิ์</th><th scope="col">วันที่สร้างบัญชี</th></tr></thead>
            <tbody>{items.map((user) => {
              const isCurrentUser = user.id === currentUser.id
              return <tr key={user.id}>
                <td><div className="employee-identity"><span>{(user.name || user.email)?.[0]?.toUpperCase()}</span><div><strong>{user.name || 'ไม่ระบุชื่อ'}</strong><small>{user.email}</small></div></div></td>
                <td>{user.employee ? <div className="user-role-employee"><strong>{user.employee.employeeCode}</strong><span>{user.employee.fullName}</span><small>{user.employee.position || 'ไม่ระบุตำแหน่ง'}</small></div> : <span className="employees-muted">ยังไม่เชื่อม Employee</span>}</td>
                <td><span className={`user-role-badge role-${user.role.toLowerCase()}`}><i />{ROLE_LABELS[user.role]}</span>{isCurrentUser && <small className="user-role-current">บัญชีที่กำลังใช้งาน</small>}</td>
                <td><label className="user-role-select"><span className="sr-only">กำหนดสิทธิ์ของ {user.email}</span><select value={user.role} disabled={isCurrentUser || saving} onChange={(event) => setPendingChange({ user, nextRole: event.target.value })} aria-describedby={`role-help-${user.id}`}>{Object.entries(ROLE_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><small id={`role-help-${user.id}`}>{isCurrentUser ? 'ไม่สามารถแก้สิทธิ์บัญชีตัวเอง' : ROLE_DESCRIPTIONS[user.role]}</small></label></td>
                <td>{formatDate(user.createdAt)}</td>
              </tr>
            })}</tbody>
          </table>
        </div>
        <footer className="employees-pagination"><span>หน้า {meta.page} จาก {meta.totalPages} · ทั้งหมด {meta.totalItems} บัญชี</span><nav aria-label="แบ่งหน้าบัญชีผู้ใช้"><button type="button" disabled={refreshing || meta.page <= 1} onClick={() => setPage((current) => current - 1)} aria-label="หน้าก่อนหน้า"><ChevronLeft size={17} /></button>{pageNumbers.map((number) => <button type="button" className={number === meta.page ? 'is-current' : ''} aria-current={number === meta.page ? 'page' : undefined} onClick={() => setPage(number)} key={number}>{number}</button>)}<button type="button" disabled={refreshing || meta.page >= meta.totalPages} onClick={() => setPage((current) => current + 1)} aria-label="หน้าถัดไป"><ChevronRight size={17} /></button></nav></footer>
      </>}
    </section>

    {pendingChange && <ConfirmDialog
      title="ยืนยันการเปลี่ยนสิทธิ์"
      message={<div className="employee-confirm-summary"><ShieldCheck size={19} /><div><strong>{pendingChange.user.name || pendingChange.user.email}</strong><span>{ROLE_LABELS[pendingChange.user.role]} → {ROLE_LABELS[pendingChange.nextRole]}</span></div></div>}
      note={ROLE_DESCRIPTIONS[pendingChange.nextRole]}
      confirmLabel="เปลี่ยนสิทธิ์"
      busyLabel="กำลังเปลี่ยนสิทธิ์..."
      busy={saving}
      onConfirm={confirmRoleChange}
      onCancel={() => setPendingChange(null)}
    />}
  </section>
}

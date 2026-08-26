import { useCallback, useEffect, useState } from 'react'
import {
  Archive, Bell, BellRing, Check, CheckCheck, ChevronLeft, ChevronRight,
  Clock3, Filter, Inbox, RefreshCw, Search,
} from 'lucide-react'
import { api } from '../api.js'
import './Notifications.css'

const PAGE_SIZE = 12
const TYPES = [
  ['BORROW_REQUEST', 'คำขอยืม'], ['APPROVAL', 'การอนุมัติ'], ['ASSIGNMENT', 'การมอบหมาย'],
  ['RETURN', 'การรับคืน'], ['REMINDER', 'แจ้งเตือนกำหนด'], ['SYSTEM', 'ระบบ'],
]
const PRIORITIES = [
  ['LOW', 'ต่ำ'], ['NORMAL', 'ปกติ'], ['HIGH', 'สูง'], ['CRITICAL', 'วิกฤต'],
]

function dateTime(value) {
  return new Intl.DateTimeFormat('th-TH', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

function typeLabel(value) {
  return TYPES.find(([key]) => key === value)?.[1] || value
}

function priorityLabel(value) {
  return PRIORITIES.find(([key]) => key === value)?.[1] || value
}

export default function Notifications() {
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, totalItems: 0 })
  const [page, setPage] = useState(1)
  const [type, setType] = useState('')
  const [priority, setPriority] = useState('')
  const [readFilter, setReadFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => setPage(1), [type, priority, readFilter, search])

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const data = await api.notifications.list({
        page, pageSize: PAGE_SIZE, type, priority, isRead: readFilter, search,
        sortBy: 'createdAt', sortOrder: 'desc',
      })
      setItems(data.items)
      setMeta(data)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [page, priority, readFilter, search, type])

  useEffect(() => { load() }, [load])

  function notifyShell() {
    window.dispatchEvent(new Event('notifications:refresh'))
  }

  async function markRead(item) {
    if (item.isRead) return
    setItems((current) => current.map((row) => row.id === item.id ? { ...row, isRead: true, readAt: new Date().toISOString() } : row))
    try {
      await api.notifications.markRead(item.id)
      setStatusMessage(`ทำเครื่องหมาย “${item.title}” ว่าอ่านแล้ว`)
      notifyShell()
    } catch (err) {
      setError(err.message)
      load()
    }
  }

  async function markAllRead() {
    try {
      const result = await api.notifications.markAllRead()
      setItems((current) => current.map((item) => ({ ...item, isRead: true, readAt: item.readAt || result.readAt })))
      setStatusMessage(`อ่านการแจ้งเตือนแล้ว ${result.count} รายการ`)
      notifyShell()
    } catch (err) {
      setError(err.message)
    }
  }

  async function archive(item) {
    try {
      await api.notifications.remove(item.id)
      setStatusMessage(`เก็บ “${item.title}” เข้าคลังแล้ว`)
      notifyShell()
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const hasFilters = Boolean(type || priority || readFilter || searchInput)
  const unreadOnPage = items.filter((item) => !item.isRead).length

  return <section className="notifications-page" aria-labelledby="notifications-title">
    <p className="sr-only" role="status" aria-live="polite">{statusMessage}</p>

    <header className="notifications-hero">
      <div>
        <span className="notifications-eyebrow"><BellRing size={15} /> Communication center</span>
        <h1 id="notifications-title">ศูนย์การแจ้งเตือน</h1>
        <p>ติดตามคำขอ การอนุมัติ การมอบหมาย การรับคืน และกำหนดคืนในที่เดียว</p>
      </div>
      <div className="notifications-summary" aria-label={`มี ${meta.totalItems} รายการ`}>
        <Bell size={22} /><strong>{meta.totalItems}</strong><span>รายการทั้งหมด</span>
      </div>
    </header>

    <section className="notifications-toolbar" aria-label="ค้นหาและกรองการแจ้งเตือน">
      <label className="notifications-search">
        <span className="sr-only">ค้นหาการแจ้งเตือน</span><Search size={18} />
        <input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="ค้นหาหัวข้อหรือข้อความ..." />
      </label>
      <label><span>ประเภท</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="">ทั้งหมด</option>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span>ความสำคัญ</span><select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">ทั้งหมด</option>{PRIORITIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span>สถานะ</span><select value={readFilter} onChange={(event) => setReadFilter(event.target.value)}><option value="">ทั้งหมด</option><option value="false">ยังไม่อ่าน</option><option value="true">อ่านแล้ว</option></select></label>
      <button className="button button-secondary" type="button" onClick={markAllRead} disabled={!meta.totalItems}><CheckCheck size={17} /> อ่านทั้งหมด</button>
    </section>

    {error && <div className="notifications-error" role="alert">{error}<button type="button" onClick={load}><RefreshCw size={15} /> ลองใหม่</button></div>}

    <section className="notifications-panel" aria-busy={refreshing}>
      <div className="notifications-panel-head">
        <div><Inbox size={18} /><span><strong>รายการแจ้งเตือน</strong><small>{unreadOnPage} รายการที่ยังไม่อ่านในหน้านี้</small></span></div>
        {refreshing && !loading && <RefreshCw className="notifications-spin" size={17} aria-label="กำลังอัปเดต" />}
      </div>

      {loading ? <div className="notifications-skeleton" role="status"><span className="sr-only">กำลังโหลดการแจ้งเตือน</span>{Array.from({ length: 5 }, (_, index) => <i key={index} />)}</div>
        : items.length === 0 ? <div className="notifications-empty"><span><Bell size={28} /></span><h2>{hasFilters ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีการแจ้งเตือน'}</h2><p>{hasFilters ? 'ลองปรับตัวกรองหรือใช้คำค้นหาอื่น' : 'ระบบจะแสดงเหตุการณ์สำคัญและรายการที่ต้องติดตามที่นี่'}</p>{hasFilters && <button type="button" onClick={() => { setType(''); setPriority(''); setReadFilter(''); setSearchInput('') }}><Filter size={16} /> ล้างตัวกรอง</button>}</div>
          : <ul className="notifications-list">
            {items.map((item) => <li key={item.id} className={item.isRead ? '' : 'is-unread'}>
              <span className={`notifications-item-icon priority-${item.priority.toLowerCase()}`}><BellRing size={19} /></span>
              <div className="notifications-item-copy">
                <div><span className={`notification-priority priority-${item.priority.toLowerCase()}`}>{priorityLabel(item.priority)}</span><span>{typeLabel(item.type)}</span></div>
                <h2>{item.title}</h2><p>{item.message}</p>
                <time dateTime={item.createdAt}><Clock3 size={14} /> {dateTime(item.createdAt)}</time>
              </div>
              <div className="notifications-item-actions">
                {!item.isRead && <button type="button" onClick={() => markRead(item)} aria-label={`ทำเครื่องหมาย ${item.title} ว่าอ่านแล้ว`} title="อ่านแล้ว"><Check size={17} /></button>}
                <button type="button" onClick={() => archive(item)} aria-label={`เก็บ ${item.title} เข้าคลัง`} title="เก็บเข้าคลัง"><Archive size={17} /></button>
              </div>
            </li>)}
          </ul>}

      {!loading && meta.totalPages > 1 && <nav className="notifications-pagination" aria-label="แบ่งหน้าการแจ้งเตือน">
        <span>หน้า {meta.page} จาก {meta.totalPages} · ทั้งหมด {meta.totalItems} รายการ</span>
        <div><button type="button" aria-label="หน้าก่อนหน้า" disabled={refreshing || page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={18} /></button><b aria-current="page">{page}</b><button type="button" aria-label="หน้าถัดไป" disabled={refreshing || page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}><ChevronRight size={18} /></button></div>
      </nav>}
    </section>
  </section>
}

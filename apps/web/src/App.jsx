// ---------------------------------------------------------------------------
// App — ตัวจัดการหน้าจอหลัก
// ตัดสินใจว่าจะแสดงหน้าไหน โดยดูจากว่า "ล็อกอินอยู่หรือยัง" (มี token ไหม)
// หลังล็อกอินแล้ว มีแท็บสลับไปมาระหว่างครุภัณฑ์กับหน้าจัดการ master data ต่าง ๆ
//
// หมายเหตุ: ตัวอย่างนี้ตั้งใจไม่ใช้ router library เพื่อให้มือใหม่อ่านง่าย
// ถ้าแอปโตขึ้น แนะนำเปลี่ยนไปใช้ react-router-dom
// ---------------------------------------------------------------------------
import { lazy, Suspense, useState, useEffect } from 'react'
import { auth, api } from './api.js'
import PortfolioShowcase from './pages/PortfolioShowcase.jsx'
import AppShell from './components/AppShell.jsx'
import { categoryConfig, locationConfig, departmentConfig, vendorConfig } from './pages/masterDataConfigs.jsx'

const Login = lazy(() => import('./pages/Login.jsx'))
const Register = lazy(() => import('./pages/Register.jsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Assets = lazy(() => import('./pages/Assets.jsx'))
const Assignments = lazy(() => import('./pages/Assignments.jsx'))
const Tickets = lazy(() => import('./pages/Tickets.jsx'))
const Reports = lazy(() => import('./pages/Reports.jsx'))
const AuditLog = lazy(() => import('./pages/AuditLog.jsx'))
const Employees = lazy(() => import('./pages/Employees.jsx'))
const MasterDataPage = lazy(() => import('./pages/MasterDataPage.jsx'))

function PageLoading() {
  return <div className="page-loading" role="status" aria-live="polite">
    <span className="skeleton page-loading-title" />
    <span className="skeleton page-loading-card" />
    <span className="sr-only">กำลังโหลดหน้า...</span>
  </div>
}

// แท็บทั้งหมดหลังล็อกอิน — 'assets' เป็น tab พิเศษ (มี component ของตัวเอง)
// ที่เหลือใช้ MasterDataPage ตัวเดียวกันแค่เปลี่ยน config
const MASTER_TABS = {
  categories: { label: 'หมวดหมู่', config: categoryConfig },
  locations: { label: 'สถานที่ตั้ง', config: locationConfig },
  departments: { label: 'แผนก', config: departmentConfig },
  vendors: { label: 'ผู้ขาย/ผู้ผลิต', config: vendorConfig },
}

// ป้ายชื่อ role ภาษาไทย ไว้โชว์ในหัวเว็บ (Milestone 4: RBAC)
const ROLE_LABELS = {
  ADMIN: 'ผู้ดูแลระบบ',
  IT_STAFF: 'เจ้าหน้าที่ไอที',
  EMPLOYEE: 'พนักงาน',
}

export default function App() {
  const [user, setUser] = useState(null)      // ข้อมูลผู้ใช้ที่ล็อกอินอยู่
  const [view, setView] = useState('showcase') // 'showcase' | 'login' | 'register'
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('dashboard') // dashboard/assets/assignments/tickets/employees/reports/audit/master data

  // Milestone 5: asset ที่จะกรองไว้ล่วงหน้าตอนเปิดแท็บ "การมอบหมาย" (มาจาก Assets.jsx ปุ่ม "ดูประวัติ")
  const [assignmentsAssetFilter, setAssignmentsAssetFilter] = useState('')
  // Milestone 7: asset ที่จะกรองไว้ล่วงหน้าตอนเปิดแท็บ "Helpdesk" (มาจาก Assets.jsx ปุ่ม "ดูใบแจ้งซ่อม")
  const [ticketsAssetFilter, setTicketsAssetFilter] = useState('')

  // ตอนเปิดแอป: ถ้ามี token เก่าอยู่ ลองถามเซิร์ฟเวอร์ว่ายังใช้ได้ไหม
  useEffect(() => {
    if (!auth.get()) { setLoading(false); return }
    api.me()
      .then((res) => setUser(res.user))
      .catch(() => auth.clear())     // token หมดอายุ -> ล้างทิ้ง
      .finally(() => setLoading(false))
  }, [])

  function handleAuthed(data) {
    auth.set(data.token)
    setUser(data.user)
  }

  function handleLogout() {
    auth.clear()
    setUser(null)
    setView('showcase')
    setTab('dashboard')
  }

  // เปิดแท็บ "การมอบหมาย" แบบไม่กรอง (คลิกที่แท็บตรง ๆ) — ล้างตัวกรอง asset เดิมที่อาจค้างจาก "ดูประวัติ" ทิ้งก่อนเสมอ
  function goToAssignments() {
    setAssignmentsAssetFilter('')
    setTab('assignments')
  }

  // Milestone 5: จาก Assets.jsx ปุ่ม "ดูประวัติ" — พาไปแท็บการมอบหมาย กรองเฉพาะ asset นั้น
  function handleViewHistory(assetId) {
    setAssignmentsAssetFilter(assetId)
    setTab('assignments')
  }

  // เปิดแท็บ "Helpdesk" แบบไม่กรอง (คลิกที่แท็บตรง ๆ) — ล้างตัวกรอง asset เดิมที่อาจค้างจาก "ดูใบแจ้งซ่อม" ทิ้งก่อนเสมอ
  function goToTickets() {
    setTicketsAssetFilter('')
    setTab('tickets')
  }

  function handleNavigate(nextTab) {
    if (nextTab === 'assignments') return goToAssignments()
    if (nextTab === 'tickets') return goToTickets()
    setTab(nextTab)
  }

  // Milestone 7: จาก Assets.jsx ปุ่ม "ดูใบแจ้งซ่อม" — พาไปแท็บ Helpdesk กรองเฉพาะ asset นั้น
  function handleViewTickets(assetId) {
    setTicketsAssetFilter(assetId)
    setTab('tickets')
  }

  if (loading) {
    return <div className="app-boot" role="status" aria-live="polite">
      <span className="app-boot-mark" aria-hidden="true" />
      <strong>IT Asset Management</strong>
      <small>กำลังเตรียมระบบ...</small>
      <span className="app-boot-progress" aria-hidden="true"><i /></span>
    </div>
  }

  // ยังไม่ล็อกอิน -> สลับระหว่างหน้า Login / Register
  if (!user) {
    if (view === 'showcase') return <PortfolioShowcase onViewDemo={() => setView('login')} />
    return <Suspense fallback={<PageLoading />}>
      {view === 'login'
        ? <Login onAuthed={handleAuthed} goRegister={() => setView('register')} />
        : <Register onAuthed={handleAuthed} goLogin={() => setView('login')} />}
    </Suspense>
  }

  // EMPLOYEE จัดการ master data ไม่ได้ (Milestone 4) — ซ่อนแท็บทั้งหมดไปเลย ไม่ใช่แค่ปุ่มข้างใน
  const canManageMasterData = user.role !== 'EMPLOYEE'
  const activeMaster = canManageMasterData ? MASTER_TABS[tab] : null

  return (
    <AppShell
      activeTab={tab}
      canManageMasterData={canManageMasterData}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      roleLabel={ROLE_LABELS[user.role] || user.role}
      user={user}
    >
      <div className="app-page-content">
        <Suspense fallback={<PageLoading />}>
          {tab === 'dashboard' && <Dashboard role={user.role} />}
          {tab === 'assets' && (
            <Assets
              role={user.role}
              onNavigateToMaster={(target) => setTab(target)}
              onViewHistory={handleViewHistory}
              onViewTickets={handleViewTickets}
            />
          )}
          {tab === 'assignments' && <Assignments role={user.role} initialAssetId={assignmentsAssetFilter} />}
          {tab === 'tickets' && <Tickets role={user.role} initialAssetId={ticketsAssetFilter} />}
          {tab === 'reports' && <Reports role={user.role} />}
          {tab === 'audit' && canManageMasterData && <AuditLog />}
          {tab === 'employees' && canManageMasterData && <Employees role={user.role} />}
          {activeMaster && <MasterDataPage {...activeMaster.config} />}
        </Suspense>
      </div>
    </AppShell>
  )
}

// ---------------------------------------------------------------------------
// App — ตัวจัดการหน้าจอหลัก
// ตัดสินใจว่าจะแสดงหน้าไหน โดยดูจากว่า "ล็อกอินอยู่หรือยัง" (มี token ไหม)
// หลังล็อกอินแล้ว มีแท็บสลับไปมาระหว่างครุภัณฑ์กับหน้าจัดการ master data ต่าง ๆ
//
// หมายเหตุ: ตัวอย่างนี้ตั้งใจไม่ใช้ router library เพื่อให้มือใหม่อ่านง่าย
// ถ้าแอปโตขึ้น แนะนำเปลี่ยนไปใช้ react-router-dom
// ---------------------------------------------------------------------------
import { useState, useEffect } from 'react'
import { auth, api } from './api.js'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Assets from './pages/Assets.jsx'
import MasterDataPage from './pages/MasterDataPage.jsx'
import { categoryConfig, locationConfig, departmentConfig, vendorConfig } from './pages/masterDataConfigs.jsx'

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
  const [view, setView] = useState('login')   // 'login' | 'register'
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('assets')    // 'assets' | 'categories' | 'locations' | 'departments' | 'vendors'

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
    setView('login')
    setTab('assets')
  }

  if (loading) {
    return <div className="container"><p className="muted">กำลังโหลด...</p></div>
  }

  // ยังไม่ล็อกอิน -> สลับระหว่างหน้า Login / Register
  if (!user) {
    return view === 'login'
      ? <Login onAuthed={handleAuthed} goRegister={() => setView('register')} />
      : <Register onAuthed={handleAuthed} goLogin={() => setView('login')} />
  }

  // EMPLOYEE จัดการ master data ไม่ได้ (Milestone 4) — ซ่อนแท็บทั้งหมดไปเลย ไม่ใช่แค่ปุ่มข้างใน
  const canManageMasterData = user.role !== 'EMPLOYEE'
  const activeMaster = canManageMasterData ? MASTER_TABS[tab] : null

  return (
    <div className="container wide">
      <div className="card">
        <div className="between">
          <h1>ระบบจัดการครุภัณฑ์ IT</h1>
          <button className="secondary" onClick={handleLogout}>ออกจากระบบ</button>
        </div>
        <p className="muted">สวัสดี {user.name || user.email} • {ROLE_LABELS[user.role] || user.role}</p>

        <nav className="tabs mt">
          <button className={`tab${tab === 'assets' ? ' active' : ''}`} onClick={() => setTab('assets')}>ครุภัณฑ์</button>
          {canManageMasterData && Object.entries(MASTER_TABS).map(([key, { label }]) => (
            <button key={key} className={`tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>{label}</button>
          ))}
        </nav>

        <div className="mt">
          {tab === 'assets' && <Assets role={user.role} onNavigateToMaster={(target) => setTab(target)} />}
          {activeMaster && <MasterDataPage {...activeMaster.config} />}
        </div>
      </div>
    </div>
  )
}

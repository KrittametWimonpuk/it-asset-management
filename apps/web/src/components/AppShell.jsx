import { useEffect, useMemo, useRef, useState } from 'react'
import './AppShell.css'

const CORE_NAVIGATION = [
  { key: 'dashboard', label: 'แดชบอร์ด', group: 'ภาพรวม', icon: 'dashboard' },
  { key: 'assets', label: 'ครุภัณฑ์', group: 'การจัดการ', icon: 'assets' },
  { key: 'assignments', label: 'การมอบหมาย', group: 'การจัดการ', icon: 'assignment' },
  { key: 'tickets', label: 'Helpdesk', group: 'การจัดการ', icon: 'ticket' },
  { key: 'reports', label: 'รายงาน', group: 'การจัดการ', icon: 'report' },
]

const ADMIN_NAVIGATION = [
  { key: 'audit', label: 'Audit Log', group: 'ผู้ดูแลระบบ', icon: 'audit' },
  { key: 'categories', label: 'หมวดหมู่', group: 'ผู้ดูแลระบบ', icon: 'category' },
  { key: 'locations', label: 'สถานที่ตั้ง', group: 'ผู้ดูแลระบบ', icon: 'location' },
  { key: 'departments', label: 'แผนก', group: 'ผู้ดูแลระบบ', icon: 'department' },
  { key: 'vendors', label: 'ผู้ขาย/ผู้ผลิต', group: 'ผู้ดูแลระบบ', icon: 'vendor' },
]

const PAGE_META = {
  dashboard: { title: 'แดชบอร์ด', eyebrow: 'ภาพรวมองค์กร' },
  assets: { title: 'ครุภัณฑ์', eyebrow: 'การจัดการสินทรัพย์' },
  assignments: { title: 'การมอบหมาย', eyebrow: 'การใช้งานครุภัณฑ์' },
  tickets: { title: 'Helpdesk', eyebrow: 'งานบริการไอที' },
  reports: { title: 'รายงาน', eyebrow: 'ข้อมูลและการวิเคราะห์' },
  audit: { title: 'Audit Log', eyebrow: 'การกำกับดูแลระบบ' },
  categories: { title: 'หมวดหมู่', eyebrow: 'ข้อมูลหลัก' },
  locations: { title: 'สถานที่ตั้ง', eyebrow: 'ข้อมูลหลัก' },
  departments: { title: 'แผนก', eyebrow: 'ข้อมูลหลัก' },
  vendors: { title: 'ผู้ขาย/ผู้ผลิต', eyebrow: 'ข้อมูลหลัก' },
}

function Icon({ name }) {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    assets: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M8 5V3h8v2M3 10h18M9 14h6" /></>,
    assignment: <><path d="M8 4h8M9 2h6v4H9z" /><rect x="5" y="4" width="14" height="18" rx="2" /><path d="m9 14 2 2 4-4" /></>,
    ticket: <><path d="M4 7a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4V7Z" /><path d="M12 8v8" /></>,
    report: <><path d="M5 20V10M12 20V4M19 20v-7" /><path d="M3 20h18" /></>,
    audit: <><path d="M12 3 20 6v6c0 5-3.2 8.1-8 10-4.8-1.9-8-5-8-10V6l8-3Z" /><path d="m9 12 2 2 4-4" /></>,
    category: <><path d="m4 4 6 1 9 9-5 5-9-9-1-6Z" /><circle cx="7.5" cy="7.5" r="1" /></>,
    location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    department: <><path d="M3 21h18M5 21V8l7-4 7 4v13M9 12h2M13 12h2M9 16h2M13 16h2" /></>,
    vendor: <><path d="M4 10h16l-1-5H5l-1 5ZM6 10v9h12v-9M9 19v-5h6v5" /><path d="M4 10a3 3 0 0 0 5 2 3 3 0 0 0 6 0 3 3 0 0 0 5-2" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" /></>,
    moon: <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />,
    chevron: <path d="m8 10 4 4 4-4" />,
    collapse: <path d="m15 18-6-6 6-6" />,
    logout: <><path d="M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /></>,
  }

  return (
    <svg className="shell-icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

export default function AppShell({ activeTab, canManageMasterData, onNavigate, onLogout, roleLabel, user, children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [theme, setTheme] = useState(() => localStorage.getItem('ui-theme') || 'light')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const notificationRef = useRef(null)
  const profileRef = useRef(null)
  const searchRef = useRef(null)

  const navigation = useMemo(
    () => canManageMasterData ? [...CORE_NAVIGATION, ...ADMIN_NAVIGATION] : CORE_NAVIGATION,
    [canManageMasterData],
  )

  const searchResults = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('th')
    if (!normalized) return []
    return navigation.filter((item) => item.label.toLocaleLowerCase('th').includes(normalized)).slice(0, 6)
  }, [navigation, query])

  const pageMeta = PAGE_META[activeTab] || PAGE_META.dashboard
  const displayName = user.name || user.email
  const initials = displayName.split(/\s|@/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

  useEffect(() => {
    localStorage.setItem('ui-theme', theme)
  }, [theme])

  useEffect(() => {
    function closeMenus(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) setNotificationsOpen(false)
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false)
    }

    function closeOnEscape(event) {
      if (event.key !== 'Escape') return
      setNotificationsOpen(false)
      setProfileOpen(false)
      setMobileOpen(false)
    }

    function focusSearch(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', closeMenus)
    document.addEventListener('keydown', closeOnEscape)
    document.addEventListener('keydown', focusSearch)
    return () => {
      document.removeEventListener('pointerdown', closeMenus)
      document.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('keydown', focusSearch)
    }
  }, [])

  function navigate(tabKey) {
    onNavigate(tabKey)
    setMobileOpen(false)
    setQuery('')
  }

  const groupedNavigation = navigation.reduce((groups, item) => {
    const existing = groups.find((group) => group.label === item.group)
    if (existing) existing.items.push(item)
    else groups.push({ label: item.group, items: [item] })
    return groups
  }, [])

  return (
    <div className={`app-shell${collapsed ? ' is-collapsed' : ''}${theme === 'dark' ? ' is-dark' : ''}`}>
      <aside id="app-sidebar" className={`app-sidebar${mobileOpen ? ' is-mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark">
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <path d="M16 3 27 7v8c0 7.1-4.4 11.5-11 14-6.6-2.5-11-6.9-11-14V7l11-4Z" />
              <path d="m11.5 16 3 3 6.5-7" />
            </svg>
          </span>
          <span className="sidebar-brand-copy">
            <strong>IT Asset</strong>
            <small>Management</small>
          </span>
        </div>

        <nav className="sidebar-nav" aria-label="เมนูหลัก">
          {groupedNavigation.map((group) => (
            <div className="sidebar-group" key={group.label}>
              <p className="sidebar-group-label">{group.label}</p>
              {group.items.map((item) => (
                <button
                  className={`sidebar-link${activeTab === item.key ? ' is-active' : ''}`}
                  type="button"
                  key={item.key}
                  onClick={() => navigate(item.key)}
                  title={collapsed ? item.label : undefined}
                  aria-current={activeTab === item.key ? 'page' : undefined}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-version">
            <span className="sidebar-status-dot" />
            <span>v1.0.0 Stable</span>
          </div>
          <button
            className="sidebar-collapse"
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'ขยายแถบด้านข้าง' : 'ย่อแถบด้านข้าง'}
          >
            <Icon name="collapse" />
            <span>ย่อเมนู</span>
          </button>
        </div>
      </aside>

      {mobileOpen && <button className="sidebar-backdrop" type="button" aria-label="ปิดเมนู" onClick={() => setMobileOpen(false)} />}

      <header className="app-topbar">
        <div className="topbar-title-wrap">
          <button
            className="topbar-menu-button"
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="เปิดเมนู"
            aria-controls="app-sidebar"
            aria-expanded={mobileOpen}
          >
            <Icon name="menu" />
          </button>
          <div className="topbar-title">
            <span>{pageMeta.eyebrow}</span>
            <h1>{pageMeta.title}</h1>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="topbar-search">
            <Icon name="search" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาเมนู..."
              aria-label="ค้นหาเมนู"
            />
            <kbd>Ctrl K</kbd>
            {query && (
              <div className="topbar-search-results">
                {searchResults.length > 0 ? searchResults.map((item) => (
                  <button type="button" key={item.key} onClick={() => navigate(item.key)}>
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                    <small>{item.group}</small>
                  </button>
                )) : <p>ไม่พบเมนูที่ค้นหา</p>}
              </div>
            )}
          </div>

          <div className="topbar-popover-wrap" ref={notificationRef}>
            <button
              className="topbar-icon-button"
              type="button"
              onClick={() => {
                setNotificationsOpen((value) => !value)
                setProfileOpen(false)
              }}
              aria-label="การแจ้งเตือน"
              aria-expanded={notificationsOpen}
            >
              <Icon name="bell" />
            </button>
            {notificationsOpen && (
              <div className="topbar-popover notification-popover">
                <div className="popover-heading">
                  <strong>การแจ้งเตือน</strong>
                  <span>ล่าสุด</span>
                </div>
                <div className="notification-empty">
                  <span><Icon name="bell" /></span>
                  <strong>ไม่มีการแจ้งเตือนใหม่</strong>
                  <p>รายการแจ้งเตือนของคุณจะแสดงที่นี่</p>
                </div>
              </div>
            )}
          </div>

          <button
            className="topbar-icon-button"
            type="button"
            onClick={() => setTheme((value) => value === 'light' ? 'dark' : 'light')}
            aria-label={theme === 'light' ? 'เปิดโหมดมืด' : 'เปิดโหมดสว่าง'}
          >
            <Icon name={theme === 'light' ? 'moon' : 'sun'} />
          </button>

          <div className="topbar-popover-wrap" ref={profileRef}>
            <button
              className="profile-trigger"
              type="button"
              onClick={() => {
                setProfileOpen((value) => !value)
                setNotificationsOpen(false)
              }}
              aria-label="เปิดเมนูโปรไฟล์"
              aria-expanded={profileOpen}
            >
              <span className="profile-avatar">{initials}</span>
              <span className="profile-copy">
                <strong>{displayName}</strong>
                <small>{roleLabel}</small>
              </span>
              <Icon name="chevron" />
            </button>
            {profileOpen && (
              <div className="topbar-popover profile-popover">
                <div className="profile-popover-user">
                  <span className="profile-avatar profile-avatar-large">{initials}</span>
                  <span>
                    <strong>{displayName}</strong>
                    <small>{user.email}</small>
                  </span>
                </div>
                <div className="profile-role">{roleLabel}</div>
                <button className="profile-logout" type="button" onClick={onLogout}>
                  <Icon name="logout" />
                  ออกจากระบบ
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="card app-page-card">{children}</div>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// หน้าแดชบอร์ด — Milestone 6: Dashboard & Analytics
//
// ยิง GET /api/dashboard ครั้งเดียวตอนเปิดหน้า ได้ข้อมูลทุกอย่างมาพร้อมกัน (การ์ดสรุป/กราฟ/กิจกรรมล่าสุด)
// การคำนวณสถิติทั้งหมดทำที่ backend แล้ว — หน้านี้มีหน้าที่แค่ render ข้อมูลที่ได้มา ไม่คำนวณอะไรเพิ่ม
//
// EMPLOYEE จะได้ response ที่ไม่มีสถิติภาพรวมองค์กร (บังคับจาก backend) — หน้านี้จึงซ่อนการ์ด/กราฟที่
// เป็นค่า null หรือ array ว่างไปเองโดยธรรมชาติ ไม่ต้องเช็ก role ซ้ำฝั่ง frontend อีกชั้น
// ---------------------------------------------------------------------------
import { useState, useEffect } from 'react'
import { api } from '../api.js'
import { formatDate } from '../utils/format.js'

const SUMMARY_CARDS = [
  { key: 'totalAssets', label: 'ครุภัณฑ์ทั้งหมด' },
  { key: 'assignedAssets', label: 'มอบหมายแล้ว' },
  { key: 'availableAssets', label: 'พร้อมใช้งาน' },
  { key: 'underRepairAssets', label: 'ซ่อมบำรุง' },
  { key: 'disposedAssets', label: 'เลิกใช้งาน' },
  { key: 'expiredWarranty', label: 'หมดประกันแล้ว' },
  { key: 'warrantyExpiringSoon', label: 'ใกล้หมดประกัน (30 วัน)' },
  { key: 'totalUsers', label: 'ผู้ใช้ทั้งหมด' },
  { key: 'totalCategories', label: 'หมวดหมู่ทั้งหมด' },
  { key: 'totalLocations', label: 'สถานที่ตั้งทั้งหมด' },
  { key: 'totalDepartments', label: 'แผนกทั้งหมด' },
  { key: 'totalVendors', label: 'ผู้ขาย/ผู้ผลิตทั้งหมด' },
]

const CHART_DEFS = [
  { key: 'assetsByCategory', title: 'ครุภัณฑ์ตามหมวดหมู่' },
  { key: 'assetsByDepartment', title: 'ครุภัณฑ์ตามแผนก' },
  { key: 'assetsByLocation', title: 'ครุภัณฑ์ตามสถานที่ตั้ง' },
  { key: 'assetsByStatus', title: 'ครุภัณฑ์ตามสถานะ' },
  { key: 'assignmentsByStatus', title: 'การมอบหมายตามสถานะ' },
  { key: 'warrantyStatus', title: 'สถานะการรับประกัน' },
  { key: 'topVendors', title: 'ผู้ขาย/ผู้ผลิตยอดนิยม' },
  { key: 'topAssignedCategories', title: 'หมวดหมู่ที่ถูกมอบหมายมากที่สุด' },
]

const ACTIVITY_TYPE_LABELS = {
  ASSIGNMENT: 'มอบหมาย',
  RETURN: 'รับคืน',
  NEW_ASSET: 'เพิ่มใหม่',
}

// กราฟแบบ bar เรียบ ๆ ด้วย CSS ล้วน — ไม่ผูกกับ chart library ใด ๆ ตามที่ spec ต้องการ
function BarChart({ items, max: maxProp, suffix = '' }) {
  if (!items || items.length === 0) {
    return <p className="muted">ไม่มีข้อมูล</p>
  }
  const max = maxProp ?? Math.max(...items.map((i) => i.value), 1)
  return (
    <div className="bar-chart">
      {items.map((item) => (
        <div className="bar-chart-row" key={item.label}>
          <span className="bar-chart-label">{item.label}</span>
          <span className="bar-chart-track">
            <span className="bar-chart-fill" style={{ width: `${Math.min(100, (item.value / max) * 100)}%` }} />
          </span>
          <span className="bar-chart-value">{item.value}{suffix}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard({ role }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await api.dashboard.get()
      setData(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div>
        <h2 className="section-title">แดชบอร์ด</h2>
        <p className="muted mt">กำลังโหลด...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h2 className="section-title">แดชบอร์ด</h2>
        <p className="error mt">{error}</p>
        <button className="secondary mt" onClick={load}>ลองใหม่</button>
      </div>
    )
  }

  const visibleCards = SUMMARY_CARDS.filter((c) => data.summary[c.key] !== null && data.summary[c.key] !== undefined)
  const visibleCharts = CHART_DEFS.filter((c) => (data.charts[c.key]?.length ?? 0) > 0)
  const hasOrgWideCharts = role !== 'EMPLOYEE'

  return (
    <div>
      <h2 className="section-title">แดชบอร์ด</h2>

      <div className="dashboard-section">
        {visibleCards.length === 0 ? (
          <p className="muted">ยังไม่มีข้อมูลสรุป</p>
        ) : (
          <div className="stat-cards">
            {visibleCards.map((c) => (
              <div className="stat-card" key={c.key}>
                <p className="stat-card-label">{c.label}</p>
                <p className="stat-card-value">{data.summary[c.key]}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {data.assets.utilization && (
        <div className="dashboard-section">
          <h3>การใช้งานครุภัณฑ์</h3>
          <BarChart
            max={100}
            suffix="%"
            items={[
              { label: 'มอบหมายแล้ว', value: data.assets.utilization.assignedPct },
              { label: 'พร้อมใช้งาน', value: data.assets.utilization.availablePct },
              { label: 'ซ่อมบำรุง', value: data.assets.utilization.repairPct },
              { label: 'เลิกใช้งาน', value: data.assets.utilization.disposedPct },
            ]}
          />
        </div>
      )}

      {hasOrgWideCharts && (
        <div className="dashboard-section">
          <h3>กราฟภาพรวม</h3>
          {visibleCharts.length === 0 ? (
            <p className="muted">ยังไม่มีข้อมูลสำหรับแสดงกราฟ</p>
          ) : (
            <div className="charts-grid">
              {visibleCharts.map((c) => (
                <div className="card" key={c.key}>
                  <h3>{c.title}</h3>
                  <BarChart items={data.charts[c.key]} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="dashboard-section">
        <h3>กิจกรรมล่าสุด</h3>
        {data.recentActivities.length === 0 ? (
          <p className="muted">ยังไม่มีกิจกรรม</p>
        ) : (
          <div className="card">
            <div className="activity-list">
              {data.recentActivities.map((item, i) => (
                <div className="activity-item" key={i}>
                  <span>
                    <span className={`badge badge-${item.type.toLowerCase().replace('_', '-')}`}>
                      {ACTIVITY_TYPE_LABELS[item.type] || item.type}
                    </span>
                    {' '}{item.message}
                  </span>
                  <span className="activity-time">{formatDate(item.at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

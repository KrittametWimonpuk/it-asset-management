// Enterprise Dashboard — presentation only; all data still comes from GET /api/dashboard.
import { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FolderTree,
  Gauge,
  Headphones,
  History,
  MapPin,
  PackageCheck,
  PackageOpen,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Store,
  TicketCheck,
  Timer,
  TriangleAlert,
  UserRound,
  UsersRound,
  Wrench,
  XCircle,
  Zap,
} from 'lucide-react'
import { api } from '../api.js'
import { formatDate, formatDateTime } from '../utils/format.js'
import { ACTION_LABELS, ENTITY_TYPE_LABELS } from '../utils/auditLabels.js'
import './Dashboard.css'

const SUMMARY_CARDS = [
  { key: 'totalAssets', label: 'ครุภัณฑ์ทั้งหมด', icon: Boxes, tone: 'blue', detail: 'รายการในระบบ' },
  { key: 'assignedAssets', label: 'มอบหมายแล้ว', icon: ClipboardCheck, tone: 'indigo', detail: 'กำลังถูกใช้งาน' },
  { key: 'availableAssets', label: 'พร้อมใช้งาน', icon: PackageCheck, tone: 'green', detail: 'พร้อมมอบหมาย' },
  { key: 'underRepairAssets', label: 'ซ่อมบำรุง', icon: Wrench, tone: 'amber', detail: 'อยู่ระหว่างซ่อม' },
  { key: 'disposedAssets', label: 'เลิกใช้งาน', icon: Archive, tone: 'slate', detail: 'นำออกจากการใช้งาน' },
  { key: 'expiredWarranty', label: 'หมดประกันแล้ว', icon: XCircle, tone: 'red', detail: 'ต้องตรวจสอบ' },
  { key: 'warrantyExpiringSoon', label: 'ใกล้หมดประกัน', icon: AlertTriangle, tone: 'amber', detail: 'ภายใน 30 วัน' },
  { key: 'totalUsers', label: 'ผู้ใช้ทั้งหมด', icon: UsersRound, tone: 'violet', detail: 'บัญชีในองค์กร' },
  { key: 'totalCategories', label: 'หมวดหมู่ทั้งหมด', icon: FolderTree, tone: 'cyan', detail: 'ประเภทครุภัณฑ์' },
  { key: 'totalLocations', label: 'สถานที่ตั้งทั้งหมด', icon: MapPin, tone: 'blue', detail: 'พื้นที่จัดเก็บ' },
  { key: 'totalDepartments', label: 'แผนกทั้งหมด', icon: Building2, tone: 'indigo', detail: 'หน่วยงานในระบบ' },
  { key: 'totalVendors', label: 'ผู้ขาย/ผู้ผลิต', icon: Store, tone: 'violet', detail: 'คู่ค้าทั้งหมด' },
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
  { key: 'ticketsByPriority', title: 'ใบแจ้งซ่อมตามความสำคัญ' },
  { key: 'ticketsByStatus', title: 'ใบแจ้งซ่อมตามสถานะ' },
  { key: 'topTicketCategories', title: 'หมวดหมู่ปัญหาที่พบมากที่สุด' },
]

const TICKET_SUMMARY_CARDS = [
  { key: 'open', label: 'เปิดอยู่', icon: Headphones, tone: 'blue' },
  { key: 'inProgress', label: 'กำลังดำเนินการ', icon: Clock3, tone: 'amber' },
  { key: 'resolvedToday', label: 'แก้ไขวันนี้', icon: CheckCircle2, tone: 'green' },
  { key: 'closedToday', label: 'ปิดงานวันนี้', icon: TicketCheck, tone: 'violet' },
]

const BORROW_REQUEST_SUMMARY_CARDS = [
  { key: 'pending', label: 'คำขอรออนุมัติ', icon: Clock3, tone: 'amber', detail: 'รายการที่ต้องดำเนินการ' },
  { key: 'approvedToday', label: 'อนุมัติวันนี้', icon: CheckCircle2, tone: 'green', detail: 'สร้างการมอบหมายแล้ว' },
  { key: 'rejectedToday', label: 'ปฏิเสธวันนี้', icon: XCircle, tone: 'red', detail: 'คำขอที่ไม่ผ่านอนุมัติ' },
  { key: 'averageApprovalTimeHours', label: 'เวลาอนุมัติเฉลี่ย', icon: Timer, tone: 'violet', detail: 'ชั่วโมงตั้งแต่ส่งถึงอนุมัติ', suffix: ' ชม.' },
]

const RETURN_SUMMARY_CARDS = [
  { key: 'pendingInspections', label: 'รอตรวจรับคืน', icon: Clock3, tone: 'amber', detail: 'Assignment ที่รอดำเนินการ' },
  { key: 'completedToday', label: 'คืนเสร็จวันนี้', icon: CheckCircle2, tone: 'green', detail: 'ปิดกระบวนการแล้ว' },
  { key: 'damaged', label: 'รับคืนแบบชำรุด', icon: AlertTriangle, tone: 'amber', detail: 'รายการสะสม' },
  { key: 'lost', label: 'ครุภัณฑ์สูญหาย', icon: XCircle, tone: 'red', detail: 'รายการสะสม' },
  { key: 'averageProcessingTimeHours', label: 'เวลารับคืนเฉลี่ย', icon: Timer, tone: 'violet', detail: 'ชั่วโมงตั้งแต่เริ่มตรวจถึงปิดงาน', suffix: ' ชม.' },
]

const ACTIVITY_TYPE_LABELS = {
  ASSIGNMENT: 'มอบหมาย',
  RETURN: 'รับคืน',
  NEW_ASSET: 'เพิ่มใหม่',
}

const ACTIVITY_ICONS = {
  ASSIGNMENT: ClipboardCheck,
  RETURN: RotateCcw,
  NEW_ASSET: PackageOpen,
}

const TICKET_STATUS_LABELS = {
  OPEN: 'เปิดใหม่',
  IN_PROGRESS: 'กำลังดำเนินการ',
  ON_HOLD: 'พักงาน',
  RESOLVED: 'แก้ไขสำเร็จ',
  CLOSED: 'ปิดงานแล้ว',
}

const TICKET_PRIORITY_LABELS = {
  LOW: 'ต่ำ',
  MEDIUM: 'ปานกลาง',
  HIGH: 'สูง',
  CRITICAL: 'วิกฤต',
}

const WARRANTY_ITEMS = [
  { key: 'normal', label: 'อยู่ในประกัน', icon: ShieldCheck, tone: 'green' },
  { key: 'expiringSoon', label: 'ใกล้หมดประกัน', icon: AlertTriangle, tone: 'amber' },
  { key: 'expired', label: 'หมดประกัน', icon: XCircle, tone: 'red' },
]

function SectionHeading({ icon: Icon, title, description, action }) {
  return (
    <div className="dashboard-section-heading">
      <div className="dashboard-section-title">
        <span className="dashboard-section-icon"><Icon size={19} aria-hidden="true" /></span>
        <span>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </span>
      </div>
      {action}
    </div>
  )
}

function BarChart({ items, max: maxProp, suffix = '' }) {
  if (!items || items.length === 0) {
    return <div className="dashboard-empty-inline">ไม่มีข้อมูล</div>
  }

  const max = maxProp ?? Math.max(...items.map((item) => item.value), 1)
  return (
    <div className="dashboard-bar-chart">
      {items.map((item, index) => (
        <div className="dashboard-bar-row" key={item.label}>
          <div className="dashboard-bar-meta">
            <span>{item.label}</span>
            <strong>{item.value}{suffix}</strong>
          </div>
          <div className="dashboard-bar-track" aria-hidden="true">
            <span
              className="dashboard-bar-fill"
              style={{ '--bar-index': index, width: `${Math.min(100, (item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="enterprise-dashboard dashboard-skeleton" aria-label="กำลังโหลดแดชบอร์ด" aria-busy="true">
      <div className="skeleton-block skeleton-hero" />
      <div className="dashboard-kpi-grid">
        {Array.from({ length: 4 }, (_, index) => <div className="skeleton-block skeleton-kpi" key={index} />)}
      </div>
      <div className="dashboard-content-grid">
        <div className="skeleton-block skeleton-chart" />
        <div className="skeleton-block skeleton-chart" />
      </div>
      <span className="sr-only">กำลังโหลดข้อมูลแดชบอร์ด</span>
    </div>
  )
}

function EmptyState({ icon: Icon, children }) {
  return (
    <div className="dashboard-empty-state">
      <span><Icon size={22} aria-hidden="true" /></span>
      <p>{children}</p>
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
      const response = await api.dashboard.get()
      setData(response)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <DashboardSkeleton />

  if (error) {
    return (
      <div className="dashboard-error-state" role="alert">
        <span><TriangleAlert size={28} aria-hidden="true" /></span>
        <h2>ไม่สามารถโหลดแดชบอร์ดได้</h2>
        <p>{error}</p>
        <button className="btn-secondary" type="button" onClick={load}>
          <RefreshCw size={17} aria-hidden="true" /> ลองใหม่
        </button>
      </div>
    )
  }

  const visibleCards = SUMMARY_CARDS.filter((card) => data.summary[card.key] !== null && data.summary[card.key] !== undefined)
  const visibleCharts = CHART_DEFS.filter((chart) => (data.charts[chart.key]?.length ?? 0) > 0)
  const hasOrgWideCharts = role !== 'EMPLOYEE'
  const today = new Intl.DateTimeFormat('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date())

  return (
    <div className="enterprise-dashboard">
      <section className="dashboard-welcome-hero">
        <div className="dashboard-hero-copy">
          <span className="dashboard-hero-eyebrow"><Zap size={15} aria-hidden="true" /> Enterprise Overview</span>
          <h1>ยินดีต้อนรับสู่แดชบอร์ด</h1>
          <p>{role === 'EMPLOYEE'
            ? `Current Employee: ${data.currentEmployee ? `${data.currentEmployee.employeeCode} · ${data.currentEmployee.fullName}` : 'Unknown Employee'}`
            : 'ติดตามสถานะครุภัณฑ์ การใช้งาน และงานบริการไอทีขององค์กรแบบครบวงจร'}</p>
        </div>
        <div className="dashboard-today">
          <span><CalendarDays size={21} aria-hidden="true" /></span>
          <div>
            <small>วันนี้</small>
            <strong>{today}</strong>
          </div>
        </div>
        <div className="dashboard-hero-orb dashboard-hero-orb-one" />
        <div className="dashboard-hero-orb dashboard-hero-orb-two" />
      </section>

      <section className="dashboard-quick-section">
        <SectionHeading icon={Zap} title="Quick Actions" description="เข้าถึงข้อมูลสำคัญได้อย่างรวดเร็ว" />
        <div className="dashboard-quick-grid">
          <a className="dashboard-quick-card" href="#dashboard-kpis">
            <span className="dashboard-quick-icon tone-blue"><Gauge size={21} aria-hidden="true" /></span>
            <span><strong>ดูภาพรวม</strong><small>ตัวเลขสำคัญทั้งหมด</small></span>
            <ArrowRight size={17} aria-hidden="true" />
          </a>
          <a className="dashboard-quick-card" href="#dashboard-helpdesk">
            <span className="dashboard-quick-icon tone-amber"><Headphones size={21} aria-hidden="true" /></span>
            <span><strong>ตรวจ Helpdesk</strong><small>งานที่ต้องดำเนินการ</small></span>
            <ArrowRight size={17} aria-hidden="true" />
          </a>
          <a className="dashboard-quick-card" href="#dashboard-warranty">
            <span className="dashboard-quick-icon tone-green"><ShieldCheck size={21} aria-hidden="true" /></span>
            <span><strong>ตรวจการรับประกัน</strong><small>รายการใกล้หมดอายุ</small></span>
            <ArrowRight size={17} aria-hidden="true" />
          </a>
          <a className="dashboard-quick-card" href="#dashboard-activity">
            <span className="dashboard-quick-icon tone-violet"><History size={21} aria-hidden="true" /></span>
            <span><strong>ดูกิจกรรมล่าสุด</strong><small>ความเคลื่อนไหวในระบบ</small></span>
            <ArrowRight size={17} aria-hidden="true" />
          </a>
        </div>
      </section>

      <section id="dashboard-kpis" className="dashboard-block">
        <SectionHeading icon={Gauge} title="ภาพรวมตัวชี้วัด" description="ข้อมูลล่าสุดจากระบบจัดการครุภัณฑ์" />
        {visibleCards.length === 0 ? (
          <EmptyState icon={Boxes}>ยังไม่มีข้อมูลสรุป</EmptyState>
        ) : (
          <div className="dashboard-kpi-grid">
            {visibleCards.map((card) => {
              const CardIcon = card.icon
              return (
                <article className={`dashboard-card dashboard-kpi-card tone-${card.tone}`} key={card.key}>
                  <div className="dashboard-kpi-header">
                    <span className="dashboard-kpi-icon"><CardIcon size={22} aria-hidden="true" /></span>
                    <span className="dashboard-kpi-trend"><Activity size={13} aria-hidden="true" /> Live</span>
                  </div>
                  <p>{card.label}</p>
                  <strong>{data.summary[card.key].toLocaleString('th-TH')}</strong>
                  <small>{card.detail}</small>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section id="dashboard-borrow-requests" className="dashboard-block">
        <SectionHeading icon={ClipboardList} title="Borrow Request Summary" description="ภาพรวมขั้นตอนคำขอยืมครุภัณฑ์วันนี้" />
        <div className="dashboard-kpi-grid">
          {BORROW_REQUEST_SUMMARY_CARDS.map((card) => {
            const CardIcon = card.icon
            return <article className={`dashboard-card dashboard-kpi-card tone-${card.tone}`} key={card.key}>
              <div className="dashboard-kpi-header"><span className="dashboard-kpi-icon"><CardIcon size={22} aria-hidden="true" /></span><span className="dashboard-kpi-trend"><Activity size={13} aria-hidden="true" /> Live</span></div>
              <p>{card.label}</p><strong>{(data.borrowRequests?.[card.key] || 0).toLocaleString('th-TH')}{card.suffix || ''}</strong><small>{card.detail}</small>
            </article>
          })}
        </div>
      </section>

      <section id="dashboard-returns" className="dashboard-block">
        <SectionHeading icon={RotateCcw} title="Return Workflow Summary" description="ภาพรวมการตรวจรับคืนครุภัณฑ์" />
        <div className="dashboard-kpi-grid dashboard-return-grid">
          {RETURN_SUMMARY_CARDS.map((card) => {
            const CardIcon = card.icon
            return <article className={`dashboard-card dashboard-kpi-card tone-${card.tone}`} key={card.key}>
              <div className="dashboard-kpi-header"><span className="dashboard-kpi-icon"><CardIcon size={22} aria-hidden="true" /></span><span className="dashboard-kpi-trend"><Activity size={13} aria-hidden="true" /> Live</span></div>
              <p>{card.label}</p><strong>{(data.returns?.[card.key] || 0).toLocaleString('th-TH')}{card.suffix || ''}</strong><small>{card.detail}</small>
            </article>
          })}
        </div>
      </section>

      <div className="dashboard-summary-grid">
        <section id="dashboard-helpdesk" className="dashboard-card dashboard-summary-card">
          <SectionHeading icon={Headphones} title="Helpdesk Summary" description="สถานะใบแจ้งซ่อมล่าสุด" />
          <div className="dashboard-ticket-summary">
            {TICKET_SUMMARY_CARDS.map((card) => {
              const CardIcon = card.icon
              return (
                <div className={`dashboard-summary-metric tone-${card.tone}`} key={card.key}>
                  <span><CardIcon size={18} aria-hidden="true" /></span>
                  <div><strong>{data.tickets[card.key]}</strong><small>{card.label}</small></div>
                </div>
              )
            })}
          </div>

          <div className="dashboard-subsection-title">
            <TicketCheck size={17} aria-hidden="true" />
            <strong>ใบแจ้งซ่อมล่าสุด</strong>
          </div>
          {data.recentTickets.length === 0 ? (
            <EmptyState icon={TicketCheck}>ยังไม่มีใบแจ้งซ่อม</EmptyState>
          ) : (
            <div className="dashboard-feed dashboard-ticket-feed">
              {data.recentTickets.slice(0, 5).map((ticket) => (
                <article className="dashboard-feed-item" key={ticket.id}>
                  <span className="dashboard-feed-icon tone-amber"><Headphones size={17} aria-hidden="true" /></span>
                  <div className="dashboard-feed-copy">
                    <div className="dashboard-feed-heading">
                      <strong>{ticket.ticketNumber}</strong>
                      <time>{formatDate(ticket.openedAt)}</time>
                    </div>
                    <p>{ticket.title} <span>· {ticket.asset.assetTag}</span></p>
                    <div className="dashboard-feed-badges">
                      <span className={`badge badge-ticket-${ticket.status.toLowerCase()}`}>{TICKET_STATUS_LABELS[ticket.status] || ticket.status}</span>
                      <span className={`badge badge-priority-${ticket.priority.toLowerCase()}`}>{TICKET_PRIORITY_LABELS[ticket.priority] || ticket.priority}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section id="dashboard-warranty" className="dashboard-card dashboard-summary-card">
          <SectionHeading icon={ShieldCheck} title="Warranty Summary" description="ภาพรวมการรับประกันครุภัณฑ์" />
          <div className="dashboard-warranty-list">
            {WARRANTY_ITEMS.map((item) => {
              const WarrantyIcon = item.icon
              const total = Object.values(data.warranty).reduce((sum, value) => sum + value, 0)
              const value = data.warranty[item.key]
              const percentage = total > 0 ? Math.round((value / total) * 100) : 0
              return (
                <div className={`dashboard-warranty-item tone-${item.tone}`} key={item.key}>
                  <span className="dashboard-warranty-icon"><WarrantyIcon size={20} aria-hidden="true" /></span>
                  <div className="dashboard-warranty-copy">
                    <div><strong>{item.label}</strong><b>{value}</b></div>
                    <div className="dashboard-warranty-track"><span style={{ width: `${percentage}%` }} /></div>
                    <small>{percentage}% ของครุภัณฑ์ที่มีข้อมูลประกัน</small>
                  </div>
                </div>
              )
            })}
          </div>

          {data.assets.utilization && (
            <div className="dashboard-utilization">
              <div className="dashboard-subsection-title">
                <Gauge size={17} aria-hidden="true" />
                <strong>การใช้งานครุภัณฑ์</strong>
              </div>
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
        </section>
      </div>

      {hasOrgWideCharts && (
        <section id="dashboard-charts" className="dashboard-block">
          <SectionHeading icon={BarChart3} title="Charts & Analytics" description="ข้อมูลเชิงลึกจากทุกส่วนขององค์กร" />
          {visibleCharts.length === 0 ? (
            <EmptyState icon={BarChart3}>ยังไม่มีข้อมูลสำหรับแสดงกราฟ</EmptyState>
          ) : (
            <div className="dashboard-chart-grid">
              {visibleCharts.map((chart) => (
                <article className="dashboard-card dashboard-chart-card" key={chart.key}>
                  <div className="dashboard-chart-heading">
                    <span><BarChart3 size={18} aria-hidden="true" /></span>
                    <h3>{chart.title}</h3>
                  </div>
                  <BarChart items={data.charts[chart.key]} />
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <div id="dashboard-activity" className="dashboard-bottom-grid">
        <section className="dashboard-card dashboard-feed-card">
          <SectionHeading icon={Activity} title="Recent Activity" description="ความเคลื่อนไหวล่าสุดของครุภัณฑ์" />
          {data.recentActivities.length === 0 ? (
            <EmptyState icon={Activity}>ยังไม่มีกิจกรรม</EmptyState>
          ) : (
            <div className="dashboard-feed">
              {data.recentActivities.map((item, index) => {
                const ActivityIcon = ACTIVITY_ICONS[item.type] || Activity
                return (
                  <article className="dashboard-feed-item" key={`${item.type}-${item.at}-${index}`}>
                    <span className="dashboard-feed-icon tone-blue"><ActivityIcon size={17} aria-hidden="true" /></span>
                    <div className="dashboard-feed-copy">
                      <div className="dashboard-feed-heading">
                        <span className={`badge badge-${item.type.toLowerCase().replace('_', '-')}`}>{ACTIVITY_TYPE_LABELS[item.type] || item.type}</span>
                        <time>{formatDate(item.at)}</time>
                      </div>
                      <p>{item.message}</p>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="dashboard-card dashboard-feed-card">
          <SectionHeading icon={History} title="Latest Audit Logs" description="เหตุการณ์สำคัญล่าสุดในระบบ" />
          {data.recentAuditLogs.length === 0 ? (
            <EmptyState icon={History}>{role === 'EMPLOYEE' ? 'ไม่มีสิทธิ์ดู Audit Log' : 'ยังไม่มี Audit Log'}</EmptyState>
          ) : (
            <div className="dashboard-feed">
              {data.recentAuditLogs.map((log) => (
                <article className="dashboard-feed-item" key={log.id}>
                  <span className="dashboard-feed-icon tone-violet"><UserRound size={17} aria-hidden="true" /></span>
                  <div className="dashboard-feed-copy">
                    <div className="dashboard-feed-heading">
                      <span className={`badge badge-audit-${log.action.toLowerCase().replace(/_/g, '-')}`}>{ACTION_LABELS[log.action] || log.action}</span>
                      <time>{formatDateTime(log.performedAt)}</time>
                    </div>
                    <p>
                      {ENTITY_TYPE_LABELS[log.entityType] || log.entityType} — {log.description || log.entityId || '-'}
                      <span> · {log.performedBy ? (log.performedBy.name || log.performedBy.email) : 'ระบบ/ไม่ทราบ'}</span>
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

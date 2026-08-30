import { useEffect, useRef, useState } from 'react'
import { BellRing, CheckCircle2, Mail, RefreshCw, Send, ShieldCheck } from 'lucide-react'
import { api } from '../api.js'
import './NotificationSettings.css'

const CATEGORY_OPTIONS = [
  ['borrowRequestEnabled', 'คำขอยืม', 'คำขอใหม่และการยืนยันรับคำขอ'],
  ['approvalEnabled', 'การอนุมัติ', 'ผลอนุมัติหรือปฏิเสธคำขอยืม'],
  ['assignmentEnabled', 'การมอบหมาย', 'เมื่อได้รับมอบหมายครุภัณฑ์'],
  ['returnEnabled', 'การรับคืน', 'ตรวจรับ คืนสำเร็จ ชำรุด หรือสูญหาย'],
  ['helpdeskEnabled', 'Helpdesk', 'ใบแจ้งปัญหาใหม่และข้อความยืนยัน'],
  ['reminderEnabled', 'กำหนดคืน', 'ใกล้ครบกำหนดและเกินกำหนดคืน'],
]

const EMPTY_SETTINGS = {
  notificationEmail: '',
  emailVerifiedAt: null,
  isEmailVerified: false,
  emailEnabled: false,
  inAppEnabled: true,
  borrowRequestEnabled: true,
  approvalEnabled: true,
  assignmentEnabled: true,
  returnEnabled: true,
  helpdeskEnabled: true,
  reminderEnabled: true,
  deliveryStatus: 'DISABLED',
}

function Toggle({ id, checked, disabled, title, description, onChange }) {
  return (
    <label className={`notification-setting-toggle${disabled ? ' is-disabled' : ''}`} htmlFor={id}>
      <span><strong>{title}</strong><small>{description}</small></span>
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true" />
    </label>
  )
}

export default function NotificationSettings() {
  const [settings, setSettings] = useState(EMPTY_SETTINGS)
  const [savedEmail, setSavedEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState('')
  const [message, setMessage] = useState(null)
  const confirmationStarted = useRef(false)

  useEffect(() => {
    let cancelled = false
    api.notificationSettings.get()
      .then((data) => {
        if (!cancelled) {
          const email = data.notificationEmail || ''
          setSettings({ ...EMPTY_SETTINGS, ...data, notificationEmail: email })
          setSavedEmail(email)
        }
      })
      .catch((error) => { if (!cancelled) setMessage({ type: 'error', text: error.message }) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (loading || confirmationStarted.current) return
    const params = new URLSearchParams(window.location.search)
    const token = params.get('verifyEmail')
    if (!token) return
    confirmationStarted.current = true
    setAction('confirm')
    api.notificationSettings.confirmEmail(token)
      .then((data) => {
        setSettings((current) => ({ ...current, ...data, notificationEmail: data.notificationEmail || '' }))
        setSavedEmail(data.notificationEmail || '')
        setMessage({ type: 'success', text: 'ยืนยันอีเมลสำหรับรับการแจ้งเตือนเรียบร้อยแล้ว' })
        params.delete('verifyEmail')
        const query = params.toString()
        window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`)
      })
      .catch((error) => setMessage({ type: 'error', text: error.message }))
      .finally(() => setAction(''))
  }, [loading])

  function updateField(field, value) {
    setSettings((current) => ({
      ...current,
      [field]: value,
      ...(field === 'notificationEmail' ? { isEmailVerified: false, emailVerifiedAt: null, emailEnabled: false } : {}),
    }))
    setMessage(null)
  }

  async function saveSettings(event) {
    event.preventDefault()
    setAction('save')
    setMessage(null)
    try {
      const data = await api.notificationSettings.update({
        notificationEmail: settings.notificationEmail,
        emailEnabled: settings.emailEnabled,
        inAppEnabled: settings.inAppEnabled,
        ...Object.fromEntries(CATEGORY_OPTIONS.map(([field]) => [field, settings[field]])),
      })
      setSettings((current) => ({ ...current, ...data, notificationEmail: data.notificationEmail || '' }))
      setSavedEmail(data.notificationEmail || '')
      setMessage({ type: 'success', text: 'บันทึกการตั้งค่าการแจ้งเตือนแล้ว' })
      window.dispatchEvent(new Event('notifications:refresh'))
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setAction('')
    }
  }

  async function requestVerification() {
    setAction('verify')
    setMessage(null)
    try {
      const result = await api.notificationSettings.requestVerification()
      const deliveryText = result.deliveryStatus === 'PENDING'
        ? 'ส่งลิงก์ยืนยันเข้าคิวแล้ว กรุณาตรวจสอบกล่องจดหมาย'
        : 'บันทึกคำขอแล้ว แต่ระบบส่งอีเมลยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ'
      setMessage({ type: result.deliveryStatus === 'PENDING' ? 'success' : 'warning', text: deliveryText })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setAction('')
    }
  }

  async function sendTest() {
    setAction('test')
    setMessage(null)
    try {
      const result = await api.notificationSettings.sendTest()
      setMessage({
        type: result.deliveryStatus === 'PENDING' ? 'success' : 'warning',
        text: result.deliveryStatus === 'PENDING' ? 'นำอีเมลทดสอบเข้าคิวแล้ว' : 'ระบบส่งอีเมลยังไม่พร้อมใช้งาน',
      })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setAction('')
    }
  }

  if (loading) return (
    <div className="notification-settings-skeleton" role="status" aria-live="polite">
      <span className="skeleton" /><span className="skeleton" /><span className="sr-only">กำลังโหลดการตั้งค่า...</span>
    </div>
  )

  const isBusy = Boolean(action)
  return (
    <section className="notification-settings-page" aria-labelledby="notification-settings-title">
      <header className="notification-settings-hero">
        <span className="notification-settings-icon"><BellRing aria-hidden="true" /></span>
        <div>
          <p>NOTIFICATION SETTINGS</p>
          <h2 id="notification-settings-title">เลือกวิธีรับการแจ้งเตือน</h2>
          <span>อีเมลแจ้งเตือนแยกจากอีเมลที่ใช้เข้าสู่ระบบ และคุณควบคุมแต่ละประเภทได้เอง</span>
        </div>
      </header>

      {message && <div className={`notification-settings-message is-${message.type}`} role={message.type === 'error' ? 'alert' : 'status'} aria-live="polite">{message.text}</div>}

      <form onSubmit={saveSettings}>
        <div className="notification-settings-grid">
          <section className="notification-settings-panel" aria-labelledby="delivery-heading">
            <div className="notification-settings-heading">
              <Mail aria-hidden="true" />
              <div><h3 id="delivery-heading">ช่องทางการแจ้งเตือน</h3><p>เลือกเปิด In-app และ Email ได้อย่างอิสระ</p></div>
            </div>

            <Toggle id="setting-in-app" checked={settings.inAppEnabled} title="Notification Bell" description="แสดงการแจ้งเตือนภายในระบบ" onChange={(value) => updateField('inAppEnabled', value)} />

            <div className="notification-email-field">
              <label htmlFor="notification-email">อีเมลสำหรับรับแจ้งเตือน</label>
              <div className="notification-email-input-row">
                <input
                  className="input"
                  id="notification-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  maxLength="254"
                  value={settings.notificationEmail}
                  onChange={(event) => updateField('notificationEmail', event.target.value)}
                  placeholder="name@company.com"
                  aria-describedby="notification-email-help notification-email-status"
                />
                <span id="notification-email-status" className={`notification-verification-badge${settings.isEmailVerified ? ' is-verified' : ''}`}>
                  {settings.isEmailVerified ? <><CheckCircle2 aria-hidden="true" /> ยืนยันแล้ว</> : 'ยังไม่ยืนยัน'}
                </span>
              </div>
              <small id="notification-email-help">เปลี่ยนอีเมลแล้วต้องกดบันทึกและยืนยันใหม่ โดยไม่กระทบอีเมล Login</small>
            </div>

            <div className="notification-email-actions">
              <button className="btn btn-outline" type="button" disabled={!settings.notificationEmail || settings.notificationEmail !== savedEmail || settings.isEmailVerified || isBusy} onClick={requestVerification}>
                {action === 'verify' ? <RefreshCw className="spin" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />} ส่งอีเมลยืนยัน
              </button>
              <button className="btn btn-ghost" type="button" disabled={!settings.isEmailVerified || isBusy} onClick={sendTest}>
                {action === 'test' ? <RefreshCw className="spin" aria-hidden="true" /> : <Send aria-hidden="true" />} ส่งอีเมลทดสอบ
              </button>
            </div>

            <Toggle id="setting-email" checked={settings.emailEnabled} disabled={!settings.isEmailVerified} title="Email Notification" description={settings.isEmailVerified ? 'ส่งอีเมลตามประเภทที่เลือกด้านขวา' : 'ยืนยันอีเมลก่อนเปิดใช้งาน'} onChange={(value) => updateField('emailEnabled', value)} />

            <div className={`notification-provider-status is-${settings.deliveryStatus.toLowerCase()}`}>
              <span aria-hidden="true" />
              {settings.deliveryStatus === 'READY' ? 'บริการส่งอีเมลพร้อมใช้งาน' : settings.deliveryStatus === 'NOT_CONFIGURED' ? 'เปิดระบบแล้ว แต่ Provider ยังตั้งค่าไม่ครบ' : 'บริการส่งอีเมลถูกปิดอยู่'}
            </div>
          </section>

          <section className="notification-settings-panel" aria-labelledby="category-heading">
            <div className="notification-settings-heading">
              <BellRing aria-hidden="true" />
              <div><h3 id="category-heading">ประเภทการแจ้งเตือน</h3><p>ใช้กับทั้ง Notification Bell และ Email</p></div>
            </div>
            <div className="notification-category-list">
              {CATEGORY_OPTIONS.map(([field, title, description]) => (
                <Toggle key={field} id={`setting-${field}`} checked={settings[field]} title={title} description={description} onChange={(value) => updateField(field, value)} />
              ))}
            </div>
          </section>
        </div>

        <footer className="notification-settings-footer">
          <p><ShieldCheck aria-hidden="true" /> ระบบไม่ส่งรหัสผ่าน, JWT หรือข้อมูลลับผ่านอีเมล</p>
          <button className="btn btn-primary" type="submit" disabled={isBusy} aria-busy={action === 'save'}>
            {action === 'save' ? <RefreshCw className="spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />} บันทึกการตั้งค่า
          </button>
        </footer>
      </form>
    </section>
  )
}

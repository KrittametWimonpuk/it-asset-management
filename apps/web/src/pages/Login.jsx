// หน้าเข้าสู่ระบบ
import { useState } from 'react'
import { api } from '../api.js'
import './Login.css'

export default function Login({ onAuthed, goRegister }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [help, setHelp] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()          // กันไม่ให้หน้า reload
    setError('')
    setHelp('')
    setBusy(true)
    try {
      const data = await api.login({ email, password })
      onAuthed(data)            // สำเร็จ -> ส่ง token+user กลับไปให้ App
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-visual" aria-label="ระบบจัดการครุภัณฑ์ไอทีสำหรับองค์กร">
        <div className="login-visual-glow login-visual-glow-one" />
        <div className="login-visual-glow login-visual-glow-two" />

        <header className="login-brand">
          <span className="login-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" role="img">
              <path d="M16 3 27 7v8c0 7.1-4.4 11.5-11 14-6.6-2.5-11-6.9-11-14V7l11-4Z" />
              <path d="m11.5 16 3 3 6.5-7" />
            </svg>
          </span>
          <span>
            <strong>IT Asset Management</strong>
            <small>Enterprise Platform</small>
          </span>
        </header>

        <div className="login-visual-content">
          <div className="login-illustration-frame">
            <img
              src="/images/enterprise-asset-illustration.png"
              alt="ภาพประกอบระบบจัดการอุปกรณ์ไอที เครือข่าย เซิร์ฟเวอร์ และความปลอดภัย"
            />
          </div>
          <div className="login-visual-copy">
            <span className="login-eyebrow">Smart · Secure · Connected</span>
            <h2>จัดการครุภัณฑ์ไอที<br />อย่างเป็นระบบ</h2>
            <p>ติดตามอุปกรณ์ การมอบหมาย และงานบริการไอทีขององค์กรได้ในที่เดียว</p>
          </div>
        </div>

        <footer className="login-version">Version 1.0.0 · Stable</footer>
      </section>

      <section className="login-form-panel">
        <div className="login-mobile-brand" aria-hidden="true">
          <span className="login-brand-mark">
            <svg viewBox="0 0 32 32">
              <path d="M16 3 27 7v8c0 7.1-4.4 11.5-11 14-6.6-2.5-11-6.9-11-14V7l11-4Z" />
              <path d="m11.5 16 3 3 6.5-7" />
            </svg>
          </span>
          <strong>IT Asset Management</strong>
        </div>

        <div className="login-card">
          <div className="login-heading">
            <span className="login-welcome">ยินดีต้อนรับกลับ</span>
            <h1>เข้าสู่ระบบ</h1>
            <p>กรอกข้อมูลบัญชีของคุณเพื่อเข้าสู่ระบบจัดการครุภัณฑ์</p>
          </div>

          <form className="login-form" onSubmit={submit}>
            <div className="login-field">
              <label htmlFor="login-email">อีเมล</label>
              <div className="login-input-wrap">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 6h16v12H4z" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  autoComplete="email"
                  aria-describedby={error ? 'login-error' : undefined}
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="login-password">รหัสผ่าน</label>
              <div className="login-input-wrap">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่าน"
                  autoComplete="current-password"
                  aria-describedby={error ? 'login-error' : undefined}
                  required
                />
              </div>
            </div>

            <div className="login-options">
              <label className="login-checkbox">
                <input type="checkbox" name="remember" defaultChecked />
                <span>จดจำฉันไว้</span>
              </label>
              <button
                className="login-forgot"
                type="button"
                onClick={() => setHelp('กรุณาติดต่อผู้ดูแลระบบเพื่อรีเซ็ตรหัสผ่าน')}
              >
                ลืมรหัสผ่าน?
              </button>
            </div>

            {error && <p id="login-error" className="login-alert login-alert-error" role="alert">{error}</p>}
            {help && <p className="login-alert login-alert-info" role="status">{help}</p>}

            <button className="login-submit" type="submit" disabled={busy} aria-busy={busy}>
              <span>{busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</span>
              {!busy && (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12h14M14 7l5 5-5 5" />
                </svg>
              )}
            </button>
          </form>

          <div className="login-divider"><span>หรือ</span></div>

          <p className="login-register">
            ยังไม่มีบัญชี?
            <button className="login-register-link" type="button" onClick={goRegister}>สมัครสมาชิก</button>
          </p>
        </div>

        <p className="login-security-note">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3 20 6v6c0 5-3.2 8.1-8 10-4.8-1.9-8-5-8-10V6l8-3Z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          การเชื่อมต่อได้รับการปกป้องและเข้ารหัส
        </p>
        <p className="login-mobile-version">Version 1.0.0 · Stable</p>
      </section>
    </main>
  )
}

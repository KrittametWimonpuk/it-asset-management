// หน้าสมัครสมาชิก
import { useState } from 'react'
import { ArrowLeft, ArrowRight, LockKeyhole, Mail, ShieldCheck, UserRound, UserRoundPlus } from 'lucide-react'
import { api } from '../api.js'
import './Register.css'

export default function Register({ onAuthed, goLogin }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const data = await api.register({ name, email, password })
      onAuthed(data)          // สมัครเสร็จ ล็อกอินให้อัตโนมัติเลย
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="register-page">
      <section className="register-panel">
        <div className="register-brand"><span><ShieldCheck size={23} /></span><div><strong>IT Asset Management</strong><small>Enterprise Platform · v1.1.0</small></div></div>
        <div className="register-heading"><span><UserRoundPlus size={16} /> Create account</span><h1>สมัครสมาชิก</h1><p>สร้างบัญชีเพื่อเริ่มใช้งานระบบจัดการครุภัณฑ์</p></div>
        <form onSubmit={submit}>
          <label htmlFor="register-name">ชื่อ</label><div className="register-input"><UserRound size={17} /><input id="register-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>

          <label htmlFor="register-email">อีเมล</label><div className="register-input"><Mail size={17} /><input id="register-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>

          <label htmlFor="register-password">รหัสผ่าน <small>อย่างน้อย 8 ตัว</small></label><div className="register-input"><LockKeyhole size={17} /><input id="register-password" type="password" autoComplete="new-password" minLength="8" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>

          {error && <p className="register-error" role="alert">{error}</p>}

          <button className="register-submit" type="submit" disabled={busy} aria-busy={busy}>{busy ? 'กำลังสมัคร...' : <><span>สมัครสมาชิก</span><ArrowRight size={17} /></>}</button>
        </form>
        <button className="register-back" type="button" onClick={goLogin}><ArrowLeft size={15} /> มีบัญชีอยู่แล้ว? เข้าสู่ระบบ</button>
      </section>
    </main>
  )
}

import { ArrowRight, CalendarClock, FileClock, Globe2, UserRound, X } from 'lucide-react'
import { formatDateTime } from '../utils/format.js'
import { ACTION_LABELS, ENTITY_TYPE_LABELS } from '../utils/auditLabels.js'

function displayValue(value) {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

export default function AuditLogDetail({ log, onClose }) {
  const oldValues = log.oldValues || {}
  const newValues = log.newValues || {}
  const fields = [...new Set([...Object.keys(oldValues), ...Object.keys(newValues)])]
    .filter((field) => displayValue(oldValues[field]) !== displayValue(newValues[field]))

  return <div className="overlay audit-diff-overlay" onClick={onClose} role="presentation">
    <div className="audit-diff-modal" role="dialog" aria-modal="true" aria-labelledby="audit-diff-title" onClick={(event) => event.stopPropagation()}>
      <header className="audit-diff-header">
        <div><span><FileClock size={18} /></span><div><small>Audit evidence</small><h2 id="audit-diff-title">รายละเอียดการเปลี่ยนแปลง</h2></div></div>
        <button type="button" aria-label="ปิดหน้าต่าง" onClick={onClose}><X size={19} /></button>
      </header>
      <div className="audit-diff-summary">
        <div className="audit-diff-title"><span>{ACTION_LABELS[log.action] || log.action}</span><b>{ENTITY_TYPE_LABELS[log.entityType] || log.entityType}</b>{log.entityId && <code>{log.entityId}</code>}</div>
        {log.description && <p>{log.description}</p>}
        <div className="audit-diff-meta"><span><CalendarClock size={14} />{formatDateTime(log.performedAt)}</span><span><UserRound size={14} />{log.performedBy ? (log.performedBy.name || log.performedBy.email) : 'ระบบ/ไม่ทราบ'}</span><span><Globe2 size={14} />{log.ipAddress || 'ไม่ระบุ IP'}</span></div>
      </div>
      <div className="audit-diff-content">
        <div className="audit-diff-columns"><span>ฟิลด์</span><span>ค่าก่อนแก้ไข</span><span></span><span>ค่าหลังแก้ไข</span></div>
        {fields.length ? <div className="audit-diff-rows">{fields.map((field) => {
          const before = displayValue(oldValues[field])
          const after = displayValue(newValues[field])
          return <div className="audit-diff-row is-changed" key={field}><strong>{field}</strong><pre>{before}</pre><span><ArrowRight size={15} /></span><pre>{after}</pre></div>
        })}</div> : <div className="audit-diff-none"><FileClock size={24} /><strong>เหตุการณ์นี้ไม่มีค่าก่อน–หลัง</strong><p>รายละเอียดการกระทำถูกบันทึกไว้ในข้อมูลสรุปด้านบน</p></div>}
      </div>
      <footer className="audit-diff-footer"><span>ข้อมูล Audit Log เป็นแบบอ่านอย่างเดียวและแก้ไขไม่ได้</span><button type="button" onClick={onClose}>ปิด</button></footer>
    </div>
  </div>
}

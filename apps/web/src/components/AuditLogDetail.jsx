// ---------------------------------------------------------------------------
// AuditLogDetail — Milestone 9: กล่องรายละเอียด audit log หนึ่งแถว
// แสดงค่าก่อน/หลังแก้ไข (oldValues/newValues) เป็น JSON ที่จัดรูปแบบอ่านง่าย — อ่านอย่างเดียว ไม่มีการแก้ไข
// ---------------------------------------------------------------------------
import { formatDateTime } from '../utils/format.js'
import { ACTION_LABELS, ENTITY_TYPE_LABELS } from '../utils/auditLabels.js'

function JsonBlock({ value }) {
  if (value === null || value === undefined) {
    return <p className="muted">— ไม่มีข้อมูล —</p>
  }
  return <pre className="json-viewer">{JSON.stringify(value, null, 2)}</pre>
}

export default function AuditLogDetail({ log, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal audit-detail-modal" onClick={(e) => e.stopPropagation()}>
        <h2>รายละเอียด Audit Log</h2>

        <div className="audit-detail-meta mt">
          <div><span className="muted">เวลา:</span> {formatDateTime(log.performedAt)}</div>
          <div><span className="muted">ผู้ทำรายการ:</span> {log.performedBy ? (log.performedBy.name || log.performedBy.email) : 'ระบบ/ไม่ทราบ'}</div>
          <div><span className="muted">การกระทำ:</span> {ACTION_LABELS[log.action] || log.action}</div>
          <div><span className="muted">ประเภท:</span> {ENTITY_TYPE_LABELS[log.entityType] || log.entityType}{log.entityId ? ` (${log.entityId})` : ''}</div>
          {log.description && <div><span className="muted">รายละเอียด:</span> {log.description}</div>}
          {log.ipAddress && <div><span className="muted">IP Address:</span> {log.ipAddress}</div>}
        </div>

        <div className="audit-detail-json mt">
          <div>
            <h3>ค่าก่อนแก้ไข (oldValues)</h3>
            <JsonBlock value={log.oldValues} />
          </div>
          <div>
            <h3>ค่าหลังแก้ไข (newValues)</h3>
            <JsonBlock value={log.newValues} />
          </div>
        </div>

        <div className="row mt end">
          <button className="secondary" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  )
}

const TEMPLATE_LABELS = {
  BORROW_REQUEST_SUBMITTED: 'คำขอยืมใหม่',
  BORROW_REQUEST_APPROVED: 'คำขอยืมได้รับอนุมัติ',
  BORROW_REQUEST_REJECTED: 'คำขอยืมไม่ได้รับอนุมัติ',
  ASSET_ASSIGNED: 'การมอบหมายครุภัณฑ์',
  UPCOMING_DUE_DATE: 'ใกล้ถึงกำหนดคืน',
  OVERDUE_ASSET: 'ครุภัณฑ์เกินกำหนดคืน',
  RETURN_INSPECTION_PENDING: 'รอตรวจรับคืน',
  RETURN_COMPLETED: 'รับคืนครุภัณฑ์เรียบร้อย',
  RETURN_DAMAGED: 'ครุภัณฑ์รับคืนแบบชำรุด',
  RETURN_LOST: 'รายงานครุภัณฑ์สูญหาย',
  HELPDESK_NEW: 'ใบแจ้งปัญหาใหม่',
  HELPDESK_CONFIRMATION: 'ยืนยันการรับแจ้งปัญหา',
  EMAIL_VERIFICATION: 'ยืนยันอีเมลแจ้งเตือน',
  TEST_EMAIL: 'ทดสอบการแจ้งเตือนทางอีเมล',
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function safeActionUrl(value) {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

export function buildEmailTemplate({ templateKey, title, message, actionUrl, actionLabel = 'กลับไปยังระบบ' }) {
  const category = TEMPLATE_LABELS[templateKey] || 'การแจ้งเตือนจากระบบ'
  const cleanTitle = String(title || category).replace(/[\r\n]+/g, ' ').trim().slice(0, 200)
  const cleanMessage = String(message || '').trim().slice(0, 4000)
  const safeUrl = safeActionUrl(actionUrl)
  const button = safeUrl
    ? `<a href="${escapeHtml(safeUrl)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700">${escapeHtml(actionLabel)}</a>`
    : ''
  const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f8fafc;color:#0f172a;font-family:Inter,'Noto Sans Thai',Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(cleanMessage)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 10px 30px rgba(15,23,42,.08)">
      <tr><td style="padding:28px 32px 18px;background:linear-gradient(135deg,#0f172a,#1d4ed8);border-radius:16px 16px 0 0;color:#fff">
        <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.82">Enterprise IT Asset Management</div>
        <div style="font-size:22px;font-weight:800;margin-top:8px">${escapeHtml(category)}</div>
      </td></tr>
      <tr><td style="padding:30px 32px">
        <h1 style="font-size:24px;line-height:1.35;margin:0 0 14px">${escapeHtml(cleanTitle)}</h1>
        <p style="font-size:16px;line-height:1.75;color:#475569;margin:0 0 24px;white-space:pre-line">${escapeHtml(cleanMessage)}</p>
        ${button}
      </td></tr>
      <tr><td style="padding:18px 32px;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px;line-height:1.6">
        อีเมลนี้ส่งโดยระบบอัตโนมัติ กรุณาอย่าส่งรหัสผ่านหรือข้อมูลลับตอบกลับอีเมลนี้
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`
  const text = [
    'Enterprise IT Asset Management', category, '', cleanTitle, '', cleanMessage,
    safeUrl ? `\n${actionLabel}: ${safeUrl}` : '',
    '\nอีเมลนี้ส่งโดยระบบอัตโนมัติ กรุณาอย่าส่งรหัสผ่านหรือข้อมูลลับตอบกลับอีเมลนี้',
  ].join('\n').trim()
  return { subject: cleanTitle, html, text }
}

export const EMAIL_TEMPLATE_KEYS = Object.freeze(Object.keys(TEMPLATE_LABELS))

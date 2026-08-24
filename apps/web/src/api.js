// ---------------------------------------------------------------------------
// ตัวช่วยเรียก API — รวมโค้ด fetch ไว้ที่เดียว
//
// - เก็บ token ไว้ใน localStorage (ค้างแม้ปิดเบราว์เซอร์)
// - แนบ header Authorization ให้อัตโนมัติทุกครั้งที่มี token
// - Backend ตอบกลับด้วยรูปแบบเดียวกันเสมอ:
//     สำเร็จ   { success: true, data: ... }         -> คืนแค่ data ให้หน้าจอใช้ตรง ๆ
//     ผิดพลาด  { success: false, message, errors }  -> throw Error(message) พร้อมแนบ .errors ไว้ด้วย
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'token'

export const auth = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  const token = auth.get()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`/api${path}`, { ...options, headers })
  const body = await res.json().catch(() => ({}))

  if (!res.ok || !body.success) {
    const err = new Error(body.message || 'เกิดข้อผิดพลาด')
    err.errors = body.errors || null   // รายการ { field, message } ถ้ามี — ใช้โชว์ error รายฟิลด์ในฟอร์ม
    throw err
  }
  return body.data
}

// แปลง object ธรรมดา { page: 1, search: 'dell' } ให้เป็น query string
// ข้าม key ที่เป็น undefined/null/สตริงว่าง เพื่อไม่ให้ยิง ?search=&sortBy= เปล่า ๆ ไปโดยไม่จำเป็น
function toQueryString(params = {}) {
  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    usp.set(key, value)
  }
  const qs = usp.toString()
  return qs ? `?${qs}` : ''
}

// Milestone 8: ดาวน์โหลดไฟล์รายงาน (CSV/Excel/PDF) — ต่างจาก request() ตรงที่ response ไม่ใช่ JSON
// envelope แต่เป็นไฟล์ตรง ๆ จึงต้อง fetch เองแทนเรียก request(), อ่านชื่อไฟล์จาก Content-Disposition
// ที่ backend ตั้งมาให้ แล้วจำลองคลิกลิงก์ดาวน์โหลด (วิธีมาตรฐานที่สุดสำหรับดาวน์โหลดไฟล์ที่ต้องแนบ
// Authorization header ด้วย — จะใช้ <a href> ตรง ๆ ไม่ได้เพราะ browser ไม่แนบ header ให้ตอนคลิกลิงก์)
async function downloadReport(reportKey, params, format) {
  const headers = {}
  const token = auth.get()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`/api/reports/${reportKey}${toQueryString({ ...params, format })}`, { headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error(body.message || 'ไม่สามารถส่งออกรายงานได้')
    err.errors = body.errors || null
    throw err
  }

  const blob = await res.blob()
  const match = (res.headers.get('Content-Disposition') || '').match(/filename="?([^"]+)"?/)
  const filename = match ? match[1] : `${reportKey}-report.${format}`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// สร้างชุดฟังก์ชัน list/get/add/update/delete ให้ entity ที่มี REST pattern เดียวกัน
// (Category/Location/Department/Vendor ทำงานเหมือนกันทุกตัว ต่างแค่ path) — กันไม่ต้องเขียนซ้ำ 4 รอบ
function createEntityApi(basePath) {
  return {
    list: (params) => request(`${basePath}${toQueryString(params)}`),
    get: (id) => request(`${basePath}/${id}`),
    add: (body) => request(basePath, { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`${basePath}/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id) => request(`${basePath}/${id}`, { method: 'DELETE' }),
  }
}

// รวม endpoint ทั้งหมดไว้เป็นฟังก์ชันสั้น ๆ ให้หน้าจอเรียกง่าย
export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),

  // params รองรับ: page, pageSize, sortBy, sortOrder, search
  listAssets: (params) => request(`/assets${toQueryString(params)}`),
  getAsset: (id) => request(`/assets/${id}`),
  addAsset: (body) => request('/assets', { method: 'POST', body: JSON.stringify(body) }),
  updateAsset: (id, body) => request(`/assets/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteAsset: (id) => request(`/assets/${id}`, { method: 'DELETE' }),

  // master data — แต่ละตัวรองรับ params: page, pageSize, sortBy, sortOrder, search, isActive
  categories: createEntityApi('/categories'),
  locations: createEntityApi('/locations'),
  departments: createEntityApi('/departments'),
  vendors: createEntityApi('/vendors'),

  // Milestone 5: มอบหมาย/รับคืนครุภัณฑ์ — params รองรับ: page, pageSize, sortBy, sortOrder, search, status, assetId, userId
  // (เขียนเองแทน createEntityApi เพราะ backend ไม่มี DELETE /assignments/:id — ประวัติการมอบหมายห้ามลบ)
  assignments: {
    list: (params) => request(`/assignments${toQueryString(params)}`),
    get: (id) => request(`/assignments/${id}`),
    add: (body) => request('/assignments', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/assignments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    return: (id, body) => request(`/assignments/${id}/return`, { method: 'POST', body: JSON.stringify(body) }),
  },

  // Milestone 5: รายชื่อผู้ใช้ (ดูอย่างเดียว) — ใช้เลือก "พนักงาน" ตอนมอบหมายครุภัณฑ์
  users: {
    list: (params) => request(`/users${toQueryString(params)}`),
  },

  // v1.1.0 Phase 1: ข้อมูลพนักงานแยกจากบัญชี User — Assignment ยังอ้าง User เหมือนเดิม
  employees: {
    ...createEntityApi('/employees'),
    restore: (id) => request(`/employees/${id}/restore`, { method: 'POST' }),
  },

  // Milestone 6: ข้อมูลรวมสำหรับแดชบอร์ด — ยิงครั้งเดียวได้ทุกอย่าง (การ์ดสรุป/กราฟ/กิจกรรมล่าสุด)
  dashboard: {
    get: () => request('/dashboard'),
  },

  // Milestone 7: ใบแจ้งซ่อม/ปัญหาครุภัณฑ์ — params รองรับ: page, pageSize, sortBy, sortOrder, search,
  // priority, status, category, assignedToId, reportedById, assetId
  // (เขียนเองแทน createEntityApi เพราะ backend ไม่มี DELETE /tickets/:id — ประวัติใบแจ้งซ่อมห้ามลบ
  // เหมือนแพทเทิร์นเดียวกับ assignments ด้านบน)
  tickets: {
    list: (params) => request(`/tickets${toQueryString(params)}`),
    get: (id) => request(`/tickets/${id}`),
    add: (body) => request('/tickets', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/tickets/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    resolve: (id, body) => request(`/tickets/${id}/resolve`, { method: 'POST', body: JSON.stringify(body) }),
    close: (id, body) => request(`/tickets/${id}/close`, { method: 'POST', body: JSON.stringify(body) }),
  },

  // Milestone 8: รายงาน — แต่ละตัว preview เป็น JSON ตามปกติ (page/pageSize/sortBy/sortOrder + ตัวกรอง
  // เฉพาะของรายงานนั้น) ส่วน download() ยิง endpoint เดียวกันแต่แนบ ?format=csv|xlsx|pdf แล้วดาวน์โหลด
  // ไฟล์แทนที่จะ parse เป็น JSON (ดู downloadReport ด้านบน)
  reports: {
    assets: (params) => request(`/reports/assets${toQueryString(params)}`),
    assignments: (params) => request(`/reports/assignments${toQueryString(params)}`),
    warranty: (params) => request(`/reports/warranty${toQueryString(params)}`),
    helpdesk: (params) => request(`/reports/helpdesk${toQueryString(params)}`),
    departments: (params) => request(`/reports/departments${toQueryString(params)}`),
    vendors: (params) => request(`/reports/vendors${toQueryString(params)}`),
    download: (reportKey, params, format) => downloadReport(reportKey, params, format),
  },

  // Milestone 9: Audit Log — อ่านอย่างเดียว (ไม่มี add/update/remove — ประวัติแก้ไข/ลบไม่ได้)
  // params รองรับ: page, pageSize, action, entityType, performedBy, dateFrom, dateTo, search
  audit: {
    list: (params) => request(`/audit${toQueryString(params)}`),
    get: (id) => request(`/audit/${id}`),
  },
}

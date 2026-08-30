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

// Cloudflare Pages injects VITE_API_URL at build time. Development keeps an explicit
// localhost fallback, while legacy same-origin deployments (Docker/nginx) use an
// absolute window.location.origin URL. Requests are therefore never sent with a
// relative "/api/..." URL in a production browser.
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()
const fallbackApiUrl = import.meta.env.DEV
  ? 'http://localhost:4000'
  : globalThis.location?.origin
const API_BASE_URL = (configuredApiUrl || fallbackApiUrl || '').replace(/\/+$/, '')

function apiUrl(path) {
  if (!API_BASE_URL) {
    throw new Error('ไม่ได้ตั้งค่า VITE_API_URL สำหรับการเชื่อมต่อ API')
  }
  return `${API_BASE_URL}/api${path}`
}

export const auth = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  const token = auth.get()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(apiUrl(path), {
    ...options,
    headers,
  })
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

  const res = await fetch(apiUrl(`/reports/${reportKey}${toQueryString({ ...params, format })}`), { headers })
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

  // v1.1 Phase 2: params รองรับ employeeId; userId เดิมยังรับได้เพื่อ backward compatibility
  // (เขียนเองแทน createEntityApi เพราะ backend ไม่มี DELETE /assignments/:id — ประวัติการมอบหมายห้ามลบ)
  assignments: {
    list: (params) => request(`/assignments${toQueryString(params)}`),
    get: (id) => request(`/assignments/${id}`),
    add: (body) => request('/assignments', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/assignments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    return: (id, body) => request(`/assignments/${id}/return`, { method: 'POST', body: JSON.stringify(body) }),
    startReturn: (id, body = {}) => request(`/assignments/${id}/return/start`, { method: 'POST', body: JSON.stringify(body) }),
    inspectReturn: (id, body) => request(`/assignments/${id}/return/inspect`, { method: 'POST', body: JSON.stringify(body) }),
  },

  // รายชื่อผู้ใช้สำหรับตัวเลือกต่าง ๆ และการจัดการ RBAC โดย ADMIN
  users: {
    list: (params) => request(`/users${toQueryString(params)}`),
    updateRole: (id, role) => request(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  },

  // v1.1.0: ข้อมูลพนักงานและ business identity ของผู้ถือครองครุภัณฑ์
  employees: {
    ...createEntityApi('/employees'),
    restore: (id) => request(`/employees/${id}/restore`, { method: 'POST' }),
  },

  // v1.1.0 Phase 3: คำขอยืมก่อนสร้าง Assignment
  borrowRequests: {
    list: (params) => request(`/borrow-requests${toQueryString(params)}`),
    get: (id) => request(`/borrow-requests/${id}`),
    add: (body) => request('/borrow-requests', { method: 'POST', body: JSON.stringify(body) }),
    approve: (id, body = {}) => request(`/borrow-requests/${id}/approve`, { method: 'POST', body: JSON.stringify(body) }),
    reject: (id, body) => request(`/borrow-requests/${id}/reject`, { method: 'POST', body: JSON.stringify(body) }),
    cancel: (id) => request(`/borrow-requests/${id}/cancel`, { method: 'POST' }),
    availableAssets: (params) => request(`/borrow-requests/options/assets${toQueryString(params)}`),
  },

  // v1.1.0 Beta 1: user-scoped operational notifications
  notifications: {
    list: (params) => request(`/notifications${toQueryString(params)}`),
    unreadCount: () => request('/notifications/unread-count'),
    markRead: (id) => request(`/notifications/${id}/read`, { method: 'POST' }),
    markAllRead: () => request('/notifications/read-all', { method: 'POST' }),
    remove: (id) => request(`/notifications/${id}`, { method: 'DELETE' }),
  },

  notificationSettings: {
    get: () => request('/settings/notifications'),
    update: (body) => request('/settings/notifications', { method: 'PUT', body: JSON.stringify(body) }),
    requestVerification: () => request('/settings/notifications/email/verify', { method: 'POST' }),
    confirmEmail: (token) => request('/settings/notifications/email/confirm', { method: 'POST', body: JSON.stringify({ token }) }),
    sendTest: () => request('/settings/notifications/email/test', { method: 'POST' }),
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
    borrowRequests: (params) => request(`/reports/borrow-requests${toQueryString(params)}`),
    approvals: (params) => request(`/reports/approvals${toQueryString(params)}`),
    returns: (params) => request(`/reports/returns${toQueryString(params)}`),
    notifications: (params) => request(`/reports/notifications${toQueryString(params)}`),
    download: (reportKey, params, format) => downloadReport(reportKey, params, format),
  },

  // Milestone 9: Audit Log — อ่านอย่างเดียว (ไม่มี add/update/remove — ประวัติแก้ไข/ลบไม่ได้)
  // params รองรับ: page, pageSize, action, entityType, performedBy, dateFrom, dateTo, search
  audit: {
    list: (params) => request(`/audit${toQueryString(params)}`),
    get: (id) => request(`/audit/${id}`),
  },
}

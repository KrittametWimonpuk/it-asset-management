// ---------------------------------------------------------------------------
// Query param helpers — แปลง query string (?page=1&pageSize=20&sortBy=...)
// ให้เป็นค่าที่ปลอดภัยและมี default ที่เหมาะสม ใช้ร่วมกันได้ทุก list endpoint
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

// ---- แปลง page / pageSize ----
// กัน input แปลก ๆ เช่น page=0, pageSize=-5, pageSize=99999, page=abc
export function parsePagination(query) {
  let page = parseInt(query.page, 10)
  if (!Number.isFinite(page) || page < 1) page = 1

  let pageSize = parseInt(query.pageSize, 10)
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = DEFAULT_PAGE_SIZE
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize }
}

// ---- แปลง sortBy / sortOrder ----
// allowedFields = รายชื่อฟิลด์ที่ยอมให้ sort ได้ (กัน sort field ที่ไม่มีอยู่จริงหรือเป็นช่องโหว่)
export function parseSort(query, allowedFields, defaultField) {
  const sortBy = allowedFields.includes(query.sortBy) ? query.sortBy : defaultField
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc'
  return { [sortBy]: sortOrder }
}

// ---- สร้างข้อมูลสรุปหน้า สำหรับใส่ใน response ----
export function buildPageMeta({ page, pageSize }, totalItems) {
  return {
    page,
    pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
  }
}

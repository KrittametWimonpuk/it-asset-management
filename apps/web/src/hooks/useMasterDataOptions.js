// ---------------------------------------------------------------------------
// useMasterDataOptions — โหลดตัวเลือก master data ทั้ง 4 ตัว (Category/Location/Department/Vendor)
// เฉพาะที่ isActive ครั้งเดียวตอน mount แล้วคืนให้ใช้ร่วมกัน
//
// ดึงออกมาจาก AssetForm (Milestone 1-3) เพื่อใช้ซ้ำกับ filter bar ของหน้ารายการ asset ได้ด้วย
// (Milestone 4.1) โดยไม่ต้องเขียน loading logic ซ้ำสองที่
// ---------------------------------------------------------------------------
import { useState, useEffect } from 'react'
import { api } from '../api.js'

const MASTER_DATA_APIS = [
  { key: 'categoryId', entityApi: api.categories },
  { key: 'locationId', entityApi: api.locations },
  { key: 'departmentId', entityApi: api.departments },
  { key: 'vendorId', entityApi: api.vendors },
]

// คืนค่า { options, error } — options เป็น null ระหว่างโหลด ไม่งั้นเป็น { categoryId: [...], locationId: [...], ... }
export function useMasterDataOptions() {
  const [options, setOptions] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all(
      MASTER_DATA_APIS.map((f) =>
        f.entityApi.list({ isActive: true, pageSize: 100, sortBy: 'name', sortOrder: 'asc' })
      )
    )
      .then((results) => {
        if (cancelled) return
        const next = {}
        MASTER_DATA_APIS.forEach((f, i) => { next[f.key] = results[i].items })
        setOptions(next)
      })
      .catch((err) => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [])

  return { options, error }
}

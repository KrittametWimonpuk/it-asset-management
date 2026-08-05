// ---------------------------------------------------------------------------
// Zod helpers ที่ใช้ซ้ำได้หลายที่ — เก็บไว้ที่เดียวกันความ validation จะได้สม่ำเสมอ
// ---------------------------------------------------------------------------
import { z } from 'zod'

// ฟิลด์ text ที่ไม่บังคับ — ตัดช่องว่างหัว-ท้าย แล้วถ้าเหลือว่างให้กลายเป็น null
// (กันกรณี frontend ส่งสตริงว่างมาแทนที่จะเป็น null)
export function optionalText() {
  return z.string().trim().optional().nullable().transform((v) => (v ? v : null))
}

// ฟิลด์อีเมลที่ไม่บังคับ — ถ้ามีค่าต้องเป็นอีเมลที่ถูกต้อง ถ้าว่างให้กลายเป็น null
export function optionalEmail() {
  return z.union([z.string().trim().email('อีเมลไม่ถูกต้อง'), z.literal('')])
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
}

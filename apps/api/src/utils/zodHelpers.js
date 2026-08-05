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

// ฟิลด์วันที่ที่ไม่บังคับ (จาก <input type="date">) — ว่าง/ไม่ส่งมา -> null, มีค่าต้อง parse เป็นวันที่ได้จริง
export function optionalDate(message = 'วันที่ไม่ถูกต้อง') {
  return z.string().trim().optional().nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || !Number.isNaN(Date.parse(v)), { message })
    .transform((v) => (v === null ? null : new Date(v)))
}

// IPv4 ที่ไม่บังคับ — ว่าง -> null, มีค่าต้องเป็น IPv4 รูปแบบถูกต้อง (0-255 ทั้ง 4 ช่อง)
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
export function optionalIPv4(message = 'IP Address ไม่ถูกต้อง (ต้องเป็นรูปแบบ IPv4)') {
  return z.string().trim().optional().nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || IPV4_RE.test(v), { message })
}

// MAC address ที่ไม่บังคับ — ว่าง -> null, มีค่าต้องเป็นรูปแบบ XX:XX:XX:XX:XX:XX (คั่นด้วย : หรือ -)
const MAC_RE = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/
export function optionalMac(message = 'MAC Address ไม่ถูกต้อง (ต้องเป็นรูปแบบ XX:XX:XX:XX:XX:XX)') {
  return z.string().trim().optional().nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || MAC_RE.test(v), { message })
}

// รหัสสกุลเงิน (ISO 4217) ที่ไม่บังคับ — ว่าง -> null, มีค่าต้องเป็นตัวอักษร 3 ตัว (แปลงเป็นตัวใหญ่ให้อัตโนมัติ)
const CURRENCY_RE = /^[A-Za-z]{3}$/
export function optionalCurrency(message = 'รหัสสกุลเงินไม่ถูกต้อง (ต้องเป็นตัวอักษร 3 ตัว เช่น THB, USD)') {
  return z.string().trim().optional().nullable()
    .transform((v) => (v ? v.toUpperCase() : null))
    .refine((v) => v === null || CURRENCY_RE.test(v), { message })
}

// ตัวเลข >= 0 ที่ไม่บังคับ (เช่น ราคาซื้อ) — ค่าว่าง/ไม่ส่งมา -> null
export function optionalNonNegativeNumber(message = 'ค่าต้องเป็นตัวเลขและไม่ติดลบ') {
  return z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.union([z.null(), z.coerce.number({ invalid_type_error: message }).nonnegative(message)]),
  ).optional()
}

// ค่า enum ที่ไม่บังคับ — ว่าง/ไม่ส่งมา -> null (ใช้กับ <select> ที่มีตัวเลือก "ไม่ระบุ" เป็นสตริงว่าง)
export function optionalEnum(values, message) {
  return z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.union([z.null(), z.enum(values, { errorMap: () => ({ message }) })]),
  ).optional()
}

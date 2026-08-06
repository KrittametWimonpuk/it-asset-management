// ---------------------------------------------------------------------------
// ตัวช่วยสำหรับ Reports & Export — Milestone 8
// รวม 2 เรื่อง: (1) แปลง query filter ที่ใช้ร่วมกันหลายรายงาน (2) ตัวสร้างไฟล์ export (CSV/Excel/PDF)
// ---------------------------------------------------------------------------
import path from 'path'
import { fileURLToPath } from 'url'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// ฟอนต์ Sarabun (SIL OFL) แยกไฟล์ตาม subset — thai ไม่มีตัวเลข/อักษรละติน, latin ไม่มีอักษรไทย
// ต้องสลับฟอนต์ทีละช่วงตอนวาดข้อความผสม (ดู splitTextRuns ด้านล่าง และ assets/fonts/LICENSE.txt)
const THAI_FONT_PATH = path.join(__dirname, '../../assets/fonts/Sarabun-Thai.woff')
const LATIN_FONT_PATH = path.join(__dirname, '../../assets/fonts/Sarabun-Latin.woff')

const EXPORT_FORMATS = ['csv', 'xlsx', 'pdf']

// ---------------------------------------------------------------------------
// (1) Filter parsing — ใช้ร่วมกันทั้ง 6 รายงาน แต่ละ endpoint หยิบไปใช้เฉพาะฟิลด์ที่เกี่ยวข้องกับตัวเอง
// หมายเหตุ: category ของ asset (categoryId เป็น master data id) กับ category ของ ticket (enum
// TicketCategory) เป็นคนละชนิดข้อมูล จึงตั้งใจแยกชื่อ param กัน (categoryId vs ticketCategory)
// เช่นเดียวกับ status (AssetStatus) vs assignmentStatus vs ticketStatus — กันความกำกวมของฟิลเตอร์ร่วม
// ---------------------------------------------------------------------------
export function parseReportQuery(query) {
  const format = EXPORT_FORMATS.includes(query.format) ? query.format : null
  const parseDate = (v) => {
    if (!v) return null
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return {
    format,
    dateFrom: parseDate(query.dateFrom),
    dateTo: parseDate(query.dateTo),
    categoryId: query.categoryId || '',
    departmentId: query.departmentId || '',
    locationId: query.locationId || '',
    vendorId: query.vendorId || '',
    status: query.status || '',
    assignmentStatus: query.assignmentStatus || '',
    ticketStatus: query.ticketStatus || '',
    ticketCategory: query.ticketCategory || '',
    bucket: query.bucket || '',
    search: (query.search || '').trim(),
  }
}

// ช่วงวันที่ (inclusive ทั้งสองฝั่ง) — dateTo ขยับไปสิ้นวันให้อัตโนมัติ กันกรณีเลือกวันเดียวกันแล้วไม่เจอผล
// เพราะเวลาเริ่มต้นของ Date ที่ parse จากสตริง "YYYY-MM-DD" คือ 00:00:00 พอดี
export function dateRangeWhere(field, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return {}
  const range = {}
  if (dateFrom) range.gte = dateFrom
  if (dateTo) {
    const end = new Date(dateTo)
    end.setHours(23, 59, 59, 999)
    range.lte = end
  }
  return { [field]: range }
}

// ---- ระยะประกัน: หมดแล้ว / ใกล้หมดใน 30 วัน / ใกล้หมดใน 90 วัน / ปกติ — ใช้ทั้งกรองและแสดงผล ----
export const WARRANTY_BUCKETS = ['expired', 'expiring30', 'expiring90', 'normal']
const WARRANTY_BUCKET_LABELS = {
  expired: 'หมดประกันแล้ว',
  expiring30: 'ใกล้หมดประกัน (30 วัน)',
  expiring90: 'ใกล้หมดประกัน (90 วัน)',
  normal: 'ปกติ',
}

// เงื่อนไข Prisma where สำหรับกรองตาม bucket ที่เลือก (ใช้ตอน query)
export function warrantyBucketWhere(bucket) {
  if (!WARRANTY_BUCKETS.includes(bucket)) return {}
  const now = new Date()
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
  if (bucket === 'expired') return { warrantyExpiry: { lt: now } }
  if (bucket === 'expiring30') return { warrantyExpiry: { gte: now, lte: in30 } }
  if (bucket === 'expiring90') return { warrantyExpiry: { gt: in30, lte: in90 } }
  return { warrantyExpiry: { gt: in90 } } // normal
}

// คำนวณ bucket + จำนวนวันที่เหลือ ของ asset หนึ่งชิ้น (ใช้ตอนแสดงผล ไม่ใช่ตอนกรอง)
export function warrantyInfo(warrantyExpiry) {
  if (!warrantyExpiry) return { bucketLabel: '-', daysRemaining: null }
  const now = new Date()
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
  const expiry = new Date(warrantyExpiry)
  const daysRemaining = Math.ceil((expiry - now) / (24 * 60 * 60 * 1000))
  let bucket
  if (expiry < now) bucket = 'expired'
  else if (expiry <= in30) bucket = 'expiring30'
  else if (expiry <= in90) bucket = 'expiring90'
  else bucket = 'normal'
  return { bucketLabel: WARRANTY_BUCKET_LABELS[bucket], daysRemaining }
}

// ---------------------------------------------------------------------------
// (2) Export — CSV / Excel (.xlsx) / PDF
// ทุกฟอร์แมต pipe/write ตรงไปที่ response ทีละส่วน (ไม่พักไฟล์ทั้งก้อนไว้ในหน่วยความจำก่อนส่ง) —
// ส่วนคำสั่ง query ฐานข้อมูลยังคงดึงแถวที่ตรงเงื่อนไขมาในคำสั่งเดียว (ไม่ใช่ DB cursor stream) เพราะ
// Prisma ไม่มี API สำหรับ stream ผลลัพธ์ทีละแถวแบบตรงไปตรงมา และขนาดรายงานของระบบนี้ (หลักพันแถว
// เป็นอย่างมาก) ยังปลอดภัยสำหรับ query เดียวแบบนี้อยู่ — ดูรายละเอียดที่ README: Performance Notes
// ---------------------------------------------------------------------------

function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value)
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

function sendCsv(res, filenameBase, columns, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`)
  res.write('﻿') // UTF-8 BOM — กัน Excel เปิดไฟล์แล้วอ่านภาษาไทยเพี้ยน
  res.write(columns.map((c) => csvEscape(c.label)).join(',') + '\r\n')
  for (const row of rows) {
    res.write(columns.map((c) => csvEscape(row[c.key])).join(',') + '\r\n')
  }
  res.end()
}

async function sendXlsx(res, filenameBase, columns, rows) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`)
  // streaming writer ตัวจริง — เขียนแต่ละแถวตรงไปที่ response ทันทีที่ commit() ไม่รวมทั้งไฟล์ในหน่วยความจำ
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true })
  const sheet = workbook.addWorksheet('Report')
  sheet.columns = columns.map((c) => ({ header: c.label, key: c.key, width: 22 }))
  sheet.getRow(1).font = { bold: true }
  for (const row of rows) {
    sheet.addRow(row).commit()
  }
  sheet.commit()
  await workbook.commit()
}

// ---- PDF: วาดข้อความผสมไทย/ละตินด้วยการตัดเป็นช่วงตาม unicode range แล้วสลับฟอนต์ทีละช่วง ----
const THAI_RANGE_RE = /[฀-๿]/

function splitTextRuns(text) {
  const runs = []
  let current = ''
  let currentIsThai = null
  for (const ch of String(text ?? '')) {
    const isThai = THAI_RANGE_RE.test(ch)
    if (currentIsThai === null || isThai === currentIsThai) {
      current += ch
    } else {
      runs.push({ text: current, thai: currentIsThai })
      current = ch
    }
    currentIsThai = isThai
  }
  if (current) runs.push({ text: current, thai: currentIsThai })
  return runs.length ? runs : [{ text: '', thai: false }]
}

function mixedTextWidth(doc, text, fontSize) {
  return splitTextRuns(text).reduce((sum, run) => {
    doc.font(run.thai ? 'ReportThai' : 'ReportLatin').fontSize(fontSize)
    return sum + doc.widthOfString(run.text)
  }, 0)
}

// ตัดข้อความให้พอดีความกว้างคอลัมน์ — วัดความกว้างจริงด้วย binary search แทนการเดาจำนวนตัวอักษร
// (ตัวอักษรไทย/ละติน/ตัวเลขกว้างไม่เท่ากัน นับตัวอักษรเฉย ๆ จะตัดผิดตำแหน่งได้)
function truncateToWidth(doc, text, fontSize, maxWidth) {
  const str = String(text ?? '')
  if (mixedTextWidth(doc, str, fontSize) <= maxWidth) return str
  let lo = 0
  let hi = str.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (mixedTextWidth(doc, str.slice(0, mid) + '…', fontSize) <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return lo > 0 ? str.slice(0, lo) + '…' : '…'
}

function drawMixedText(doc, text, x, y, fontSize) {
  const runs = splitTextRuns(text)
  runs.forEach((run, i) => {
    doc.font(run.thai ? 'ReportThai' : 'ReportLatin').fontSize(fontSize)
    if (i === 0) doc.text(run.text, x, y, { continued: i < runs.length - 1, lineBreak: false })
    else doc.text(run.text, { continued: i < runs.length - 1, lineBreak: false })
  })
}

const PDF_MARGIN = 30
const PDF_ROW_HEIGHT = 20
const PDF_HEADER_HEIGHT = 22
const PDF_FONT_SIZE = 8

function sendPdf(res, filenameBase, title, columns, rows) {
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.pdf"`)

  const doc = new PDFDocument({ margin: PDF_MARGIN, size: 'A4', layout: 'landscape' })
  doc.registerFont('ReportThai', THAI_FONT_PATH)
  doc.registerFont('ReportLatin', LATIN_FONT_PATH)
  doc.pipe(res) // stream ตรงไปที่ response ทันทีที่ pdfkit ผลิตแต่ละ chunk ออกมา

  const usableWidth = doc.page.width - PDF_MARGIN * 2
  const colWidth = usableWidth / columns.length

  function drawHeaderRow(y) {
    doc.rect(PDF_MARGIN, y, usableWidth, PDF_HEADER_HEIGHT).fill('#2563eb')
    doc.fillColor('#ffffff')
    columns.forEach((col, i) => {
      const x = PDF_MARGIN + i * colWidth + 4
      drawMixedText(doc, truncateToWidth(doc, col.label, PDF_FONT_SIZE, colWidth - 8), x, y + 6, PDF_FONT_SIZE)
    })
    doc.fillColor('#1f2933')
    return y + PDF_HEADER_HEIGHT
  }

  drawMixedText(doc, title, PDF_MARGIN, PDF_MARGIN, 16)
  drawMixedText(doc, `สร้างเมื่อ ${new Date().toLocaleDateString('th-TH')} • ทั้งหมด ${rows.length} รายการ`, PDF_MARGIN, PDF_MARGIN + 22, 9)

  let y = PDF_MARGIN + 46
  y = drawHeaderRow(y)
  const pageBottom = doc.page.height - PDF_MARGIN

  rows.forEach((row, rowIndex) => {
    if (y + PDF_ROW_HEIGHT > pageBottom) {
      doc.addPage()
      y = drawHeaderRow(PDF_MARGIN)
    }
    if (rowIndex % 2 === 1) {
      doc.rect(PDF_MARGIN, y, usableWidth, PDF_ROW_HEIGHT).fill('#f9fafb')
      doc.fillColor('#1f2933')
    }
    columns.forEach((col, i) => {
      const x = PDF_MARGIN + i * colWidth + 4
      const value = truncateToWidth(doc, row[col.key], PDF_FONT_SIZE, colWidth - 8)
      drawMixedText(doc, value, x, y + 6, PDF_FONT_SIZE)
    })
    y += PDF_ROW_HEIGHT
  })

  doc.end()
}

// ---- จุดเดียวที่ routes/reports.js เรียกใช้ส่งไฟล์ออก ไม่ว่าจะฟอร์แมตไหน ----
export async function sendExport(res, format, filenameBase, title, columns, rows) {
  if (format === 'csv') return sendCsv(res, filenameBase, columns, rows)
  if (format === 'xlsx') return sendXlsx(res, filenameBase, columns, rows)
  return sendPdf(res, filenameBase, title, columns, rows)
}

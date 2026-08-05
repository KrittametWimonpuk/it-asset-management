// ---------------------------------------------------------------------------
// Seed — ใส่ข้อมูลตัวอย่างลงฐานข้อมูล (ไม่บังคับ)
// รันด้วย:  npm run seed
// ---------------------------------------------------------------------------
import bcrypt from 'bcryptjs'
import { prisma } from '../src/db.js'

// upsert master data ทีละตัวโดยอิง "name" (ไม่สนตัวพิมพ์เล็ก/ใหญ่ไม่ได้ในระดับนี้ แต่ค่าที่ seed
// ให้เขียนตรงกันทุกครั้งอยู่แล้ว จึง upsert ซ้ำได้อย่างปลอดภัยโดยไม่สร้างซ้ำ)
async function upsertByName(model, name, extra = {}) {
  const existing = await model.findFirst({ where: { name } })
  if (existing) return existing
  return model.create({ data: { name, ...extra } })
}

// คำนวณวันที่จาก "วันนี้" +/- จำนวนวัน — ใช้สร้าง warrantyExpiry ตัวอย่างที่ครบทั้ง 3 สถานะ
// (หมดประกันแล้ว / ใกล้หมดประกันภายใน 30 วัน / ยังไม่ใกล้หมดประกัน) เพื่อโชว์ badge ได้ทันทีหลัง seed
function addDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

async function main() {
  // ---- Master Data: Category ----
  const categoryNames = [
    'Notebook', 'Desktop', 'Monitor', 'Printer',
    'Network Device', 'Server', 'UPS', 'Mobile Device', 'Accessory',
  ]
  const categories = {}
  for (const name of categoryNames) {
    categories[name] = await upsertByName(prisma.category, name)
  }

  // ---- Master Data: Location ----
  const locationNames = ['Head Office', 'Branch Office', 'Warehouse', 'Server Room']
  const locations = {}
  for (const name of locationNames) {
    locations[name] = await upsertByName(prisma.location, name)
  }

  // ---- Master Data: Department ----
  const departmentNames = ['IT', 'HR', 'Finance', 'Accounting', 'Production', 'Sales']
  const departments = {}
  for (const name of departmentNames) {
    departments[name] = await upsertByName(prisma.department, name)
  }

  // ---- Master Data: Vendor ----
  const vendorSeed = [
    { name: 'Dell', website: 'https://www.dell.com' },
    { name: 'HP', website: 'https://www.hp.com' },
    { name: 'Lenovo', website: 'https://www.lenovo.com' },
    { name: 'ASUS', website: 'https://www.asus.com' },
    { name: 'Acer', website: 'https://www.acer.com' },
  ]
  const vendors = {}
  for (const v of vendorSeed) {
    vendors[v.name] = await upsertByName(prisma.vendor, v.name, { website: v.website })
  }

  // ---- ผู้ใช้ตัวอย่าง + asset ตัวอย่างที่ผูกกับ master data จริง ----
  const email = 'demo@example.com'
  const password = await bcrypt.hash('password123', 10)

  // upsert = ถ้ามีอยู่แล้วให้ข้าม, ถ้ายังไม่มีให้สร้าง
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password,
      name: 'Demo User',
      assets: {
        create: [
          {
            // ใกล้หมดประกันภายใน 30 วัน -> badge "ใกล้หมดประกัน"
            assetTag: 'IT-0001',
            name: 'โน้ตบุ๊ค Dell Latitude 5440',
            brand: 'Dell',
            model: 'Latitude 5440',
            serialNumber: 'SN-DELL-5440-001',
            status: 'IN_USE',
            categoryId: categories['Notebook'].id,
            locationId: locations['Head Office'].id,
            departmentId: departments['IT'].id,
            vendorId: vendors['Dell'].id,
            description: 'โน้ตบุ๊คสำหรับทีมพัฒนา',
            assetCondition: 'GOOD',
            purchaseDate: addDays(-500),
            purchasePrice: 32900,
            currency: 'THB',
            supplierReference: 'PO-2024-0113',
            invoiceNumber: 'INV-DELL-88213',
            warrantyExpiry: addDays(20),
            remark: 'ใช้งานปกติ',
            hostname: 'IT-NB-0001',
            ipAddress: '192.168.1.101',
            macAddress: '00:1A:2B:3C:4D:5E',
            operatingSystem: 'Windows 11 Pro',
            osVersion: '23H2',
            cpu: 'Intel Core i5-1335U',
            ram: '16GB DDR5',
            storage: '512GB NVMe SSD',
            graphics: 'Intel Iris Xe Graphics',
            monitorSize: '14"',
            domainName: 'corp.example.com',
            lastSeenAt: addDays(0),
            receivedDate: addDays(-495),
            installedDate: addDays(-490),
          },
          {
            // หมดประกันไปแล้ว -> badge "หมดประกัน"
            assetTag: 'IT-0002',
            name: 'คอมพิวเตอร์ตั้งโต๊ะ HP ProDesk 600',
            brand: 'HP',
            model: 'ProDesk 600 G9',
            serialNumber: 'SN-HP-PD600-002',
            status: 'AVAILABLE',
            categoryId: categories['Desktop'].id,
            locationId: locations['Warehouse'].id,
            vendorId: vendors['HP'].id,
            description: 'เครื่องสำรองรอจ่ายงานให้พนักงานใหม่',
            assetCondition: 'FAIR',
            purchaseDate: addDays(-1200),
            purchasePrice: 24500,
            currency: 'THB',
            supplierReference: 'PO-2022-0456',
            invoiceNumber: 'INV-HP-55291',
            warrantyExpiry: addDays(-10),
            remark: 'รอจ่ายงานให้พนักงานใหม่',
            hostname: 'IT-DT-0002',
            ipAddress: '192.168.1.102',
            macAddress: '00:1B:44:11:3A:B7',
            operatingSystem: 'Windows 11 Pro',
            osVersion: '22H2',
            cpu: 'Intel Core i5-12500',
            ram: '8GB DDR4',
            storage: '256GB SATA SSD',
            graphics: 'Intel UHD Graphics 770',
            domainName: 'corp.example.com',
            receivedDate: addDays(-1195),
          },
          {
            // ยังไม่ใกล้หมดประกัน -> ไม่มี badge
            assetTag: 'IT-0003',
            name: 'โน้ตบุ๊ค Lenovo ThinkPad E14',
            brand: 'Lenovo',
            model: 'ThinkPad E14 Gen 5',
            serialNumber: 'SN-LEN-E14-003',
            status: 'IN_USE',
            categoryId: categories['Notebook'].id,
            locationId: locations['Branch Office'].id,
            departmentId: departments['Sales'].id,
            vendorId: vendors['Lenovo'].id,
            description: 'โน้ตบุ๊คทีมขาย',
            assetCondition: 'NEW',
            purchaseDate: addDays(-60),
            purchasePrice: 27900,
            currency: 'THB',
            supplierReference: 'PO-2025-0789',
            invoiceNumber: 'INV-LEN-10234',
            warrantyExpiry: addDays(400),
            hostname: 'IT-NB-0003',
            ipAddress: '192.168.2.55',
            macAddress: '3C:52:82:9A:11:C4',
            operatingSystem: 'Windows 11 Pro',
            osVersion: '23H2',
            cpu: 'AMD Ryzen 5 7530U',
            ram: '16GB DDR4',
            storage: '512GB NVMe SSD',
            graphics: 'AMD Radeon Graphics',
            monitorSize: '14"',
            domainName: 'corp.example.com',
            lastSeenAt: addDays(0),
            receivedDate: addDays(-57),
            installedDate: addDays(-55),
          },
        ],
      },
    },
  })

  console.log(`Seeded master data: ${categoryNames.length} categories, ${locationNames.length} locations, ${departmentNames.length} departments, ${vendorSeed.length} vendors`)
  console.log(`Seeded user: ${user.email} (รหัสผ่าน: password123)`)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })

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
            assetTag: 'IT-0001',
            name: 'โน้ตบุ๊คทีมพัฒนา',
            brand: 'Dell',
            model: 'XPS 13',
            serialNumber: 'SN-DELL-0001',
            status: 'IN_USE',
            categoryId: categories['Notebook'].id,
            locationId: locations['Head Office'].id,
            departmentId: departments['IT'].id,
            vendorId: vendors['Dell'].id,
          },
          {
            assetTag: 'IT-0002',
            name: 'จอมอนิเตอร์สำรอง',
            brand: 'LG',
            model: '27UL850',
            serialNumber: 'SN-LG-0002',
            status: 'AVAILABLE',
            categoryId: categories['Monitor'].id,
            locationId: locations['Warehouse'].id,
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

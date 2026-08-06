// ---------------------------------------------------------------------------
// Seed — ใส่ข้อมูลตัวอย่างลงฐานข้อมูล (ไม่บังคับ)
// รันด้วย:  npm run seed
// ---------------------------------------------------------------------------
import bcrypt from 'bcryptjs'
import { prisma } from '../src/db.js'
import { nextTicketNumber } from '../src/utils/ticketHelpers.js'

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

  // ---- ผู้ใช้ตัวอย่าง (Milestone 4: RBAC) — หนึ่งบัญชีต่อ role ให้ทดสอบสิทธิ์ได้ครบ ----
  const password = await bcrypt.hash('password123', 10)

  const itStaff = await prisma.user.upsert({
    where: { email: 'itstaff@example.com' },
    update: {},
    create: { email: 'itstaff@example.com', password, name: 'IT Staff', role: 'IT_STAFF' },
  })

  const employee = await prisma.user.upsert({
    where: { email: 'employee@example.com' },
    update: {},
    create: { email: 'employee@example.com', password, name: 'Employee User', role: 'EMPLOYEE' },
  })

  // Milestone 5: ownerId บันทึกแค่ "ใครสร้าง asset" (deprecated ไม่ใช้ตัดสิน "ผู้ถือครอง" อีกต่อไป)
  // ครุภัณฑ์ทุกชิ้นจึงสร้างโดย admin แล้วค่อยมอบหมาย (Assignment) ให้แต่ละคนถือครองแยกต่างหากด้านล่าง
  // upsert = ถ้ามีอยู่แล้วให้ข้าม, ถ้ายังไม่มีให้สร้าง
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password,
      name: 'Admin User',
      role: 'ADMIN',
      assets: {
        create: [
          {
            // ใกล้หมดประกันภายใน 30 วัน -> badge "ใกล้หมดประกัน" — ปัจจุบัน Admin ถือครองอยู่
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
            // หมดประกันไปแล้ว -> badge "หมดประกัน" — เคยมอบหมายแล้วคืนแล้ว ตอนนี้ไม่มีผู้ถือครอง (อยู่ในคลัง)
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
            // ยังไม่ใกล้หมดประกัน -> ไม่มี badge — ปัจจุบัน IT Staff ถือครองอยู่
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
          {
            // ปัจจุบัน Employee ถือครองอยู่ — ใช้ทดสอบขอบเขตการมองเห็นตาม role (EMPLOYEE เห็นแค่ของตัวเอง)
            assetTag: 'IT-0004',
            name: 'โทรศัพท์มือถือบริษัท',
            brand: 'Apple',
            model: 'iPhone 13',
            serialNumber: 'SN-APL-IP13-004',
            status: 'IN_USE',
            categoryId: categories['Mobile Device'].id,
            locationId: locations['Head Office'].id,
            departmentId: departments['Finance'].id,
            description: 'โทรศัพท์มือถือประจำตำแหน่ง',
            assetCondition: 'GOOD',
            purchaseDate: addDays(-200),
            purchasePrice: 25900,
            currency: 'THB',
            supplierReference: 'PO-2025-0912',
            invoiceNumber: 'INV-APL-30044',
            warrantyExpiry: addDays(165),
            operatingSystem: 'iOS',
            osVersion: '18',
            storage: '128GB',
            receivedDate: addDays(-198),
            installedDate: addDays(-198),
          },
        ],
      },
    },
    include: { assets: true },
  })

  // ---- Milestone 7: ครุภัณฑ์เพิ่มเติมสำหรับตัวอย่างใบแจ้งซ่อม (เครื่องพิมพ์/เครือข่าย ไม่มีผู้ถือครองรายบุคคล) ----
  // แยก upsert ต่างหากจาก assets ที่ผูกกับ admin ตอนสร้างผู้ใช้ด้านบน เพราะ upsert ของ admin ใช้
  // update: {} เมื่อมีอยู่แล้ว (รันซ้ำจะไม่สร้าง asset ใหม่ในนั้นอีก) — ฟังก์ชันนี้เช็คซ้ำเองจาก assetTag แทน
  async function ensureAsset(assetTag, data) {
    const existing = await prisma.asset.findFirst({ where: { assetTag } })
    if (existing) return existing
    return prisma.asset.create({ data: { assetTag, ownerId: admin.id, ...data } })
  }

  const printer = await ensureAsset('IT-0005', {
    name: 'เครื่องพิมพ์ HP LaserJet Pro',
    brand: 'HP',
    model: 'LaserJet Pro M404dn',
    serialNumber: 'SN-HP-LJ404-005',
    status: 'IN_USE',
    categoryId: categories['Printer'].id,
    locationId: locations['Head Office'].id,
    departmentId: departments['IT'].id,
    vendorId: vendors['HP'].id,
    description: 'เครื่องพิมพ์ส่วนกลางชั้น 3 ใช้งานร่วมกันทั้งแผนก',
    assetCondition: 'FAIR',
    purchaseDate: addDays(-800),
    purchasePrice: 8900,
    currency: 'THB',
    warrantyExpiry: addDays(-100),
    receivedDate: addDays(-795),
  })

  const networkSwitch = await ensureAsset('IT-0006', {
    name: 'Network Switch สาขา',
    brand: 'Cisco',
    model: 'Catalyst 1000-24T',
    serialNumber: 'SN-CISCO-C1000-006',
    status: 'IN_USE',
    categoryId: categories['Network Device'].id,
    locationId: locations['Server Room'].id,
    departmentId: departments['IT'].id,
    description: 'สวิตช์หลักของสาขา เชื่อมทุกเครื่องในชั้นเข้าเครือข่ายบริษัท',
    assetCondition: 'GOOD',
    purchaseDate: addDays(-300),
    purchasePrice: 15500,
    currency: 'THB',
    warrantyExpiry: addDays(700),
    receivedDate: addDays(-295),
    installedDate: addDays(-290),
  })

  // ---- Milestone 5: Asset Assignment — ประวัติการมอบหมาย/รับคืนครุภัณฑ์ ----
  // idempotent: ถ้า asset นี้มีประวัติ assignment อยู่แล้ว (รันซ้ำ) ให้ข้าม ไม่สร้างซ้ำ
  async function ensureAssignment(assetId, data) {
    const existing = await prisma.assignment.findFirst({ where: { assetId } })
    if (existing) return existing
    return prisma.assignment.create({ data: { assetId, ...data } })
  }

  const assetByTag = Object.fromEntries(admin.assets.map((a) => [a.assetTag, a]))

  // Dell Latitude -> Admin ถือครองอยู่ (active) — มอบโดย IT Staff
  await ensureAssignment(assetByTag['IT-0001'].id, {
    userId: admin.id,
    assignedById: itStaff.id,
    assignedAt: addDays(-490),
    status: 'ASSIGNED',
    conditionBefore: 'GOOD',
    remark: 'มอบให้ทีมพัฒนาใช้งานประจำ',
  })

  // HP ProDesk -> เคยมอบให้ IT Staff แล้วคืนแล้ว (ประวัติ) — ตอนนี้ไม่มีผู้ถือครอง กลับเข้าคลัง
  await ensureAssignment(assetByTag['IT-0002'].id, {
    userId: itStaff.id,
    assignedById: admin.id,
    assignedAt: addDays(-1195),
    expectedReturnDate: addDays(-900),
    returnedAt: addDays(-895),
    status: 'RETURNED',
    conditionBefore: 'GOOD',
    conditionAfter: 'FAIR',
    remark: 'คืนเครื่องเมื่อเปลี่ยนตำแหน่งงาน',
  })

  // Lenovo ThinkPad -> IT Staff ถือครองอยู่ (active) — มอบโดย Admin
  await ensureAssignment(assetByTag['IT-0003'].id, {
    userId: itStaff.id,
    assignedById: admin.id,
    assignedAt: addDays(-55),
    status: 'ASSIGNED',
    conditionBefore: 'NEW',
    remark: 'มอบให้ทีมขายใช้งาน',
  })

  // iPhone -> Employee ถือครองอยู่ (active) — มอบโดย Admin
  await ensureAssignment(assetByTag['IT-0004'].id, {
    userId: employee.id,
    assignedById: admin.id,
    assignedAt: addDays(-198),
    status: 'ASSIGNED',
    conditionBefore: 'GOOD',
    remark: 'โทรศัพท์มือถือประจำตำแหน่ง',
  })

  // ---- Milestone 7: Helpdesk & Maintenance — ตัวอย่างใบแจ้งซ่อมครบทั้ง 5 สถานะ ----
  // idempotent: เช็คจาก (assetId, title) คู่กัน — ถ้ามีตั๋วเรื่องเดียวกันของ asset นี้อยู่แล้ว (รันซ้ำ) ให้ข้าม
  async function ensureTicket(assetId, data) {
    const existing = await prisma.ticket.findFirst({ where: { assetId, title: data.title } })
    if (existing) return existing
    const ticketNumber = await nextTicketNumber()
    return prisma.ticket.create({ data: { ticketNumber, assetId, ...data } })
  }

  // Dell Latitude -> จอฟ้าบ่อย (HARDWARE) — Admin แจ้ง (ผู้ถือครองปัจจุบัน) มอบให้ IT Staff กำลังตรวจสอบอยู่
  await ensureTicket(assetByTag['IT-0001'].id, {
    title: 'จอฟ้า (Blue Screen) ขึ้นบ่อยขณะใช้งาน',
    description: 'เครื่องขึ้นจอฟ้าแล้วรีสตาร์ทเองประมาณ 2-3 ครั้งต่อวัน ช่วงหลังเปิดโปรแกรมหลายตัวพร้อมกัน',
    reportedById: admin.id,
    assignedToId: itStaff.id,
    priority: 'HIGH',
    category: 'HARDWARE',
    status: 'IN_PROGRESS',
    openedAt: addDays(-3),
  })

  // เครื่องพิมพ์ HP -> กระดาษติดบ่อย (PRINTER) — IT Staff พบเจอเองและแก้ไขจบแล้ว (RESOLVED รอปิดงาน)
  await ensureTicket(printer.id, {
    title: 'กระดาษติดบ่อย พิมพ์งานไม่ผ่าน',
    description: 'เครื่องพิมพ์กระดาษติดเกือบทุกครั้งที่พิมพ์เกิน 5 แผ่นต่อเนื่อง ต้องดึงกระดาษออกเองทุกรอบ',
    reportedById: itStaff.id,
    assignedToId: itStaff.id,
    priority: 'MEDIUM',
    category: 'PRINTER',
    status: 'RESOLVED',
    resolution: 'ทำความสะอาดลูกกลิ้งดึงกระดาษและเปลี่ยนถาดกระดาษที่ชำรุด ทดสอบพิมพ์ต่อเนื่อง 20 แผ่นผ่านปกติ',
    openedAt: addDays(-10),
    resolvedAt: addDays(-8),
  })

  // Network Switch -> Packet loss สูง (NETWORK) — แจ้ง/แก้ไข/ปิดงานเสร็จสมบูรณ์แล้ว (CLOSED)
  await ensureTicket(networkSwitch.id, {
    title: 'Packet loss สูงผิดปกติ เครือข่ายสาขาใช้งานช้า',
    description: 'พนักงานสาขารายงานว่าเข้าระบบช้าและหลุดบ่อย ตรวจสอบเบื้องต้นพบ packet loss ประมาณ 15-20%',
    reportedById: itStaff.id,
    assignedToId: admin.id,
    priority: 'CRITICAL',
    category: 'NETWORK',
    status: 'CLOSED',
    resolution: 'พบสาย LAN เสื่อมสภาพที่พอร์ต 4 เปลี่ยนสายใหม่และย้ายไปพอร์ตสำรอง packet loss กลับมาเป็นปกติ',
    openedAt: addDays(-20),
    resolvedAt: addDays(-19),
    closedAt: addDays(-18),
  })

  // Lenovo ThinkPad -> ติดตั้งโปรแกรมไม่ได้ (SOFTWARE) — เพิ่งแจ้งเข้ามา ยังไม่มีใครรับเรื่อง (OPEN)
  await ensureTicket(assetByTag['IT-0003'].id, {
    title: 'ติดตั้งโปรแกรมบัญชีไม่สำเร็จ ขึ้น error',
    description: 'พยายามติดตั้งโปรแกรมบัญชีเวอร์ชันล่าสุดแล้วขึ้น error code 1603 ทุกครั้ง',
    reportedById: itStaff.id,
    priority: 'MEDIUM',
    category: 'SOFTWARE',
    status: 'OPEN',
    openedAt: addDays(-1),
  })

  // iPhone -> ล็อกอินอีเมลไม่ได้ (ACCOUNT) — Employee แจ้ง (ผู้ถือครองปัจจุบัน) กำลังพักรอฝ่ายความปลอดภัยอนุมัติ (ON_HOLD)
  await ensureTicket(assetByTag['IT-0004'].id, {
    title: 'ล็อกอินอีเมลบริษัทไม่ได้',
    description: 'ขึ้นข้อความรหัสผ่านไม่ถูกต้องทั้งที่มั่นใจว่าใส่ถูก ลองรีเซ็ตรหัสผ่านแล้วก็ยังเข้าไม่ได้',
    reportedById: employee.id,
    assignedToId: itStaff.id,
    priority: 'LOW',
    category: 'ACCOUNT',
    status: 'ON_HOLD',
    openedAt: addDays(-5),
  })

  console.log(`Seeded master data: ${categoryNames.length} categories, ${locationNames.length} locations, ${departmentNames.length} departments, ${vendorSeed.length} vendors`)
  console.log(`Seeded users: ${admin.email} (ADMIN), ${itStaff.email} (IT_STAFF), ${employee.email} (EMPLOYEE) — รหัสผ่านทุกบัญชี: password123`)
  console.log('Seeded assignments: Dell->Admin (active), HP->IT Staff (returned), Lenovo->IT Staff (active), iPhone->Employee (active)')
  console.log('Seeded assets: +printer (IT-0005), +network switch (IT-0006)')
  console.log('Seeded tickets: Dell blue screen (IN_PROGRESS), Printer jam (RESOLVED), Network packet loss (CLOSED), Lenovo software (OPEN), iPhone account (ON_HOLD)')
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })

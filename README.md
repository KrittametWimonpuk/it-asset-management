# 🚀 ระบบจัดการครุภัณฑ์ IT (IT Asset Management)

เว็บแอประบบจัดการครุภัณฑ์ IT แบบครบวงจร — ตั้งแต่ทะเบียนครุภัณฑ์, สิทธิ์การใช้งานตาม role,
การมอบหมาย/รับคืนครุภัณฑ์, แดชบอร์ดสรุปภาพรวม, ระบบ Helpdesk แจ้งซ่อม/ปัญหาครุภัณฑ์, ไปจนถึงรายงาน
และส่งออกข้อมูลเป็น CSV/Excel/PDF พร้อม **deploy ขึ้น AWS ECS ได้จริง** ด้วยสคริปต์เดียว

> โค้ดทุกส่วนมี **คอมเมนต์ภาษาไทย** อธิบายเหตุผลของการตัดสินใจ (ไม่ใช่แค่บอกว่าโค้ดทำอะไร)

**เวอร์ชันปัจจุบัน:** `v0.8.1` (Milestone 8.1 — OpenAPI Documentation)

---

## 🧩 Features

| หมวด | รายละเอียด |
|------|-----------|
| **Authentication** | สมัครสมาชิก / เข้าสู่ระบบด้วย JWT, รหัสผ่านเก็บเป็น bcrypt hash เท่านั้น |
| **RBAC** | 3 สิทธิ์: `ADMIN` (เต็มระบบ), `IT_STAFF` (จัดการครุภัณฑ์/มอบหมายได้ จัดการผู้ใช้ไม่ได้), `EMPLOYEE` (เห็นเฉพาะของตัวเอง) — บังคับที่ backend เสมอ |
| **Asset Explorer** | รายการครุภัณฑ์: ค้นหา, กรองหลายเงื่อนไข, เรียงลำดับ, แบ่งหน้า, เลือกคอลัมน์ที่จะแสดง (จำค่าไว้ใน localStorage) |
| **Asset Details** | ข้อมูลทางเทคนิคครบ: การจัดซื้อ (ราคา/ผู้ขาย/ใบแจ้งหนี้/ประกัน), ฮาร์ดแวร์ (CPU/RAM/Storage), เครือข่าย (IP/MAC/Hostname), lifecycle dates |
| **Master Data** | หมวดหมู่ / สถานที่ตั้ง / แผนก / ผู้ขาย-ผู้ผลิต — CRUD เต็มรูปแบบ ใช้ฟอร์ม/หน้าเดียวกันขับเคลื่อนด้วย config |
| **Asset Assignment & Lifecycle** | มอบหมาย/รับคืนครุภัณฑ์ พร้อมประวัติเต็มรูปแบบ (ห้ามแก้/ลบประวัติเก่า), "ผู้ถือครองปัจจุบัน" คำนวณจากประวัติเสมอ ไม่ใช่ field ที่แก้ตรง ๆ ได้ |
| **Dashboard & Analytics** | การ์ดสรุป, กราฟภาพรวม (หมวดหมู่/แผนก/สถานที่/สถานะ/ประกัน/ผู้ขายยอดนิยม/ใบแจ้งซ่อม), กิจกรรมล่าสุด, ใบแจ้งซ่อมล่าสุด — คำนวณที่ backend ทั้งหมด ไม่มี N+1 query |
| **Helpdesk & Maintenance** | แจ้งปัญหาครุภัณฑ์ (ทุก role แจ้งได้), มอบหมายให้ ADMIN/IT_STAFF ดูแล, วงจรสถานะ OPEN → IN_PROGRESS → RESOLVED → CLOSED, เลขที่ใบแจ้งอัตโนมัติ (HD-000001, ...) ไม่ซ้ำกันแน่นอน, เชื่อมกับ Asset Explorer (นับใบแจ้งที่เปิดอยู่ต่อชิ้น + ประวัติการซ่อมบำรุงล่าสุด) |
| **Reports & Export** | 6 รายงาน (Asset Inventory, Assignment, Warranty, Helpdesk, Department Summary, Vendor Summary) พร้อมตัวกรองร่วมกัน (ช่วงวันที่/หมวดหมู่/สถานที่/แผนก/ผู้ขาย/สถานะ/ค้นหา) — preview เป็นตารางในเว็บ หรือส่งออกเป็น **CSV / Excel (.xlsx) / PDF** ได้ทันที สร้างไฟล์ที่ backend ทั้งหมด ไม่ export รายการที่ถูกกรอง/ซ่อนออกไปแล้ว และ RBAC ขอบเขตเดียวกับหน้าจอปกติ |
| **API Documentation** | เอกสาร OpenAPI 3.1 ครบทั้ง 49 endpoint พร้อม Swagger UI แบบ interactive ที่ `/docs` — ทดลองยิง request ได้จริง (Try It Out) ใส่ JWT ครั้งเดียวใช้ได้ทุก endpoint |
| **Soft Delete** | ทุกตารางหลักใช้ soft delete (`deletedAt`) — ลบแล้วยังอยู่ในฐานข้อมูลจริง กู้คืนได้ในอนาคต |
| **Deploy** | Docker Compose (รันเครื่องตัวเอง) และสคริปต์ deploy ขึ้น AWS ECS Fargate + RDS + ALB |

---

## 🏗️ Architecture Overview

```
apps/web (React + Vite)  ──/api/*──▶  apps/api (Express)  ──▶  PostgreSQL (Prisma)
```

- **Frontend**: React 18 + Vite, ไม่มี router library / state management library ใด ๆ (ตั้งใจให้เรียบง่าย
  — สลับหน้าด้วย state ธรรมดาใน [App.jsx](apps/web/src/App.jsx)) หน้าจอหลักคุยกับ backend ผ่านตัวช่วยกลางที่
  [api.js](apps/web/src/api.js) เดียว
- **Backend**: Express — แต่ละ resource เป็น router แยกไฟล์ใน `src/routes/`, master data ทั้ง 4 ตัว
  (Category/Location/Department/Vendor) ใช้ router factory ตัวเดียวกัน ([masterDataRouter.js](apps/api/src/utils/masterDataRouter.js))
  กันเขียนโค้ดซ้ำ
- **Auth**: JWT ที่ฝัง `{ id, email, role }` ไว้ในตัว, ตรวจสอบผ่าน middleware กลาง
  ([auth.js](apps/api/src/middleware/auth.js)) — ทุก endpoint ที่ต้องล็อกอินเรียก `requireAuth`,
  endpoint ที่จำกัด role เพิ่ม `requireRole(...roles)` ต่อท้าย
  ไม่มี endpoint ไหนรับ `role` จาก client ตอนสมัคร/แก้ไขข้อมูลตัวเอง — กันการยกระดับสิทธิ์ตัวเอง
- **Data model**: Prisma + PostgreSQL, migration แบบ sequential (`0001_init` ... `0007_tickets`)
  แทนชื่อ timestamp ของ Prisma default เพื่อให้อ่านลำดับการเปลี่ยนแปลงได้ง่าย
- **"ผู้ถือครองปัจจุบัน"**: ไม่ใช่ field ที่แก้ตรง ๆ ได้ แต่คำนวณจาก `Assignment` แถวล่าสุดที่
  `returnedAt IS NULL AND deletedAt IS NULL` เสมอ (source of truth เดียว) บังคับด้วย partial unique index
  ระดับฐานข้อมูล — asset หนึ่งชิ้นมีผู้ถือครองพร้อมกันได้สูงสุด 1 คน
- **RBAC ที่ backend เสมอ**: ทุก query ที่ scope ตาม role (เช่น EMPLOYEE เห็นเฉพาะของตัวเอง) กรองใน
  Prisma `where` โดยตรง ไม่ใช่กรองที่ frontend แล้วซ่อน UI — frontend ซ่อนปุ่ม/แท็บเป็นแค่ UX เสริม
  ไม่ใช่ชั้นความปลอดภัยจริง
- **Ticket lifecycle (Milestone 7)**: วงจรสถานะบังคับจริงที่ backend ([ticketHelpers.js](apps/api/src/utils/ticketHelpers.js):
  `TICKET_TRANSITIONS`) ไม่ใช่แค่ UI ซ่อนตัวเลือก — transition ที่ไม่อยู่ในตารางนี้ถูกปฏิเสธด้วย `400` เสมอ:

  ```
  OPEN ──(มอบหมายผู้ดูแล)──▶ IN_PROGRESS ──(POST /resolve)──▶ RESOLVED ──(POST /close)──▶ CLOSED
                                  ▲   │
                                  └───┘  (ON_HOLD — พักงานแล้วกลับมาทำต่อได้)
  ```

  - `RESOLVED`/`CLOSED` ตั้งได้ทางเดียวคือผ่าน `POST /:id/resolve` และ `POST /:id/close` เท่านั้น (ไม่ใช่ `PUT`
    ทั่วไป) เพราะสองสถานะนี้ต้องตั้ง `resolvedAt`/`closedAt` เพิ่ม และ `resolve` ยังบังคับกรอก `resolution` ด้วย
  - เลขที่ใบแจ้ง (`HD-000001`, ...) สร้างจาก PostgreSQL sequence ([migration 0007](apps/api/prisma/migrations/0007_tickets/migration.sql))
    ไม่ใช่ `count()+1` — กันเลขซ้ำแม้มี request สร้างตั๋วพร้อมกันหลายตัว
  - `assignedToId` ต้องเป็นผู้ใช้ role `ADMIN`/`IT_STAFF` เท่านั้น (ตรวจที่ backend) — มอบหมายให้ `EMPLOYEE`
    ดูแลไม่ได้
  - Asset ↔ Ticket: หนึ่ง asset มีได้หลายตั๋ว (1:many) — `GET /api/assets` แนบ `openTicketsCount`,
    `closedTicketsCount`, `ticketHistoryCount`, `recentTickets` มาด้วยเสมอ (ดู [ticketHelpers.js](apps/api/src/utils/ticketHelpers.js):
    `summarizeAssetTickets`) ให้ Asset Explorer แสดง "ประวัติการซ่อมบำรุง" โดยไม่ต้องยิง request แยก
- **Reports & Export (Milestone 8)**: `routes/reports.js` **ไม่มี business logic ใหม่ของตัวเอง** — ทุก endpoint
  import `scopeForRead` ตัวเดียวกับที่ `routes/assets.js`/`assignments.js`/`tickets.js` ใช้จริงมาโดยตรง (ตั้งใจ
  `export` ฟังก์ชันเดิมออกมาแทนเขียนเงื่อนไข RBAC ซ้ำ — ถ้าเขียนแยกแล้วพลาดไม่ตรงกันจะกลายเป็นช่องโหว่รั่ว
  ข้อมูลข้ามขอบเขตได้) endpoint เดียวกันตอบได้ 2 แบบ: ไม่ส่ง `?format=` มา = JSON แบ่งหน้าปกติ (ใช้กับหน้า
  Preview), ส่ง `?format=csv|xlsx|pdf` มา = ไฟล์ดาวน์โหลดตรง ๆ (ดึงข้อมูล "ทั้งหมด" ที่ตรงตัวกรอง ไม่ใช่แค่หน้า
  ที่กำลังดู — ไม่ export รายการที่ถูกกรอง/ซ่อนออกไปแล้ว) Department Summary/Vendor Summary เป็นภาพรวมองค์กร
  ล้วน ๆ จึงกัน EMPLOYEE ด้วย `requireRole('ADMIN','IT_STAFF')` ตั้งแต่ต้นทาง (403 ไม่ใช่แค่ซ่อนปุ่ม)
  ดูรายละเอียดรายงานทั้งหมดที่หัวข้อ [📊 Reports & Export](#-reports--export) ด้านล่าง

```
webapp-starter/
├── apps/
│   ├── api/                    Backend (Express + Prisma)
│   │   ├── assets/fonts/       ฟอนต์ Sarabun (SIL OFL) ที่ใช้ render ข้อความไทยใน PDF export
│   │   ├── prisma/
│   │   │   ├── schema.prisma   นิยามตาราง/ความสัมพันธ์ทั้งหมด
│   │   │   ├── migrations/     ประวัติการเปลี่ยนโครงสร้างฐานข้อมูล (0001 → 0007)
│   │   │   └── seed.js         ข้อมูลตัวอย่าง (3 role, ครุภัณฑ์+ประวัติมอบหมาย+ใบแจ้งซ่อม)
│   │   └── src/
│   │       ├── routes/         1 ไฟล์ต่อ 1 resource (assets/assignments/tickets/dashboard/reports/...)
│   │       ├── middleware/     requireAuth / requireRole
│   │       ├── utils/          โค้ดที่ใช้ร่วมกันหลาย route (validation, pagination, response envelope,
│   │       │                    ticketHelpers, reportHelpers — filter parsing + CSV/Excel/PDF writers)
│   │       └── docs/           OpenAPI/Swagger config + คอมเมนต์เอกสาร endpoint (paths/*.js) — ไม่แตะ route file
│   └── web/                    Frontend (React + Vite)
│       └── src/
│           ├── pages/          1 หน้าจอต่อ 1 ไฟล์ (Dashboard/Assets/Assignments/Tickets/Reports/...)
│           ├── components/     ฟอร์ม/ชิ้นส่วน UI ที่ใช้ซ้ำ
│           ├── hooks/          logic ที่ใช้ร่วมกันหลายหน้าจอ (เช่น useMasterDataOptions)
│           └── api.js          จุดเดียวที่คุยกับ backend
├── deploy/                     สคริปต์ deploy ขึ้น AWS ECS (00 → 03, และ 99-destroy)
├── docs/
├── docker-compose.yml          รันทั้งระบบบนเครื่องตัวเองด้วยคำสั่งเดียว
├── CHANGELOG.md
└── README.md
```

---

## ▶️ Installation — วิธีรันบนเครื่องตัวเอง (ง่ายสุด)

ต้องมี **Docker Desktop** ติดตั้งไว้ก่อน จากนั้น:

```bash
docker compose up --build
```

รอสักครู่ แล้วเปิดเบราว์เซอร์ที่ 👉 **http://localhost:8080**

- ลองกด "สมัครสมาชิก" → ล็อกอิน → เพิ่ม/แก้ไข/ลบครุภัณฑ์
- ฐานข้อมูล Postgres จะรันให้อัตโนมัติในอีก container หนึ่ง
- ตาราง (migration) จะถูกสร้างให้เองตอน API สตาร์ท

หยุดการทำงาน: กด `Ctrl+C` แล้ว `docker compose down`

---

## 🛠️ Development Workflow — วิธีรันแบบ "พัฒนา" (แก้โค้ดแล้วเห็นผลทันที)

เปิด 3 เทอร์มินัล (หรือใช้ Docker แค่ตัว db):

```bash
# เทอร์มินัล 1 — ฐานข้อมูล
docker compose up db

# เทอร์มินัล 2 — Backend
cd apps/api
cp ../../.env.example .env      # แล้วแก้ค่าใน .env ถ้าต้องการ
npm install
npm run migrate:dev             # สร้างตารางในฐานข้อมูล
npm run seed                    # (ไม่บังคับ) ใส่ข้อมูลตัวอย่าง 3 role + ครุภัณฑ์ + ประวัติมอบหมาย + ใบแจ้งซ่อม
npm run dev

# เทอร์มินัล 3 — Frontend
cd apps/web
npm install
npm run dev                     # เปิด http://localhost:5173
```

Vite จะส่งต่อ `/api` ไปที่ backend (พอร์ต 4000) ให้อัตโนมัติ ([vite.config.js](apps/web/vite.config.js))

**บัญชีตัวอย่างหลัง `npm run seed`** (รหัสผ่านทุกบัญชี: `password123`):

| Email | Role |
|-------|------|
| admin@example.com | ADMIN |
| itstaff@example.com | IT_STAFF |
| employee@example.com | EMPLOYEE |

### คำสั่งที่ใช้บ่อย (apps/api)

| คำสั่ง | ทำอะไร |
|--------|--------|
| `npm run dev` | รัน backend แบบ auto-reload |
| `npm run migrate:dev` | สร้าง migration ใหม่จาก schema.prisma ที่แก้ไข + apply ทันที (dev เท่านั้น) |
| `npm run migrate` | apply migration ที่มีอยู่แล้ว (ใช้ตอน deploy/production) |
| `npm run seed` | ใส่ข้อมูลตัวอย่าง (idempotent — รันซ้ำได้ไม่สร้างข้อมูลซ้ำ) |
| `npm run generate` | สร้าง Prisma Client ใหม่ (จำเป็นหลัง `npm install` บนเครื่องใหม่) |

---

## ⚙️ Environment Variables

กำหนดใน `apps/api/.env` (คัดลอกจาก [.env.example](.env.example)):

| ตัวแปร | ความหมาย | ค่าตัวอย่าง |
|--------|----------|-------------|
| `DATABASE_URL` | connection string ของ PostgreSQL | `postgresql://postgres:postgres@localhost:5432/appdb?schema=public` |
| `JWT_SECRET` | กุญแจเซ็น/ตรวจสอบ JWT — **ห้ามใช้ค่าตัวอย่างในระบบจริง** สร้างด้วย `openssl rand -hex 32` | `change-me-to-a-long-random-string` |
| `PORT` | พอร์ตที่ backend จะรัน | `4000` |

Frontend ไม่ต้องตั้งค่า environment variable ใด ๆ ตอน dev (Vite proxy `/api` ให้อัตโนมัติ) ส่วนตอน build
ขึ้น production ตัวแปร `API_UPSTREAM` ใน `docker-compose.yml` บอก nginx ว่าจะ proxy `/api` ไปที่ service ไหน

---

## 📊 Reports & Export

หน้า "รายงาน" มีการ์ดให้เลือก 6 รายงาน — คลิกแล้วเข้าโหมด preview (ตัวกรอง + ตาราง) พร้อมปุ่มส่งออก
CSV / Excel / PDF ที่มุมขวาบนของตาราง ทุกรายงานอ่านจากตารางที่มีอยู่แล้วเท่านั้น ไม่มีการคำนวณ/เก็บข้อมูลใหม่

| รายงาน | คอลัมน์ | ตัวกรองที่รองรับ | ขอบเขต EMPLOYEE |
|--------|---------|-------------------|-------------------|
| **Asset Inventory** | Asset Tag, ชื่ออุปกรณ์, หมวดหมู่, สถานที่ตั้ง, แผนก, ผู้ขาย/ผู้ผลิต, สถานะ, ผู้ถือครองปัจจุบัน, วันหมดประกัน, วันที่ซื้อ, ราคาซื้อ | ช่วงวันที่ซื้อ, หมวดหมู่, สถานที่ตั้ง, แผนก, ผู้ขาย, สถานะ, ค้นหา | เฉพาะครุภัณฑ์ที่ตัวเองถือครองอยู่ |
| **Asset Assignment** | ครุภัณฑ์, พนักงาน, วันที่มอบหมาย, วันที่คืน, สถานะการมอบหมาย, สภาพก่อน/หลัง, หมายเหตุ | ช่วงวันที่มอบหมาย, หมวดหมู่, สถานที่ตั้ง, แผนก, ผู้ขาย, สถานะการมอบหมาย, ค้นหา | เฉพาะประวัติที่ตัวเองเป็นผู้ถือครอง |
| **Warranty Report** | Asset Tag, ชื่ออุปกรณ์, หมวดหมู่, แผนก, ผู้ขาย/ผู้ผลิต, วันหมดประกัน, จำนวนวันคงเหลือ, สถานะประกัน | สถานะประกัน (หมดแล้ว/ใกล้หมด 30/90 วัน/ปกติ), หมวดหมู่, สถานที่ตั้ง, แผนก, ผู้ขาย, ค้นหา | เฉพาะครุภัณฑ์ที่ตัวเองถือครองอยู่ |
| **Helpdesk Report** | เลขที่ใบแจ้ง, ครุภัณฑ์, ความสำคัญ, สถานะ, ผู้ดูแล, วันที่แจ้ง/แก้ไขสำเร็จ/ปิดงาน, ระยะเวลาแก้ไข (ชั่วโมง) | ช่วงวันที่แจ้ง, หมวดหมู่/สถานที่/แผนก/ผู้ขายของครุภัณฑ์ที่ผูกอยู่, สถานะตั๋ว, หมวดหมู่ปัญหา, ค้นหา | เฉพาะตั๋วที่ตัวเองแจ้ง |
| **Department Summary** | แผนก, จำนวนครุภัณฑ์, กำลังมอบหมายอยู่ (active), จำนวนใบแจ้งซ่อมทั้งหมด | ช่วงวันที่ซื้อ, หมวดหมู่, สถานที่ตั้ง, ผู้ขาย | **เข้าไม่ได้ (403)** — ภาพรวมองค์กรล้วน ๆ |
| **Vendor Summary** | ผู้ขาย/ผู้ผลิต, จำนวนครุภัณฑ์, หมดประกันแล้ว, ใกล้หมดประกัน (90 วัน), ประกันปกติ, จำนวนใบแจ้งซ่อมทั้งหมด | ช่วงวันที่ซื้อ, หมวดหมู่, สถานที่ตั้ง, แผนก | **เข้าไม่ได้ (403)** — ภาพรวมองค์กรล้วน ๆ |

**Export formats:**

| ฟอร์แมต | Content-Type | รายละเอียด |
|---------|--------------|-------------|
| **CSV** | `text/csv; charset=utf-8` | เขียนทีละแถวตรงไปที่ HTTP response พร้อม UTF-8 BOM (กัน Excel เปิดภาษาไทยเพี้ยน) |
| **Excel (.xlsx)** | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | ใช้ [ExcelJS](https://github.com/exceljs/exceljs) streaming writer (`WorkbookWriter`) — เขียนแต่ละแถวลง response ทันที ไม่รวมทั้งไฟล์ไว้ในหน่วยความจำก่อนส่ง หัวตารางตัวหนา |
| **PDF** | `application/pdf` | ใช้ [PDFKit](http://pdfkit.org/) วาดตารางเอง (ไม่มี layout engine สำเร็จรูป) — แนวนอน A4, ตัดข้อความยาวด้วยการวัดความกว้างจริง, ตัดหน้าอัตโนมัติเมื่อแถวล้น |

**PDF ภาษาไทย**: PDFKit ไม่มี OpenType text-shaping engine ในตัว และฟอนต์ Sarabun ที่ใช้ (จาก Google Fonts
ผ่าน [Fontsource](https://fontsource.org/), สัญญาอนุญาต SIL OFL — ดู [assets/fonts/LICENSE.txt](apps/api/assets/fonts/LICENSE.txt))
แยกไฟล์ตาม subset (ไทย/ละติน คนละไฟล์ คนละชุดตัวอักษร) จึงต้องตัดข้อความเป็นช่วง ๆ ตาม Unicode range แล้วสลับ
ฟอนต์ทีละช่วงเอง (ดู `utils/reportHelpers.js`: `splitTextRuns`) — ทดสอบแล้วว่าข้อความไทย+ละตินผสมกันในเซลล์
เดียวกัน (เช่น `IT-0001 — โน้ตบุ๊ค Dell Latitude 5440`) render ถูกต้อง

**Preview vs Export**: preview (JSON) แบ่งหน้าเหมือนตารางอื่น ๆ ในระบบ ส่วน export (CSV/Excel/PDF) ดึงข้อมูล
"ทั้งหมด" ที่ตรงกับตัวกรอง+ขอบเขตสิทธิ์เสมอ ไม่ใช่แค่หน้าที่กำลังดูอยู่ — ตรงกับความหมายของคำว่า "export" (เอา
ทั้งหมดที่กรองไว้ ไม่ใช่แค่สิ่งที่มองเห็นบนจอ ณ ขณะนั้น)

---

## 📘 API Documentation (Swagger)

เอกสาร API แบบ interactive อยู่ที่ **`/docs`** (เช่น `http://localhost:4000/docs` ตอน dev หรือ
`http://localhost:8080/docs` ผ่าน nginx proxy ตอนรันด้วย Docker Compose) สร้างจาก [OpenAPI 3.1](https://www.openapis.org/)
ด้วย [swagger-jsdoc](https://github.com/Surnet/swagger-jsdoc) + [swagger-ui-express](https://github.com/scottie1984/swagger-ui-express)

### วิธีเปิด
1. รัน backend ตามขั้นตอนใน [Development Workflow](#️-development-workflow--วิธีรันแบบ-พัฒนา-แก้โค้ดแล้วเห็นผลทันที) ด้านบน (หรือ `docker compose up --build`)
2. เปิดเบราว์เซอร์ไปที่ `/docs`
3. Endpoint ทั้งหมด (49 endpoint) จัดกลุ่มตามหมวด (tag): Authentication, Users, Assets, Assignments,
   Dashboard, Master Data, Tickets, Reports, Health — แต่ละอันมี summary, description, พารามิเตอร์,
   request/response schema พร้อมตัวอย่างจริงจากข้อมูล seed (`IT-0001`, `Dell Latitude 5440`, `HD-000001`, `Admin User`)

### วิธี Authorize (ทดลองยิง endpoint ที่ต้องล็อกอิน)
1. เรียก **POST `/api/auth/login`** ก่อน (กด "Try it out" → ใส่ email/password → "Execute") คัดลอกค่า
   `data.token` จาก response ที่ได้กลับมา
2. กดปุ่ม **"Authorize"** (มุมขวาบนของหน้า `/docs`, รูปกุญแจ)
3. วาง token ที่คัดลอกมาลงในช่อง (ไม่ต้องพิมพ์คำว่า `Bearer` นำหน้า — Swagger UI ใส่ให้อัตโนมัติตาม
   `bearerFormat: JWT` ที่กำหนดไว้) แล้วกด "Authorize" → "Close"
4. จากนี้ทุก endpoint ที่มีรูปกุญแจ (ต้องล็อกอิน) จะแนบ header `Authorization: Bearer <token>` ให้อัตโนมัติ
   ตอนกด "Try it out" → "Execute" — authorize ครั้งเดียวใช้ได้ทุก endpoint จนกว่าจะ refresh หน้า

### สถาปัตยกรรมของเอกสาร
- เอกสารทั้งหมดอยู่แยกที่ `apps/api/src/docs/` (`openapi.js` = config หลัก + schema ที่ใช้ซ้ำได้,
  `paths/*.js` = คอมเมนต์ `@openapi` ล้วน ๆ 1 ไฟล์ต่อ 1 module) **ไม่มีการแก้ route file ใด ๆ เลยแม้แต่บรรทัดเดียว**
  — เอกสารอ่าน route/validation/response จริงจากซอร์สโค้ดที่มีอยู่แล้วเท่านั้น ไม่มี endpoint ไหนถูกเพิ่ม/เดาขึ้นมาเอง
- Schema ที่ใช้ซ้ำได้ (`components.schemas`): `User`, `Asset`, `Assignment`, `Ticket`, `MasterDataItem`,
  `Vendor`, `DashboardResponse`, รายงานทั้ง 6 แบบ, `ErrorResponse`, `ValidationError`, `Pagination` ฯลฯ —
  ทุก endpoint ที่ตอบโครงสร้างเดียวกัน (เช่น response envelope `{success, data}` / `{success, message, errors}`)
  อ้างอิง (`$ref`) กลับไปที่ schema เดียวกันเสมอ ไม่มีการนิยามซ้ำ
- JWT Bearer authentication ประกาศเป็น reusable security scheme (`components.securitySchemes.bearerAuth`)
  endpoint ที่ต้องล็อกอินถูก mark ด้วย security requirement นี้ให้ตรงกับ middleware `requireAuth`/`requireRole`
  ที่ใช้จริงในแต่ละ route

### 📸 Screenshots

> _ยังไม่มีภาพหน้าจอในเอกสารชุดนี้ — เพิ่มได้โดยวางไฟล์ภาพไว้ที่ `docs/screenshots/` แล้วอ้างอิงที่นี่_

- หน้า `/docs` ภาพรวม — รายการ endpoint จัดกลุ่มตาม tag
- ตัวอย่างการ Authorize ด้วย JWT
- ตัวอย่างการ Try It Out ของ endpoint หนึ่งตัว พร้อม response ที่ได้กลับมา

---

## 🌿 Git Workflow

- Branch หลักคือ `main` — งานแต่ละ milestone ทำใน feature branch (เช่น `feature/asset-assignment`)
- หนึ่ง milestone = หนึ่ง commit + หนึ่ง annotated tag (`v0.2.0` ... `v0.8.0`, ปัจจุบัน `v0.8.1`)
- ไม่ rewrite ประวัติ (ไม่ force-push, ไม่ amend commit ที่ผ่านไปแล้ว)
- ดูรายละเอียดการเปลี่ยนแปลงแต่ละเวอร์ชันได้ที่ [CHANGELOG.md](CHANGELOG.md)

---

## ☁️ วิธี Deploy ขึ้น AWS ECS

### เตรียมของ
1. ติดตั้ง [AWS CLI](https://aws.amazon.com/cli/) และ [Docker](https://www.docker.com/)
2. ล็อกอิน AWS: `aws configure` (ใส่ Access Key ที่มีสิทธิ์ ECS/ECR/RDS/ELB/IAM)

### ตั้งค่า
```bash
cp deploy/config.example.sh deploy/config.sh
# แก้ไฟล์ deploy/config.sh — อย่างน้อยเปลี่ยน DB_PASSWORD และ JWT_SECRET
```

### รัน (ครั้งแรก)
```bash
cd deploy
./deploy-all.sh
```

สคริปต์จะทำให้อัตโนมัติ:
1. **00** ตรวจความพร้อม (aws cli / docker / login)
2. **01** build image แล้ว push ขึ้น ECR
3. **02** สร้างโครงสร้างพื้นฐาน (VPC, Security Group, **RDS Postgres**, ECS Cluster, **Load Balancer**)
4. **03** สั่งรัน container บน ECS Fargate + ผูกกับ Load Balancer

พอเสร็จจะได้ URL หน้าตาแบบ `http://webapp-starter-alb-xxxx.ap-southeast-7.elb.amazonaws.com`

### Deploy เวอร์ชันใหม่ (หลังแก้โค้ด)
```bash
cd deploy
./01-build-push.sh && ./03-deploy.sh
```

### ลบทิ้ง (กันโดนคิดเงิน)
```bash
cd deploy
./99-destroy.sh
```

---

## 📸 Screenshots

> _ยังไม่มีภาพหน้าจอในเอกสารชุดนี้ — เพิ่มได้โดยวางไฟล์ภาพไว้ที่ `docs/screenshots/` แล้วอ้างอิงที่นี่_

- Dashboard — การ์ดสรุป + กราฟภาพรวม
- Asset Explorer — ค้นหา/กรอง/เลือกคอลัมน์
- Asset Assignment — มอบหมาย/รับคืนครุภัณฑ์

---

## ⚠️ Known Limitations

- **JWT ไม่ revoke ได้ทันที** — ถ้าเปลี่ยน role ผู้ใช้ที่ล็อกอินค้างอยู่ token เดิมยังพก role เก่าไปจนกว่าจะหมดอายุ
  (ต้อง logout/login ใหม่เพื่อรับ role ใหม่ทันที)
- **ยังไม่มี endpoint จัดการผู้ใช้เต็มรูปแบบ** — สร้าง/แก้ไข/ลบ/เปลี่ยน role ผู้ใช้อื่นทำผ่าน UI ไม่ได้เลยในตอนนี้
  (ตั้งใจเว้นไว้ กันการยกระดับสิทธิ์ตัวเองผ่านช่องโหว่ endpoint ที่ยังออกแบบไม่รอบคอบ)
- **ไม่มี endpoint ลบประวัติการมอบหมาย** — เป็นการตัดสินใจเชิงออกแบบ (ประวัติต้องอยู่ครบเสมอ) ไม่ใช่ข้อจำกัดทางเทคนิค
- **Master data ที่ถูกลบยังผูกกับ asset เก่าได้** — ตั้งใจให้ asset เก่าที่อ้างอิง category/location ที่ถูกลบไปแล้ว
  ยังแสดงชื่อได้ถูกต้อง แต่หมายความว่าการลบ master data ไม่ cascade ไปเช็ก asset ที่ใช้อยู่
- **ไม่มี automated test suite** — การตรวจสอบคุณภาพทั้งหมดในตอนนี้เป็น manual regression testing
- **Frontend ไม่มี router library** — สลับหน้าด้วย state ธรรมดา เหมาะกับแอปขนาดนี้ แต่ไม่รองรับ URL ที่ deep-link ได้
  (เช่น กด back/forward ของเบราว์เซอร์ไม่เปลี่ยนหน้าจอ)
- **ไม่มี endpoint ลบใบแจ้งซ่อม** — เป็นการตัดสินใจเชิงออกแบบ (ประวัติการแจ้งซ่อมต้องอยู่ครบเสมอ เหมือน Assignment)
  ไม่ใช่ข้อจำกัดทางเทคนิค
- **Helpdesk ยังไม่มี**: แจ้งเตือนอีเมล, QR Code ติดครุภัณฑ์, รายงาน/ส่งออกข้อมูล, Audit Log — ตั้งใจเว้นไว้สำหรับ
  milestone ถัดไปเพื่อไม่ให้ scope ของ Milestone 7 บวมเกินไป (ดู Roadmap)
- **EMPLOYEE แจ้งปัญหาได้เฉพาะครุภัณฑ์ที่ตัวเองถือครองอยู่** — ไม่สามารถแจ้งปัญหาแทนเพื่อนร่วมงานหรือครุภัณฑ์ส่วนกลาง
  (เช่น เครื่องพิมพ์/network switch) ได้ ต้องให้ ADMIN/IT_STAFF เป็นผู้แจ้งแทนในกรณีนี้
- **Export ดึงข้อมูลทั้งหมดในคำสั่งเดียว (ไม่ใช่ DB cursor stream)** — HTTP response ของทั้ง 3 ฟอร์แมตเขียนแบบ
  streaming (ไม่รวมไฟล์ทั้งก้อนไว้ในหน่วยความจำก่อนส่ง) แต่ query ฐานข้อมูลยังดึงแถวที่ตรงเงื่อนไขมาในคำสั่ง
  เดียว เพราะ Prisma ไม่มี API สำหรับ stream ผลลัพธ์ทีละแถวแบบตรงไปตรงมา ปลอดภัยสำหรับขนาดรายงานของระบบนี้
  (หลักพันแถว) แต่ถ้าข้อมูลโตถึงหลักแสน/ล้านแถว ควรทำ background export job แทนการ export แบบ synchronous
- **PDF ภาษาไทยไม่มี OpenType shaping engine เต็มรูปแบบ** — ใช้การตัดข้อความตาม Unicode range แล้วสลับฟอนต์
  เอง (ดูหัวข้อ Reports & Export ด้านบน) ทดสอบแล้วว่าข้อความไทยมาตรฐาน (รวม สระอำ) render ถูกต้อง แต่กรณีอักษร
  ควบ/เครื่องหมายซับซ้อนเกินกว่านี้ยังไม่ได้ทดสอบครบทุกกรณี
- **Department/Vendor Summary ไม่มี date range ที่กรอง "ใบแจ้งซ่อม"/"การมอบหมาย" โดยตรง** — ตัวกรองช่วงวันที่
  ใน 2 รายงานนี้มีผลกับ "วันที่ซื้อครุภัณฑ์" เท่านั้น (จำนวนตั๋ว/การมอบหมายที่นับเป็นยอดสะสม ไม่ได้กรองตามช่วงวันที่)
- **เอกสาร Swagger เขียนแยกจาก route file ทั้งหมด** (`apps/api/src/docs/`) ตั้งใจให้ Milestone 8.1 ไม่แตะ
  business logic แม้แต่บรรทัดเดียว — หมายความว่าถ้า route จริงถูกแก้ในอนาคต (เพิ่ม field/เปลี่ยน validation)
  ต้องอัปเดตไฟล์เอกสารคู่กันด้วยตนเอง ไม่มีการ sync อัตโนมัติจากโค้ดจริงไปเอกสาร

---

## 🗺️ Roadmap

- [ ] แจ้งเตือนอีเมล (มอบหมายตั๋วใหม่, SLA ใกล้ครบกำหนด, รายงานประจำสัปดาห์อัตโนมัติ) — ตั้งใจเว้นไว้จาก Milestone 7/8
- [ ] QR Code ติดครุภัณฑ์ (สแกนเพื่อดูรายละเอียด/แจ้งปัญหาได้ทันที) — ตั้งใจเว้นไว้จาก Milestone 7/8
- [ ] Audit Log (ใครแก้ไขอะไร เมื่อไร) — ตั้งใจเว้นไว้จาก Milestone 7/8
- [ ] SLA tracking (เวลาตอบสนอง/แก้ไขตามระดับความสำคัญ) ต่อยอดจากโครง Ticket ที่มีอยู่แล้ว
- [ ] Background export job (queue) สำหรับรายงานขนาดใหญ่มาก — ปัจจุบัน export เป็น synchronous request
- [ ] จัดการผู้ใช้เต็มรูปแบบ (สร้าง/แก้ไข/ปิดใช้งาน/เปลี่ยน role) — เฉพาะ ADMIN
- [ ] Automated test suite (unit + integration) สำหรับ backend routes
- [ ] Refresh token / revoke token เมื่อเปลี่ยน role ทันที
- [ ] router library (เช่น react-router-dom) เมื่อแอปโตขึ้นจนต้องการ deep-link

---

## 🔑 จุดสำคัญที่ควรเข้าใจ (สำหรับมือใหม่)

- **รหัสผ่านไม่เคยถูกเก็บตรง ๆ** — เก็บเป็น hash ด้วย bcrypt ([auth.js](apps/api/src/routes/auth.js))
- **JWT** คือ "บัตรผ่าน" ที่เซิร์ฟเวอร์เซ็นให้ตอนล็อกอิน ฝั่งหน้าเว็บเก็บไว้แล้วแนบไปทุก request ([auth.js](apps/api/src/middleware/auth.js))
- **RBAC บังคับที่ backend เสมอ ไม่ใช่แค่ซ่อนปุ่มฝั่งหน้าเว็บ** ([assets.js](apps/api/src/routes/assets.js))
- **Soft delete** — ปุ่ม "ลบ" ทุกที่ตั้งค่า `deletedAt` แทนการลบแถวจริง ข้อมูลยังอยู่ในฐานข้อมูลเสมอ
- **Health check** (`/health`) มีไว้ให้ AWS เช็กว่าเซิร์ฟเวอร์ยังมีชีวิต ([index.js](apps/api/src/index.js))
- **Migration** = ประวัติการเปลี่ยนโครงสร้างฐานข้อมูล รันอัตโนมัติตอน container สตาร์ท

---

## ⚠️ หมายเหตุด้านความปลอดภัย (ก่อนใช้งานจริงจัง)

เทมเพลตนี้เน้น **"เข้าใจง่าย"** จึงลัดบางอย่างเพื่อการเรียนรู้ ถ้าจะใช้งานจริงควร:

- ย้าย `JWT_SECRET` / `DATABASE_URL` ไปเก็บใน **AWS Secrets Manager** แทนการใส่ตรง ๆ ใน task definition
- เพิ่ม **HTTPS** ที่ ALB (ใช้ ACM certificate + listener :443)
- จำกัดสิทธิ์ IAM ให้แคบลง (least privilege)
- ตั้ง `desired-count` มากกว่า 1 เพื่อความทนทาน

---

## 📄 License

MIT — ใช้ ต่อยอด แจกจ่าย ได้อิสระ

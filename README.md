# 🚀 ระบบจัดการครุภัณฑ์ IT (IT Asset Management)

[![Continuous Integration](https://github.com/KrittametWimonpuk/it-asset-management/actions/workflows/ci.yml/badge.svg)](https://github.com/KrittametWimonpuk/it-asset-management/actions/workflows/ci.yml)

เว็บแอประบบจัดการครุภัณฑ์ IT แบบครบวงจร — ตั้งแต่ทะเบียนครุภัณฑ์, สิทธิ์การใช้งานตาม role,
การมอบหมาย/รับคืนครุภัณฑ์, แดชบอร์ดสรุปภาพรวม, ระบบ Helpdesk แจ้งซ่อม/ปัญหาครุภัณฑ์, ไปจนถึงรายงาน
และส่งออกข้อมูลเป็น CSV/Excel/PDF พร้อม **deploy ขึ้น AWS ECS ได้จริง** ด้วยสคริปต์เดียว

> โค้ดทุกส่วนมี **คอมเมนต์ภาษาไทย** อธิบายเหตุผลของการตัดสินใจ (ไม่ใช่แค่บอกว่าโค้ดทำอะไร)

**เวอร์ชัน Stable ปัจจุบัน:** `v1.1.0`

---

## 🟢 Build Status

ทุก push และ pull request เข้า `master` หรือ `feature/*` ถูกตรวจสอบอัตโนมัติผ่าน [GitHub Actions](.github/workflows/ci.yml)
— ดูรายละเอียดที่หัวข้อ [⚙️ CI/CD Pipeline](#️-cicd-pipeline) ด้านล่าง badge ด้านบนจะเป็นสีเขียวก็ต่อเมื่อ
push ล่าสุดของ `master` ผ่านทุกขั้นตอน (validate schema + lint backend/frontend + build backend/frontend)

---

## 🧩 Features

| หมวด | รายละเอียด |
|------|-----------|
| **Authentication** | สมัครสมาชิก / เข้าสู่ระบบด้วย JWT, รหัสผ่านเก็บเป็น bcrypt hash เท่านั้น |
| **RBAC** | 3 สิทธิ์: `ADMIN` (เต็มระบบและกำหนดสิทธิ์บัญชีอื่น), `IT_STAFF` (จัดการครุภัณฑ์/มอบหมายได้ แต่เปลี่ยนสิทธิ์ผู้ใช้ไม่ได้), `EMPLOYEE` (เห็นเฉพาะของตัวเอง) — บังคับที่ backend เสมอ และ role ที่ ADMIN เปลี่ยนมีผลทันที |
| **Asset Explorer** | รายการครุภัณฑ์: ค้นหา, กรองหลายเงื่อนไข, เรียงลำดับ, แบ่งหน้า, เลือกคอลัมน์ที่จะแสดง (จำค่าไว้ใน localStorage) |
| **Asset Details** | ข้อมูลทางเทคนิคครบ: การจัดซื้อ (ราคา/ผู้ขาย/ใบแจ้งหนี้/ประกัน), ฮาร์ดแวร์ (CPU/RAM/Storage), เครือข่าย (IP/MAC/Hostname), lifecycle dates |
| **Master Data** | หมวดหมู่ / สถานที่ตั้ง / แผนก / ผู้ขาย-ผู้ผลิต — CRUD เต็มรูปแบบ ใช้ฟอร์ม/หน้าเดียวกันขับเคลื่อนด้วย config |
| **Employee Management (v1.1 Stable)** | ทะเบียนพนักงานและความสัมพันธ์ one-to-one กับ User แบบ explicit FK/unique: ค้นหา/กรอง/แบ่งหน้า, สถานะ, แผนก/ตำแหน่ง, Create/Edit/Archive/Restore, soft delete, RBAC และ Audit Log |
| **Asset Assignment & Return Inspection** | Employee เป็น business identity ของผู้ถือครอง, User เป็น operator/RBAC; รองรับมอบหมาย, เริ่มตรวจรับ, สภาพ/ผลตรวจ/ผู้ตรวจ/เวลา, Return Timeline และประวัติเต็มรูปแบบโดยไม่ทำข้อมูล User เดิมหาย |
| **Borrow Request & Approval Workflow (v1.1 Stable)** | Employee ส่งคำขอยืมและติดตามสถานะ; ADMIN/IT_STAFF อนุมัติ/ปฏิเสธพร้อมความคิดเห็น ผู้พิจารณา เวลา และ Approval Timeline โดยการอนุมัติสร้าง Assignment อัตโนมัติใน transaction เดียว |
| **Notifications, Email & Reminders** | Notification Bell พร้อม unread badge และ Email ผ่าน Resend adapter; ผู้ใช้กำหนดอีเมลแยกจาก Login, ยืนยันด้วย one-time token, เลือกประเภท, reminder ก่อนกำหนด/overdue, durable outbox, dedupe และ retry โดยไม่ทำให้ workflow หลักล้ม |
| **Dashboard & Analytics** | การ์ดสรุป, กราฟภาพรวม (หมวดหมู่/แผนก/สถานที่/สถานะ/ประกัน/ผู้ขายยอดนิยม/ใบแจ้งซ่อม), กิจกรรมล่าสุด, ใบแจ้งซ่อมล่าสุด — คำนวณที่ backend ทั้งหมด ไม่มี N+1 query |
| **Helpdesk & Maintenance** | แจ้งปัญหาครุภัณฑ์ (ทุก role แจ้งได้), มอบหมายให้ ADMIN/IT_STAFF ดูแล, วงจรสถานะ OPEN → IN_PROGRESS → RESOLVED → CLOSED, เลขที่ใบแจ้งอัตโนมัติ (HD-000001, ...) ไม่ซ้ำกันแน่นอน, เชื่อมกับ Asset Explorer (นับใบแจ้งที่เปิดอยู่ต่อชิ้น + ประวัติการซ่อมบำรุงล่าสุด) |
| **Reports & Export** | 10 รายงาน (เพิ่ม Notification Summary จาก 9 รายงานเดิม) พร้อมตัวกรองร่วมกัน — preview เป็นตารางในเว็บ หรือส่งออกเป็น **CSV / Excel (.xlsx) / PDF** ได้ทันที และ RBAC ขอบเขตเดียวกับหน้าจอปกติ |
| **API Documentation** | เอกสาร OpenAPI 3.1 ครบทั้ง 81 endpoint methods พร้อม Swagger UI แบบ interactive ที่ `/docs` — ทดลองยิง request ได้จริง (Try It Out) ใส่ JWT ครั้งเดียวใช้ได้ทุก endpoint |
| **Audit Log** | บันทึกการกระทำสำคัญผ่าน durable outbox + retry พร้อมค่าก่อน-หลัง ผู้ทำรายการ เวลา และ real client IP — ประวัติแก้ไข/ลบไม่ได้, เฉพาะ ADMIN/IT_STAFF ดูได้ |
| **Soft Delete** | ทุกตารางหลักใช้ soft delete (`deletedAt`) — ลบแล้วยังอยู่ในฐานข้อมูลจริง กู้คืนได้ในอนาคต |
| **CI/CD** | GitHub Actions ตรวจสอบคุณภาพโค้ดอัตโนมัติทุก push/PR — validate Prisma schema, lint, automated backend tests, build backend/frontend, fail-fast พร้อม job summary (ดู [⚙️ CI/CD Pipeline](#️-cicd-pipeline)) |
| **Deploy** | สอง production path: (1) Docker Compose self-hosted (`docker-compose.prod.yml` — nginx reverse proxy + security headers + gzip) หรือ (2) สคริปต์ deploy ขึ้น AWS ECS Fargate + RDS + ALB — ดู [🚀 Production Deployment & Operations](#-production-deployment--operations-release-candidate-3) |

---

## 🏗️ Architecture Overview

```text
Browser ─HTTPS─▶ nginx / AWS ALB ─┬─▶ React + Vite static UI
                                  └─/api,/docs─▶ Express ─▶ Prisma ─▶ PostgreSQL
Scheduler / EventBridge ────────────────┬──────────▶ Reminder dedupe
                                        ├──────────▶ Audit outbox retry
                                        └──────────▶ Email outbox ─▶ Resend
User (authentication/RBAC) ── 0..1 : 1 ── Employee (business identity)
```

ดูแผนภาพและขอบเขต component/transaction โดยละเอียดที่ [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
และ threat model ของ Email delivery ที่ [docs/EMAIL_NOTIFICATIONS_SECURITY.md](docs/EMAIL_NOTIFICATIONS_SECURITY.md)

- **Frontend**: React 18 + Vite, ไม่มี router library / state management library ใด ๆ (ตั้งใจให้เรียบง่าย
  — สลับหน้าด้วย state ธรรมดาใน [App.jsx](apps/web/src/App.jsx)) หน้าจอหลักคุยกับ backend ผ่านตัวช่วยกลางที่
  [api.js](apps/web/src/api.js) เดียว
- **Backend**: Express — แต่ละ resource เป็น router แยกไฟล์ใน `src/routes/`, master data ทั้ง 4 ตัว
  (Category/Location/Department/Vendor) ใช้ router factory ตัวเดียวกัน ([masterDataRouter.js](apps/api/src/utils/masterDataRouter.js))
  กันเขียนโค้ดซ้ำ
- **Auth**: JWT ที่ฝัง `{ id, email, role, employeeId }` ไว้ในตัว, ตรวจสอบผ่าน middlewareกลาง
  ([auth.js](apps/api/src/middleware/auth.js)) — ทุก endpoint ที่ต้องล็อกอินเรียก `requireAuth`,
  endpoint ที่จำกัด role เพิ่ม `requireRole(...roles)` ต่อท้าย
  ไม่มี endpoint ไหนรับ `role` จาก client ตอนสมัคร/แก้ไขข้อมูลตัวเอง — กันการยกระดับสิทธิ์ตัวเอง
- **Data model**: Prisma + PostgreSQL, migration แบบ sequential (`0001_init` ... `0016_email_notifications`)
  แทนชื่อ timestamp ของ Prisma default เพื่อให้อ่านลำดับการเปลี่ยนแปลงได้ง่าย
- **"ผู้ถือครองปัจจุบัน"**: ไม่ใช่ field ที่แก้ตรง ๆ ได้ แต่คำนวณจาก `Assignment` แถวล่าสุดที่
  `returnedAt IS NULL AND deletedAt IS NULL` เสมอ (source of truth เดียว) บังคับด้วย partial unique index
  ระดับฐานข้อมูล — asset หนึ่งชิ้นมีผู้ถือครองพร้อมกันได้สูงสุด 1 คน
- **RBAC ที่ backend เสมอ**: ทุก query ที่ scope ตาม role (เช่น EMPLOYEE เห็นเฉพาะของตัวเอง) กรองใน
  Prisma `where` โดยตรง ไม่ใช่กรองที่ frontend แล้วซ่อน UI — frontend ซ่อนปุ่ม/แท็บเป็นแค่ UX เสริม
  ไม่ใช่ชั้นความปลอดภัยจริง
- **Employee ≠ User (v1.1 RC2)**: `Employee` เป็น business identity ส่วน `User.employeeId` เป็น explicit
  one-to-one FK สำหรับ Authentication/RBAC; `Assignment.userId` และ email fallback ยังคงไว้เฉพาะข้อมูล legacy
  ที่ migration จับคู่ไม่ได้อย่างปลอดภัย
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
  Preview), ส่ง `?format=csv|xlsx|pdf` มา = ไฟล์ดาวน์โหลดตรง ๆ (สูงสุด 25,000 แถวตามตัวกรอง) Department Summary/Vendor Summary เป็นภาพรวมองค์กร
  ล้วน ๆ จึงกัน EMPLOYEE ด้วย `requireRole('ADMIN','IT_STAFF')` ตั้งแต่ต้นทาง (403 ไม่ใช่แค่ซ่อนปุ่ม)
  ดูรายละเอียดรายงานทั้งหมดที่หัวข้อ [📊 Reports & Export](#-reports--export) ด้านล่าง
- **Audit Log (RC2)**: `utils/auditLog.js` persist เหตุการณ์ลง `AuditOutbox` ก่อนทุกครั้งและทุก caller `await`
  การบันทึก จากนั้น dispatcher สร้าง `AuditLog` แบบ idempotent; transient failure ถูกเก็บ attempts/error/
  next retry ไว้ให้ scheduler ไม่สูญหายแบบเงียบ ๆ `AuditLog.performedById`
  ตั้งใจไม่ผูก Prisma relation กับ `User` (เป็นแค่ string ธรรมดา) เพื่อไม่ต้องแก้ model `User` เลย และกันปัญหา
  onDelete policy ที่ยังไม่มีคำตอบชัดเจนในอนาคต — `routes/audit.js` จึง join กับ `User` เองตอนอ่าน (ดึง id ที่ไม่ซ้ำ
  ในหน้าที่กำลังแสดงมา query ครั้งเดียว ไม่ query ทีละแถว) ฟังก์ชัน join นี้ (`attachPerformer`) ใช้ร่วมกันทั้ง
  `routes/audit.js` และ `routes/dashboard.js` (`recentAuditLogs`) กันโค้ดซ้ำ สำหรับ Master Data (Category/Location/
  Department/Vendor) การ log ทำแบบรวมศูนย์อยู่ใน `createMasterDataRouter` เดียว (ผ่าน option `entityType`) แทนที่จะ
  เขียนซ้ำ 4 รอบ ดูรายละเอียดที่หัวข้อ [📝 Audit Log](#-audit-log) ด้านล่าง

```
webapp-starter/
├── apps/
│   ├── api/                    Backend (Express + Prisma)
│   │   ├── assets/fonts/       ฟอนต์ Sarabun (SIL OFL) ที่ใช้ render ข้อความไทยใน PDF export
│   │   ├── prisma/
│   │   │   ├── schema.prisma   นิยามตาราง/ความสัมพันธ์ทั้งหมด
│   │   │   ├── migrations/     ประวัติการเปลี่ยนโครงสร้างฐานข้อมูล (0001 → 0011)
│   │   │   └── seed.js         ข้อมูลตัวอย่าง (3 role, ครุภัณฑ์+ประวัติมอบหมาย+ใบแจ้งซ่อม)
│   │   └── src/
│   │       ├── routes/         1 ไฟล์ต่อ 1 resource (assets/assignments/employees/tickets/reports/audit/...)
│   │       ├── middleware/     requireAuth / requireRole
│   │       ├── utils/          โค้ดที่ใช้ร่วมกันหลาย route (validation, pagination, response envelope,
│   │       │                    ticketHelpers, reportHelpers, auditLog — logAudit()/attachPerformer())
│   │       └── docs/           OpenAPI/Swagger config + คอมเมนต์เอกสาร endpoint (paths/*.js) — ไม่แตะ route file
│   └── web/                    Frontend (React + Vite)
│       └── src/
│           ├── pages/          1 หน้าจอต่อ 1 ไฟล์ (Dashboard/Assets/Assignments/Employees/BorrowRequests/...)
│           ├── components/     ฟอร์ม/ชิ้นส่วน UI ที่ใช้ซ้ำ
│           ├── hooks/          logic ที่ใช้ร่วมกันหลายหน้าจอ (เช่น useMasterDataOptions)
│           └── api.js          จุดเดียวที่คุยกับ backend
├── deploy/                     สคริปต์ deploy ขึ้น AWS ECS (00 → 03, และ 99-destroy)
├── docs/                       DEPLOYMENT / BACKUP_RECOVERY / ROLLBACK / PRODUCTION_CHECKLIST (RC3)
├── .github/                    CI workflow + issue/PR templates (RC3)
├── docker-compose.yml          รันทั้งระบบบนเครื่องตัวเองด้วยคำสั่งเดียว (dev)
├── docker-compose.prod.yml     รัน production แบบ self-hosted (RC3 — ไฟล์แยกจาก dev ทั้งหมด)
├── .env.production.example     ต้นแบบตัวแปร environment สำหรับ docker-compose.prod.yml (RC3)
├── CONTRIBUTING.md             วิธี contribute เข้าโปรเจกต์ (RC3)
├── CODEOWNERS                  ผู้ต้อง review ก่อน merge (RC3)
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

**บัญชีตัวอย่างหลัง `npm run seed`** (local development ใช้ `password123`; production ต้องกำหนด
`DEMO_ACCOUNT_PASSWORD` เป็น secret ที่คาดเดายาก):

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
| `NODE_ENV` | `development` (ค่าเริ่มต้น) หรือ `production` — กำหนดพฤติกรรม default ของ CORS เวลาไม่ได้ตั้ง `CORS_ORIGIN` (RC2) | `development` |
| `CORS_ORIGIN` | origin ที่อนุญาตให้เรียก API ข้าม origin ได้ (คั่นด้วยจุลภาคถ้ามีหลายตัว) — ไม่บังคับ ดูรายละเอียดที่หัวข้อ [🌐 CORS](#-cors) ด้านล่าง (RC2) | `http://localhost:5173,https://asset.example.com` |
| `CORS_ALLOW_PAGES_PREVIEWS` | ควบคุม HTTPS preview subdomain ของ Cloudflare Pages; เมื่อไม่กำหนดจะเปิดอัตโนมัติเฉพาะ project ที่มี production origin อยู่ใน allowlist | auto |
| `AUTH_RATE_LIMIT_WINDOW_MS` | ความยาวหน้าต่างเวลานับจำนวนครั้ง login/register ต่อ IP (ms) — ไม่บังคับ ค่า default 900000 (15 นาที) (RC2) | `900000` |
| `AUTH_RATE_LIMIT_MAX` | จำนวนครั้งสูงสุดที่ยิง login/register ได้ต่อ IP ในหน้าต่างเวลานั้น — ไม่บังคับ ค่า default 10 (RC2) | `10` |
| `SEED_DEMO_DATA` | รัน seed แบบ idempotent ตอน container เริ่ม หลัง migration; เปิดเฉพาะ Portfolio/Demo deployment | `false` |
| `DEMO_ACCOUNT_PASSWORD` | รหัสผ่านบัญชีตัวอย่างเมื่อ seed บน production; ต้องเก็บเป็น deployment secret และห้าม commit | ไม่กำหนด |
| `EMAIL_ENABLED` | เปิดการส่งอีเมล; เมื่อเป็น `false` ระบบบันทึก outbox เป็น `SKIPPED` และ In-app/workflow ยังทำงาน | `false` |
| `EMAIL_PROVIDER` | Provider adapter เริ่มต้น (ปัจจุบันรองรับ `resend`) | `resend` |
| `RESEND_API_KEY` | API key ของ Resend — backend secret เท่านั้น ห้ามใส่ใน `VITE_*` หรือ commit | ไม่กำหนด |
| `SCHEDULER_SECRET` | secret แบบสุ่มอย่างน้อย 32 ตัวอักษร สำหรับ GitHub Actions เรียก scheduler endpoint ภายใน | ไม่กำหนด |
| `EMAIL_FROM` | ผู้ส่งบนโดเมนที่ Verify แล้ว | `IT Asset Management <noreply@example.com>` |
| `EMAIL_REPLY_TO` | Reply-To (ไม่บังคับ) | `support@example.com` |
| `APP_URL` | URL หน้าเว็บที่ปุ่มในอีเมลพากลับมา | `http://localhost:5173` |
| `EMAIL_MAX_ATTEMPTS` | จำนวนครั้งสูงสุดที่ worker retry แบบ exponential backoff | `5` |
| `EMAIL_TIMEOUT_MS` | Timeout ต่อคำขอไป Provider | `10000` |
| `EMAIL_VERIFY_RATE_LIMIT_MAX` | จำนวน Verification/Test Email สูงสุดต่อ 15 นาทีต่อบัญชี | `5` |

Frontend อ่าน `VITE_API_URL` ผ่าน `import.meta.env` โดยกำหนดใน `apps/web/.env*` หรือ build environment
ของผู้ให้บริการ ค่า `VITE_*` เป็นข้อมูลสาธารณะที่ถูกฝังลง JavaScript bundle ห้ามนำ secret มาใส่:

| ไฟล์/Environment | ค่า |
|------------------|-----|
| Local dev (ค่า default) | `http://localhost:4000` |
| Cloudflare Pages | `https://it-asset-management-api.onrender.com` |
| Generic production | คัดลอก `apps/web/.env.production.example` แล้วแก้ URL |

`npm run build` ใช้โหมด Cloudflare และโหลด `apps/web/.env.cloudflare`; ค่า `VITE_API_URL` ใน Cloudflare
Dashboard มีลำดับความสำคัญสูงกว่าไฟล์นี้ ส่วน Docker ใช้ `npm run build:self-hosted` เพื่อคงการเชื่อมต่อ
แบบ same-origin ผ่าน nginx ตามเดิม

---

## 🛡️ Production Hardening (Release Candidate 2)

RC2 เพิ่มความพร้อมด้าน reliability/security/operational readiness ให้ backend — ไม่มีการเปลี่ยน business
logic, database schema, หรือ API endpoint ใด ๆ เลย (ดู [CHANGELOG](CHANGELOG.md) สำหรับรายละเอียดทุกจุดที่แก้)

### 🚦 Rate Limiting

`POST /api/auth/login` และ `POST /api/auth/register` จำกัดจำนวนครั้งต่อ IP ในหน้าต่างเวลาเดียวกัน (ใช้
[express-rate-limit](https://github.com/express-rate-limit/express-rate-limit)) กัน brute-force รหัสผ่าน
และสแปมสร้างบัญชี — ปรับได้ผ่าน `AUTH_RATE_LIMIT_WINDOW_MS`/`AUTH_RATE_LIMIT_MAX` (ดู Environment Variables
ด้านบน) เกินโควตาแล้วตอบ **HTTP 429** ด้วย response envelope เดียวกับ error อื่นทั้งระบบ:
```json
{ "success": false, "message": "พยายามเข้าสู่ระบบ/สมัครสมาชิกบ่อยเกินไป กรุณาลองใหม่อีกครั้งในภายหลัง" }
```
login และ register ใช้โควตาร่วมกัน (นับรวมต่อ IP ไม่แยกตาม endpoint) — ตั้งใจ กันไม่ให้สลับไปมาระหว่างสอง
endpoint เพื่อหลบ limit ได้ ไม่แตะ logic การตรวจสอบ credential/สมัครสมาชิกเดิมเลยแม้แต่บรรทัดเดียว

### 🔌 Graceful Shutdown

Backend ดักสัญญาณ `SIGTERM` และ `SIGINT` (ที่ ECS/Docker/Ctrl+C ส่งมาก่อนฆ่า process จริง) แล้วปิดตัวแบบ
เรียบร้อยตามลำดับ: (1) เลิกรับ connection ใหม่ แต่ request ที่ค้างอยู่ทำงานจนจบตามปกติก่อน (2) ปิดการเชื่อมต่อ
ฐานข้อมูล (`prisma.$disconnect()`) (3) exit ด้วย status code ที่เหมาะสม (0 = ปิดสำเร็จ, 1 = มีปัญหาระหว่างปิด)
มี timer บังคับปิดถ้ารอนานเกินไป (10 วินาที) กัน process ค้าง แต่ละขั้นตอนถูก log ไว้ชัดเจน — ผลคือ deploy/
scale-in บน ECS ไม่ทำให้ request ที่กำลังทำงานอยู่ถูกตัดกลางคันอีกต่อไป

### ❤️ Health Endpoint

`/health` และ `/api/health` เดิมตอบ 200 เสมอโดยไม่เช็กอะไรเลย — ตอนนี้เช็กการเชื่อมต่อฐานข้อมูลจริงด้วย
(`SELECT 1` ผ่าน Prisma):

| สถานะ | HTTP Status | Response |
|-------|-------------|----------|
| ฐานข้อมูลเชื่อมต่อได้ | `200` | `{ "status": "ok", "time": "...", "database": "connected" }` |
| ฐานข้อมูลเชื่อมต่อไม่ได้ | `503` | `{ "status": "error", "time": "...", "database": "disconnected" }` |

ALB ใช้ endpoint นี้ตัดสินใจว่าจะส่ง traffic ไปที่ instance ไหน — instance ที่ต่อ DB ไม่ได้ตอนนี้จะถูกเอาออก
จาก rotation โดยอัตโนมัติ (เดิมตอบ 200 เสมอแม้ DB ล่ม ทำให้ ALB ยังส่ง traffic ไปเรื่อย ๆ)

### 📝 Request Logging

ทุก request เขียน log แบบ structured (JSON บรรทัดเดียว) ออก stdout หลัง response จบ — ให้ log collector ของ
production (เช่น CloudWatch Logs ที่ ECS ส่งเข้าไปอยู่แล้ว) เก็บไปวิเคราะห์ได้:
```json
{"requestId":"...", "method":"GET", "path":"/api/assets", "status":200, "durationMs":12.4, "ip":"..."}
```
**ไม่ log สิ่งที่อ่อนไหวโดยเจตนา**: ไม่มี request body (มี password ตอน login/register), ไม่มี header ใด ๆ
(มี `Authorization: Bearer <JWT>`), ไม่มี query string — `X-Request-Id` แนบมาที่ response header ด้วย ใช้
อ้างอิงตอน debug/แจ้งปัญหาได้

### 🔒 Security Headers

ใช้ [Helmet](https://helmetjs.github.io/) ใส่ security header มาตรฐานให้อัตโนมัติ (`X-Content-Type-Options`,
`X-Frame-Options`, `Strict-Transport-Security` ฯลฯ) ปิดเฉพาะ `contentSecurityPolicy` เพราะค่า default จะบล็อก
inline script/style ที่ Swagger UI (`/docs`) ต้องใช้ — header อื่นทั้งหมดยังเปิดใช้งานตามปกติ

### 🌐 CORS

เดิมใช้ `cors()` เฉย ๆ (อนุญาตทุก origin) — ตอนนี้อ่านจาก `CORS_ORIGIN` env var แทน (ไม่ hardcode origin ไว้
ในโค้ด):
- ตั้งค่า `CORS_ORIGIN` ไว้ → อนุญาตเฉพาะ origin ที่ระบุ (คั่นด้วยจุลภาคได้หลายตัว)
- ไม่ได้ตั้งค่า + `NODE_ENV=development` (ค่าเริ่มต้น) → reflect origin ที่ขอมา เหมือนพฤติกรรมเดิมก่อน RC2
  ทุกประการ (สะดวกตอน dev ที่ frontend/backend คนละพอร์ต)
- ไม่ได้ตั้งค่า + `NODE_ENV=production` → ปิดรับ cross-origin request ทั้งหมด (fail closed เพื่อความปลอดภัย)
- เมื่อ `CORS_ORIGIN` เป็น Cloudflare Pages production origin ระบบจะอนุญาตเฉพาะ HTTPS preview
  subdomain ของ project เดียวกันโดยอัตโนมัติ เช่น `https://<branch>.it-asset-management.pages.dev`
- ตั้ง `CORS_ALLOW_PAGES_PREVIEWS=false` เพื่อปิด Preview หรือ `true` เพื่อเปิดอย่างชัดเจน

Backend สะท้อนกลับเฉพาะ origin ที่ผ่าน allowlist จึงไม่ส่ง `Access-Control-Allow-Origin: *` เมื่อเปิด
credentials และไม่ยอมรับ hostname ที่เพียงแค่ต่อท้ายด้วยโดเมนหลอก

ในทางปฏิบัติ production จริงของโปรเจกต์นี้ (AWS ECS) ไม่ได้รับผลกระทบจากค่านี้เลย เพราะ ALB route ทั้ง
`/` และ `/api/*` อยู่ใต้ origin เดียวกัน (path-based routing — ดู `deploy/02-infra.sh`) จึงไม่ถือเป็น
cross-origin request ตั้งแต่ต้น ตั้งค่านี้มีผลจริงเฉพาะกรณีมี client อื่นเรียก API ข้าม origin จริง ๆ

### 🐳 Docker

- ทั้งสอง image เปลี่ยนจาก `node:20`/`node:20-alpine` เป็น `node:24`/`node:24-alpine` ให้ตรงกับ `.nvmrc` และ
  CI (เดิม Docker image กับ CI/dev ใช้ Node คนละเวอร์ชันกัน)
- `npm install` เปลี่ยนเป็น `npm ci` ทั้งสอง Dockerfile — ติดตั้ง dependency ตรงกับ `package-lock.json` เป๊ะ ๆ
  เหมือนที่ CI ทดสอบผ่าน กัน dependency drift ระหว่างสิ่งที่ CI ทดสอบกับสิ่งที่ image จริงมี
- Backend container รันเป็น non-root user (`node`, UID 1000 — user ที่มีอยู่แล้วในตัว official image) แทนที่
  จะรันเป็น root เหมือนเดิม — least privilege ตาม container security baseline

---

## 🚀 Production Deployment & Operations (Release Candidate 3)

RC3 เพิ่มโครงสร้างและเอกสารสำหรับ deploy ระบบขึ้น production จริง — **ไม่มีการเพิ่ม business feature,
เปลี่ยน API, หรือแก้ database schema ใด ๆ เลย** (ยกเว้นปรับ RDS backup retention 1→7 วัน) ดูรายละเอียด
ทุกจุดที่แก้ไขได้ที่ [CHANGELOG](CHANGELOG.md)

### ☁️ Cloudflare Pages + Render (Current Production)

**Cloudflare Pages — Frontend**

| Setting | Value |
|---------|-------|
| Root directory | `apps/web` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Production branch | `master` |
| `VITE_API_URL` | `https://it-asset-management-api.onrender.com` |

`apps/web/.env.cloudflare` เก็บเฉพาะ API URL สาธารณะเพื่อให้ build ทำงานถูกต้องแม้ Dashboard ยังไม่ได้
ตั้งค่า และ Cloudflare environment variable สามารถ override ได้ การเปลี่ยนค่า Vite env ต้อง **Redeploy**
เพราะถูกฝังตอน build ไม่ได้อ่านตอน runtime

**Render — Backend**

| Setting | Value |
|---------|-------|
| Root directory | `apps/api` |
| Build command | `npm ci && npm run generate` |
| Pre-deploy command | `npm run migrate` |
| Start command | `npm start` |
| Health check path | `/api/health` |

Environment ที่จำเป็น: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`,
`CORS_ORIGIN=https://it-asset-management.pages.dev`, `CORS_ALLOW_PAGES_PREVIEWS=true` และ
`TRUST_PROXY=1` ส่วน `PORT` ให้ใช้ค่าที่ Render inject มาโดยอัตโนมัติ (Express อ่าน `process.env.PORT` อยู่แล้ว)
ห้ามเติม path ต่อท้าย `CORS_ORIGIN` และไม่ต้องใช้ wildcard

Expected login flow:

```text
Cloudflare Pages
  -> POST https://it-asset-management-api.onrender.com/api/auth/login
  -> Express validates credentials and returns JWT
  -> Frontend stores token and redirects to Dashboard
```

ตรวจหลัง deploy:

```bash
curl https://it-asset-management-api.onrender.com/api/health
curl -i -X OPTIONS https://it-asset-management-api.onrender.com/api/auth/login \
  -H "Origin: https://it-asset-management.pages.dev" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization"
```

### 🐳 Production Docker Images

Dockerfile ทั้งสองตัว (`apps/api/Dockerfile`, `apps/web/Dockerfile`) เดิมของ RC2 ยังใช้เหมือนเดิมทุก
ประการ (ไม่ได้แยกไฟล์ใหม่) เพิ่มเข้ามาเฉพาะ:
- **HEALTHCHECK**: backend เช็ก `/health` ด้วย Node's built-in `http` module (ไม่ติดตั้ง curl เพิ่ม —
  minimal attack surface), frontend เช็ก `/healthz` ด้วย `wget` ที่มีอยู่แล้วใน `nginx:alpine` base image
- **OCI image labels** (`org.opencontainers.image.title/description/licenses`) — metadata มาตรฐานสำหรับ
  registry/scanning tools ไม่มีผลต่อพฤติกรรมรันไทม์

### 🗺️ สอง Deployment Path

| Path | ใช้เมื่อไร | ไฟล์หลัก |
|------|-----------|----------|
| **A. AWS ECS Fargate** (เดิมจาก Milestone ก่อน RC3) | ต้องการ managed infra, auto-scaling, ALB, RDS managed | `deploy/*.sh` |
| **B. Self-hosted Docker Compose** (ใหม่ใน RC3) | มีเซิร์ฟเวอร์/VPS ของตัวเอง ต้องการควบคุมเต็มรูปแบบ | `docker-compose.prod.yml` + `.env.production` |

`docker-compose.yml` (dev) **ไม่ถูกแก้แม้แต่บรรทัดเดียว** — `docker-compose.prod.yml` เป็นไฟล์แยกต่างหาก
ทั้งหมด ต่างจาก dev ตรงที่: `restart: always` ทุก service, `db`/`api` ไม่ publish port ออก host เลย
(ลด attack surface — เข้าถึงได้เฉพาะใน docker network เดียวกัน), แยก network เป็น 2 วง
(`frontend-net`/`backend-net` — `db` คุยกับ `web` ตรง ๆ ไม่ได้), และ nginx ใช้
[`apps/web/nginx.prod.conf`](apps/web/nginx.prod.conf) (gzip, cache header, security header, HSTS,
proxy timeout) แทน config เดิม

วิธีใช้ทาง B:
```bash
cp .env.production.example .env.production   # แก้ค่าทุกตัวที่มี CHANGE-ME
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

รายละเอียดเต็ม (server requirements, build, startup, migration, log locations, troubleshooting) อยู่ที่
[**docs/DEPLOYMENT.md**](docs/DEPLOYMENT.md)

### 🌐 Nginx Reverse Proxy (Production)

`nginx.prod.conf` เพิ่มจาก config เดิมของ dev:
- **gzip** compression (comp_level 6) สำหรับ text/css/json/js/xml/svg — **Brotli ยังไม่เปิดใช้งาน**
  (`nginx:alpine` ไม่มี `ngx_brotli` module ในตัว ต้องใช้ custom image — เว้นไว้เพื่อลดความเสี่ยง ดู
  Known Limitations)
- **Security headers**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `X-XSS-Protection`, `Strict-Transport-Security`; compose terminate TLS ที่ nginx และ AWS terminate ที่ ALB/ACM
- **Static asset caching**: ไฟล์ที่ผ่าน content-hash แล้ว (`/assets/*-[hash].js`) cache 1 ปีแบบ
  `immutable`, ส่วน `index.html` ใช้ `no-cache` เสมอ (กันเสิร์ฟ entry point เก่าที่ชี้ asset ที่ถูกลบไปแล้ว)
- **Proxy timeout**: `proxy_read_timeout 120s` (นานกว่า default) รองรับ export PDF/Excel รายงานใหญ่ที่ใช้เวลานาน

### ⚙️ Environment Variables (Production)

ทาง B ใช้ [`.env.production.example`](.env.production.example) เป็นต้นแบบ (แยกจาก `.env.example` ที่ใช้ตอน dev):

| ตัวแปร | ความหมาย |
|--------|----------|
| `DB_USER`/`DB_PASSWORD`/`DB_NAME` | สร้าง Postgres container ใน `docker-compose.prod.yml` |
| `DATABASE_URL` | connection string ที่ backend ใช้จริง — host เป็นชื่อ service `db` (ไม่ใช่ `localhost`) |
| `JWT_SECRET` | สร้างด้วย `openssl rand -hex 32` — **ห้ามใช้ค่าตัวอย่าง** |
| `NODE_ENV` | ต้องเป็น `production` เสมอสำหรับไฟล์นี้ |
| `TRUST_PROXY` | จำนวน reverse proxy hop หน้า Express (topology มาตรฐานใช้ `1`) |
| `CORS_ORIGIN` | ปกติปล่อยว่างได้ — topology มาตรฐานของ compose นี้เป็น same-origin ผ่าน nginx อยู่แล้ว |
| `CORS_ALLOW_PAGES_PREVIEWS` | ปกติ auto ตาม `CORS_ORIGIN`; ตั้ง `false` สำหรับ self-hosted ที่ไม่ใช้ Pages Preview |
| `AUTH_RATE_LIMIT_WINDOW_MS`/`AUTH_RATE_LIMIT_MAX` | ค่า default ใช้งานได้เลย ไม่บังคับตั้ง |
| `PORT` | พอร์ตภายใน container ของ backend (default `4000`) |
| `TLS_CERT_PATH`/`TLS_KEY_PATH` | certificate/private key สำหรับ nginx self-hosted |

ทาง A (AWS ECS) ยังใช้ `deploy/config.sh` เหมือนเดิม (ดู `deploy/config.example.sh`) — ไม่เกี่ยวกับ
`.env.production` ไฟล์นี้เลย

### 💾 Backup & Recovery

RDS automated backup retention ปรับจาก 1 วัน → **7 วัน** (`deploy/02-infra.sh`) สำหรับทาง A — ทาง B
(self-hosted) ต้องตั้ง scheduled backup เอง (`pg_dump` ผ่าน cron) เพราะแต่ละ host มีเครื่องมือ scheduling
ต่างกัน ไม่ได้ทำให้อัตโนมัติในโค้ดโดยตั้งใจ ขั้นตอน backup/restore/disaster recovery เต็มรูปแบบอยู่ที่
[**docs/BACKUP_RECOVERY.md**](docs/BACKUP_RECOVERY.md)

### ⏪ Rollback Strategy

ครอบคลุม application rollback (ECS task definition revision / git tag + rebuild), database migration
rollback (เขียน SQL ย้อนกลับด้วยมือ หรือ restore จาก backup — Prisma ไม่มี down-migration อัตโนมัติ),
Docker image rollback, และ health verification หลัง rollback — รายละเอียดเต็มที่
[**docs/ROLLBACK.md**](docs/ROLLBACK.md)

### 📋 Production Checklist

Checklist ก่อน deploy จริงครอบคลุม Infrastructure/Deployment/Security/Monitoring/Recovery/
Documentation/Operations/Release process — ดู
[**docs/PRODUCTION_CHECKLIST.md**](docs/PRODUCTION_CHECKLIST.md)

### 📚 เอกสารที่เกี่ยวข้องทั้งหมด (RC3)

| เอกสาร | เนื้อหา |
|--------|---------|
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | คู่มือ deploy เต็มรูปแบบ ทั้งสอง path |
| [docs/BACKUP_RECOVERY.md](docs/BACKUP_RECOVERY.md) | backup, retention, restore, disaster recovery |
| [docs/ROLLBACK.md](docs/ROLLBACK.md) | rollback โค้ด/migration/Docker image |
| [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md) | checklist ก่อน deploy จริง |
| [CONTRIBUTING.md](CONTRIBUTING.md) | วิธี contribute เข้าโปรเจกต์ |

---

## 📊 Reports & Export

หน้า "รายงาน" มีการ์ดให้เลือก 10 รายงาน — คลิกแล้วเข้าโหมด preview (ตัวกรอง + ตาราง) พร้อมปุ่มส่งออก
CSV / Excel / PDF ที่มุมขวาบนของตาราง ทุกรายงานอ่านจากตารางที่มีอยู่แล้วเท่านั้น ไม่มีการคำนวณ/เก็บข้อมูลใหม่

| รายงาน | คอลัมน์ | ตัวกรองที่รองรับ | ขอบเขต EMPLOYEE |
|--------|---------|-------------------|-------------------|
| **Asset Inventory** | Asset Tag, ชื่ออุปกรณ์, หมวดหมู่, สถานที่ตั้ง, แผนก, ผู้ขาย/ผู้ผลิต, สถานะ, ผู้ถือครองปัจจุบัน, วันหมดประกัน, วันที่ซื้อ, ราคาซื้อ | ช่วงวันที่ซื้อ, หมวดหมู่, สถานที่ตั้ง, แผนก, ผู้ขาย, สถานะ, ค้นหา | เฉพาะครุภัณฑ์ที่ตัวเองถือครองอยู่ |
| **Asset Assignment** | ครุภัณฑ์, พนักงาน, วันที่มอบหมาย, วันที่คืน, สถานะการมอบหมาย, สภาพก่อน/หลัง, หมายเหตุ | ช่วงวันที่มอบหมาย, หมวดหมู่, สถานที่ตั้ง, แผนก, ผู้ขาย, สถานะการมอบหมาย, ค้นหา | เฉพาะประวัติที่ตัวเองเป็นผู้ถือครอง |
| **Return Report** | พนักงาน, ครุภัณฑ์, วันที่คืน, ผู้ตรวจรับ, สภาพ, ผลตรวจ, สถานะ, ระยะเวลาดำเนินการ | ช่วงวันที่เริ่มรับคืน, ค้นหา | เฉพาะประวัติการรับคืนของตัวเอง |
| **Warranty Report** | Asset Tag, ชื่ออุปกรณ์, หมวดหมู่, แผนก, ผู้ขาย/ผู้ผลิต, วันหมดประกัน, จำนวนวันคงเหลือ, สถานะประกัน | สถานะประกัน (หมดแล้ว/ใกล้หมด 30/90 วัน/ปกติ), หมวดหมู่, สถานที่ตั้ง, แผนก, ผู้ขาย, ค้นหา | เฉพาะครุภัณฑ์ที่ตัวเองถือครองอยู่ |
| **Helpdesk Report** | เลขที่ใบแจ้ง, ครุภัณฑ์, ความสำคัญ, สถานะ, ผู้ดูแล, วันที่แจ้ง/แก้ไขสำเร็จ/ปิดงาน, ระยะเวลาแก้ไข (ชั่วโมง) | ช่วงวันที่แจ้ง, หมวดหมู่/สถานที่/แผนก/ผู้ขายของครุภัณฑ์ที่ผูกอยู่, สถานะตั๋ว, หมวดหมู่ปัญหา, ค้นหา | เฉพาะตั๋วที่ตัวเองแจ้ง |
| **Borrow Request Report** | เลขคำขอ, พนักงาน, ครุภัณฑ์, วันที่ขอ/คืน, สถานะ, ผู้อนุมัติ, เหตุผล | ช่วงวันที่ขอ, สถานะ, ค้นหา | เฉพาะคำขอของตัวเอง |
| **Approval Report** | คำขอ, ผู้พิจารณา, ผลตัดสินใจ, เวลา, ระยะเวลาอนุมัติ, ความคิดเห็น | ช่วงวันที่ขอ, ผลตัดสินใจ, ค้นหา | **เข้าไม่ได้ (403)** — ภาพรวมผู้อนุมัติ |
| **Notification Summary** | ประเภท, ความสำคัญ, ทั้งหมด, ยังไม่อ่าน, อ่านแล้ว | ช่วงวันที่, ประเภท, ความสำคัญ, ค้นหา | เฉพาะรายการที่ส่งถึงบัญชีตนเอง |
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

## 👥 Employee Management & Assignment Integration (v1.1.0)

Employee เป็นทะเบียนบุคลากรที่แยกจากบัญชี `User` และเป็น business identity ของผู้ถือครองครุภัณฑ์
หน้า **พนักงาน** เปิดให้ ADMIN/IT_STAFF ใช้งานผ่าน sidebar เดิม รองรับค้นหารหัส ชื่อเต็ม อีเมล โทรศัพท์,
กรองสถานะ/แผนก, แบ่งหน้า และ Archive/Restore แบบ soft delete

| Method | Endpoint | ADMIN | IT_STAFF | EMPLOYEE |
|--------|----------|-------|----------|----------|
| GET | `/api/employees` | อ่าน | อ่าน | 403 |
| GET | `/api/employees/:id` | อ่าน | อ่าน | 403 |
| POST | `/api/employees` | สร้าง | สร้าง | 403 |
| PUT | `/api/employees/:id` | แก้ไข | แก้ไข | 403 |
| DELETE | `/api/employees/:id` | Archive | 403 | 403 |
| POST | `/api/employees/:id/restore` | Restore | 403 | 403 |

`employeeCode` ไม่ซ้ำทั้งรายการปัจจุบันและ Archive, `fullName` คำนวณจากชื่อ/นามสกุลที่ backend และการลบ
ไม่เคยลบแถวจริง ใน Phase 2 Assignment ใหม่เลือกเฉพาะ Employee ที่ Active และไม่ถูก archive; User ยังคง
ใช้ login/RBAC และระบุผู้ทำรายการ มาตรฐาน migration จะ backfill ด้วยอีเมลเฉพาะกรณี match ได้เพียงรายการเดียว
จึงไม่เดาหรือเขียนทับข้อมูลเก่าที่กำกวม

---

## 📋 Borrow Request & Approval Workflow (v1.1.0)

หน้า **คำขอยืม** เป็นขั้นตอนก่อน Assignment: Employee ที่เชื่อมกับทะเบียนพนักงานสถานะ ACTIVE เลือก
ครุภัณฑ์ที่ไม่มีผู้ถือครอง ส่งเหตุผลและวันที่คาดว่าจะคืน จากนั้น ADMIN/IT_STAFF ตรวจคิวอนุมัติ

| Action | EMPLOYEE | ADMIN | IT_STAFF |
|--------|----------|-------|----------|
| ดูรายการ | เฉพาะของตนเอง | ทั้งหมด | ทั้งหมด |
| สร้างคำขอ | ได้ | 403 | 403 |
| ยกเลิก | เฉพาะของตนเองที่ PENDING | 403 | 403 |
| อนุมัติ / ปฏิเสธ | 403 | ได้ | ได้ |

การอนุมัติใช้ Serializable transaction: ตรวจ Employee ACTIVE และ active assignment ซ้ำ, สร้าง Assignment
โดย Employee เป็นผู้ถือครองและ User ปัจจุบันเป็น operator, จากนั้นตั้งคำขอเป็น `COMPLETED` หากมีการอนุมัติ
พร้อมกันสำหรับครุภัณฑ์ชิ้นเดียว partial unique index เดิมจะทำให้มีเพียงรายการเดียวสำเร็จ ส่วนอีกคำขอตอบ 409

Phase 4 เพิ่ม `BorrowRequestApproval` แบบ append-only เพื่อเก็บ Timeline, ผู้ดำเนินการ, เวลา และความคิดเห็น
โดยข้อมูลคำขอเดิมถูก backfill เท่าที่ระบุผู้ทำรายการได้ การตัดสินใจยังคงเป็น ADMIN/IT_STAFF เท่านั้นและไม่แก้
Authentication, Assignment schema หรือ RBAC เดิม

Dashboard แสดง Pending/Approved Today/Rejected Today/Average Approval Time และ Reports มีทั้ง Borrow Request
Report กับ Approval Report ซึ่งแสดง Approval Duration และ Top Approvers พร้อม export CSV/Excel/PDF

---

## 🔄 Return Inspection Workflow (v1.1.0)

การรับคืนยังเริ่มจากหน้า **การมอบหมาย** เดิม แต่เพิ่มขั้นตรวจรับก่อนปิด Assignment:

`ASSIGNED → PENDING_INSPECTION → PASSED/FAILED → RETURNED/DAMAGED/LOST`

ADMIN/IT_STAFF เริ่มตรวจรับและบันทึกสภาพ, หมายเหตุ, วันที่ตรวจ/คืน โดยระบบกำหนด Inspector จากบัญชี
ที่ล็อกอินและเก็บ `AssignmentReturnEvent` แบบ append-only สำหรับ Timeline ทุกขั้น เมื่อผ่านจะปิด Assignment
ตามปกติ; เมื่อชำรุดจะอัปเดต `Asset.assetCondition`; เมื่อสูญหายจะบันทึก Audit event เฉพาะทาง

| Method | Endpoint | หน้าที่ |
|--------|----------|--------|
| POST | `/api/assignments/:id/return/start` | เริ่มสถานะ `PENDING_INSPECTION` โดยยังไม่ปิด Assignment |
| POST | `/api/assignments/:id/return/inspect` | บันทึกผลตรวจ ผู้ตรวจ เวลา และปิดผลลัพธ์ |
| POST | `/api/assignments/:id/return` | API เดิมแบบ atomic inspection สำหรับ backward compatibility |
| GET | `/api/reports/returns` | Preview/Export Return Report ตามขอบเขต RBAC |

Dashboard แสดง Pending Inspections, Completed Returns Today, Damaged Returns, Lost Assets และ Average Return
Processing Time ส่วนข้อมูลก่อน alpha.5 จะถูก backfill เฉพาะสิ่งที่ทราบจริงและไม่สร้าง Inspector/Result ย้อนหลัง

---

## 🔔 Notifications & Reminder System (v1.1.0)

ระบบสร้าง Notification หลัง workflow สำเร็จสำหรับคำขอยืม, ผลอนุมัติ, การมอบหมาย, รอตรวจรับ และผลการคืน
โดยความล้มเหลวของชั้นการสื่อสารไม่ rollback ธุรกรรม lifecycle เดิม ผู้ใช้ทุก role เห็นเฉพาะรายการที่ส่งถึง
`userId` ของตนเอง และ DELETE เป็น soft delete เสมอ

| Method | Endpoint | หน้าที่ |
|--------|----------|--------|
| GET | `/api/notifications` | ค้นหา/กรอง/แบ่งหน้ารายการของตนเอง |
| GET | `/api/notifications/unread-count` | จำนวนที่ยังไม่อ่านสำหรับ badge |
| POST | `/api/notifications/:id/read` | อ่านหนึ่งรายการ |
| POST | `/api/notifications/read-all` | อ่านทั้งหมด |
| DELETE | `/api/notifications/:id` | เก็บเข้าคลังแบบ soft delete |

Reminder ก่อนกำหนด 3 วันและ overdue ไม่ขึ้นกับการเปิด Dashboard แล้ว ใช้ database `dedupeKey` แบบ unique
และรันผ่าน scheduler interface เดียวกับ audit retry:

```bash
cd apps/api
npm run scheduler
```

ตั้ง cron/EventBridge ให้เรียกคำสั่งนี้เป็นระยะ (แนะนำทุก 5 นาที) การเรียกซ้ำหรือทำงานพร้อมกันไม่สร้างรายการซ้ำ

Production บน Cloudflare Pages + Render ใช้ `.github/workflows/scheduler.yml` เพื่อไม่ต้องเปิด Render Cron Job:

1. สร้าง secret แบบสุ่มอย่างน้อย 32 ตัวอักษร แล้วตั้งค่า `SCHEDULER_SECRET` ค่าเดียวกันทั้ง Render Web Service
   และ GitHub Actions repository secret
2. สร้าง GitHub Actions repository variable ชื่อ `SCHEDULER_URL` เป็น
   `https://it-asset-management-api.onrender.com/api/internal/scheduler/run`
3. Workflow รันทุก 5 นาทีและเรียก endpoint ผ่าน HTTPS ด้วย Bearer secret; endpoint ไม่ใช้ User JWT,
   ไม่อยู่ใน Swagger และตอบ `401` เมื่อ secret หาย/สั้น/ไม่ตรง
4. ทดสอบทันทีได้จาก GitHub Actions > Notification and Outbox Scheduler > Run workflow

วิธีนี้ไม่เก็บ `DATABASE_URL` หรือ `RESEND_API_KEY` ใน GitHub เพราะ Scheduler ทำงานภายใน Render Web Service
และใช้ environment เดิมของ Backend

---

## 📘 API Documentation (Swagger)

เอกสาร API แบบ interactive อยู่ที่ **`/docs`** (เช่น `http://localhost:4000/docs` ตอน dev หรือ
`http://localhost:8080/docs` ผ่าน nginx proxy ตอนรันด้วย Docker Compose) สร้างจาก [OpenAPI 3.1](https://www.openapis.org/)
ด้วย [swagger-jsdoc](https://github.com/Surnet/swagger-jsdoc) + [swagger-ui-express](https://github.com/scottie1984/swagger-ui-express)

### วิธีเปิด
1. รัน backend ตามขั้นตอนใน [Development Workflow](#️-development-workflow--วิธีรันแบบ-พัฒนา-แก้โค้ดแล้วเห็นผลทันที) ด้านบน (หรือ `docker compose up --build`)
2. เปิดเบราว์เซอร์ไปที่ `/docs`
3. Endpoint ทั้งหมด (81 endpoint methods) จัดกลุ่มตามหมวด (tag): Authentication, Users, Employees, Assets,
   Assignments, Borrow Requests, Notifications, Notification Settings, Dashboard, Master Data, Tickets, Reports, Audit Log, Health — แต่ละอันมี summary, description, พารามิเตอร์,
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
- Schema ที่ใช้ซ้ำได้ (`components.schemas`): `User`, `Employee`, `Asset`, `Assignment`, `BorrowRequest`, `Ticket`, `MasterDataItem`,
  `Vendor`, `DashboardResponse`, รายงานทั้ง 10 แบบ, `ErrorResponse`, `ValidationError`, `Pagination` ฯลฯ —
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

## 📝 Audit Log

หน้า "Audit Log" (เฉพาะ ADMIN/IT_STAFF) แสดงประวัติการทำรายการสำคัญทั้งระบบ — ตาราง (เวลา/ผู้ทำรายการ/
การกระทำ/ประเภท/รายละเอียด) พร้อมค้นหา, ตัวกรอง, แบ่งหน้า และกล่องรายละเอียดที่โชว์ค่าก่อน/หลังแก้ไข
(`oldValues`/`newValues`) เป็น JSON ที่จัดรูปแบบอ่านง่าย เป็นประวัติที่แก้ไข/ลบไม่ได้ (immutable) — ไม่มี
endpoint สร้าง/แก้ไข/ลบ audit record เลยแม้แต่ตัวเดียว

**Entity types ที่รองรับ:** Asset, Assignment, Ticket, Employee, BorrowRequest, Notification, Category, Department, Location, Vendor, User, Report

**Actions ที่รองรับ:** `CREATE`, `UPDATE`, `DELETE`, `ASSIGN`, `RETURN`, `OPEN`, `START_PROGRESS`, `ON_HOLD`,
`RESOLVE`, `CLOSE`, `RESTORE`, `LOGIN`, `EXPORT_REPORT`, `BORROW_REQUEST_CREATED`,
`BORROW_REQUEST_APPROVED`, `BORROW_REQUEST_REJECTED`, `BORROW_REQUEST_CANCELLED`, `APPROVAL_STARTED`,
`APPROVAL_APPROVED`, `APPROVAL_REJECTED`, `NOTIFICATION_SENT`, `NOTIFICATION_READ`

| เหตุการณ์ | Action ที่บันทึก | จุดที่เรียก |
|-----------|------------------|-------------|
| สร้าง/แก้ไข/ลบครุภัณฑ์ | `CREATE` / `UPDATE` / `DELETE` | `routes/assets.js` |
| สร้าง/แก้ไข/Archive/Restore พนักงาน | `CREATE` / `UPDATE` / `DELETE` / `RESTORE` | `routes/employees.js` |
| สร้าง/แก้ไข/ลบ master data (Category/Location/Department/Vendor) | `CREATE` / `UPDATE` / `DELETE` | `utils/masterDataRouter.js` (จุดเดียว ใช้ร่วมกันทั้ง 4 entity) |
| มอบหมาย / แก้ไขรายละเอียด / รับคืนครุภัณฑ์ | `ASSIGN` / `UPDATE` / `RETURN` | `routes/assignments.js` |
| สร้าง / อนุมัติ / ปฏิเสธ / ยกเลิกคำขอยืม | `BORROW_REQUEST_*` | `routes/borrowRequests.js` |
| เริ่ม / อนุมัติ / ปฏิเสธกระบวนการอนุมัติ | `APPROVAL_STARTED` / `APPROVAL_APPROVED` / `APPROVAL_REJECTED` | `routes/borrowRequests.js` |
| แจ้งปัญหาใหม่ / เริ่มดำเนินการ / พักงาน / แก้ไขสำเร็จ / ปิดงาน | `OPEN` / `START_PROGRESS` / `ON_HOLD` / `RESOLVE` / `CLOSE` | `routes/tickets.js` (action ตาม target status ของแต่ละ transition) |
| สมัครสมาชิก / เข้าสู่ระบบ | `CREATE` (entityType `User`) / `LOGIN` | `routes/auth.js` |
| ส่งออกรายงาน (CSV/Excel/PDF) | `EXPORT_REPORT` | `routes/reports.js` (ทุก endpoint ที่ `?format=` มา) |
| ส่งและอ่านการแจ้งเตือน | `NOTIFICATION_SENT` / `NOTIFICATION_READ` | `services/notificationService.js` / `routes/notifications.js` |

**กฎการบันทึก:** log เฉพาะการกระทำที่สำเร็จจริงเท่านั้น — validation ที่ล้มเหลว (400) หรือสิทธิ์ไม่พอ (403)
ไม่ถูกบันทึก การดำเนินการ Borrow Request อาจมีทั้ง lifecycle audit เดิมและ approval audit ใหม่ เพื่อรักษา
ความเข้ากันได้ของผู้ใช้ Audit Log เดิมพร้อมแยกเหตุการณ์อนุมัติให้ค้นหาได้ชัดเจน
ไม่มีการ log คำสั่ง GET ใด ๆ

**Reliability:** `logAudit()` ถูก `await` และ persist ลง `AuditOutbox` ก่อน จากนั้น dispatcher เขียน AuditLog
แบบ idempotent; ถ้า transient failure จะเก็บ error/backoff ไว้ให้ `npm run scheduler` retry

**RBAC:** ADMIN/IT_STAFF อ่านได้ทั้งหมด (`GET /api/audit`, `GET /api/audit/:id`), EMPLOYEE เข้าไม่ได้เลย (403)

**Dashboard:** ส่วน "Audit Log ล่าสุด" แสดง 10 เหตุการณ์ล่าสุดทั้งระบบ (เฉพาะ ADMIN/IT_STAFF — array ว่าง
สำหรับ EMPLOYEE) เป็นฟิลด์ใหม่ที่เพิ่มเข้าไปใน `GET /api/dashboard` เดิม ไม่ใช่หน้าแดชบอร์ดใหม่

---

## 🌿 Git Workflow

- Branch หลักคือ `master` — งานแต่ละ milestone ทำใน feature branch (เช่น `feature/asset-assignment`, `feature/ci-cd`)
- หนึ่ง milestone = หนึ่ง commit + หนึ่ง annotated tag (`v0.2.0` ... `v1.1.0`)
- ไม่ rewrite ประวัติ (ไม่ force-push, ไม่ amend commit ที่ผ่านไปแล้ว)
- ดูรายละเอียดการเปลี่ยนแปลงแต่ละเวอร์ชันได้ที่ [CHANGELOG.md](CHANGELOG.md)

### 🌳 Branch Strategy

| Branch | ใช้ทำอะไร |
|--------|-----------|
| `master` | โค้ดที่ผ่านการตรวจสอบแล้ว พร้อม deploy เสมอ — merge เข้าได้ก็ต่อเมื่อ CI ผ่านทุกขั้นตอนเท่านั้น |
| `feature/*` | หนึ่ง branch ต่อหนึ่ง milestone/งาน เช่น `feature/asset-assignment`, `feature/ci-cd` — CI รันอัตโนมัติทุก push เหมือนกับ `master` |

### 🤝 Contribution Workflow

1. แตก branch ใหม่จาก `master` ที่อัปเดตล่าสุด: `git checkout master && git pull && git checkout -b feature/ชื่องาน`
2. ทำงาน + commit เป็นระยะ (ข้อความ commit อธิบาย "ทำไม" ไม่ใช่แค่ "ทำอะไร")
3. รัน [Quality Checks](#-quality-checks) ในเครื่องตัวเองก่อน push เสมอ — กัน CI แดงโดยไม่จำเป็น
4. `git push origin feature/ชื่องาน` แล้วเปิด Pull Request เข้า `master`
5. รอ [CI](#️-cicd-pipeline) ผ่านทุกขั้นตอน (สีเขียว) ก่อน merge — ห้าม merge ถ้า CI ยังแดงอยู่
6. หนึ่ง milestone ที่เสร็จสมบูรณ์ = หนึ่ง annotated tag (ดูรูปแบบใน [CHANGELOG.md](CHANGELOG.md))

### 📁 Project Structure

โครงสร้างโฟลเดอร์แบบเต็มอยู่ที่หัวข้อ [🏗️ Architecture Overview](#️-architecture-overview) ด้านบน — สรุปสั้น ๆ:

```
webapp-starter/
├── .github/workflows/     CI pipeline (GitHub Actions)
├── apps/api/              Backend — Express + Prisma + PostgreSQL
├── apps/web/              Frontend — React + Vite
├── deploy/                สคริปต์ deploy ขึ้น AWS ECS
├── docs/                  คู่มือ deployment/backup/rollback/checklist (RC3)
├── docker-compose.yml     รันทั้งระบบบนเครื่องตัวเองด้วยคำสั่งเดียว (dev)
└── docker-compose.prod.yml   รัน production แบบ self-hosted (RC3)
```

---

## ⚙️ CI/CD Pipeline

โปรเจกต์นี้ใช้ [GitHub Actions](https://docs.github.com/en/actions) ตรวจสอบคุณภาพโค้ดอัตโนมัติทุกครั้งที่
push หรือเปิด/อัปเดต pull request — ดู workflow เต็มที่ [.github/workflows/ci.yml](.github/workflows/ci.yml)

### เมื่อไรที่ CI รัน
- ทุกครั้งที่ `push` เข้า `master` หรือ `feature/*`
- ทุกครั้งที่เปิดหรืออัปเดต pull request ที่มี `master` หรือ `feature/*` เป็น target branch

### ขั้นตอนของ CI (รันตามลำดับ ล้มเหลวจุดไหนหยุดทันที)

| ลำดับ | ขั้นตอน | ทำอะไร |
|-------|---------|--------|
| 1 | Checkout | ดึงโค้ดจาก commit ที่ trigger workflow |
| 2 | Setup Node.js | ติดตั้ง Node.js เวอร์ชัน Active LTS (อ่านจาก [.nvmrc](.nvmrc)) พร้อมเปิด npm cache |
| 3 | Install dependencies | `npm ci` ทั้ง `apps/api` และ `apps/web` แยกกัน (clean install จาก package-lock.json) |
| 4 | Validate Prisma schema | `prisma validate` — ตรวจ syntax ของ `schema.prisma` เท่านั้น **ไม่ migrate/เชื่อมต่อฐานข้อมูลจริง** |
| 5 | Lint | ESLint ทั้ง backend และ frontend แยกกัน |
| 6 | Test Backend | `node --test` — validation/search/filter/RBAC/audit policy โดยไม่เชื่อมฐานข้อมูลจริง |
| 7 | Build Backend | `prisma generate` — สร้าง Prisma Client (ยืนยันว่า schema ใช้งานได้จริง) |
| 8 | Build Frontend | `vite build` — build production bundle |
| 9 | Success summary | สรุปผลลัพธ์ทั้งหมดใน GitHub Actions job summary (แสดงเฉพาะตอนทุกขั้นตอนผ่าน) |

### เกิดอะไรขึ้นเมื่อ CI ล้มเหลว
- Job หยุดทันทีที่ step แรกที่ error (ไม่มี step ไหนตั้ง `continue-on-error` — ตาม design ที่ตั้งใจให้ "fail fast")
- Commit/Pull Request จะขึ้นเครื่องหมาย ❌ พร้อม log ของ step ที่ล้มเหลวให้ดูใน tab "Actions" ของ GitHub
- Badge ที่หัวไฟล์นี้จะเปลี่ยนเป็นสีแดงถ้า push ล่าสุดของ `master` ไม่ผ่าน
- ต้องแก้ปัญหาแล้ว push ใหม่ (หรือแก้ commit แล้ว force-push เฉพาะ branch ของตัวเอง ที่ยังไม่ merge) — CI จะรันซ้ำอัตโนมัติ

### 🔍 Quality Checks

รันคำสั่งเดียวกับที่ CI รันได้ในเครื่องตัวเองก่อน push เสมอ (กัน CI แดงโดยไม่จำเป็น):

```bash
# Backend (จาก apps/api)
npm run validate    # ตรวจ schema.prisma (เหมือน step 4 ใน CI)
npm run lint        # ESLint (เหมือน step 5)
npm test            # Node test runner (เหมือน step 6)
npm run build        # prisma generate (เหมือน step 7)

# Frontend (จาก apps/web)
npm run lint         # ESLint (เหมือน step 5)
npm run build         # vite build (เหมือน step 8)
```

**หมายเหตุ:** `prisma validate`/`prisma generate` ต้องมี `DATABASE_URL` อยู่ใน environment (แค่ต้อง "ตั้งค่าไว้"
ไม่จำเป็นต้องเชื่อมต่อได้จริง) — ถ้ามี `apps/api/.env` อยู่แล้ว (ตามขั้นตอนใน [Development Workflow](#️-development-workflow--วิธีรันแบบ-พัฒนา-แก้โค้ดแล้วเห็นผลทันที))
ก็ใช้ค่านั้นได้เลยโดยไม่ต้องตั้งอะไรเพิ่ม

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

พอเสร็จจะได้ URL หน้าตาแบบ `https://webapp-starter-alb-xxxx.ap-southeast-7.elb.amazonaws.com`

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
- **Automated tests ยังไม่ครอบคลุม browser E2E ทุก module** — CI รัน PostgreSQL migration/integration gate,
  unit/policy tests, lint และ production buildแล้ว แต่ visual regression/screen reader ยังต้องทำ manual ก่อน Stable
- **Frontend ไม่มี router library** — สลับหน้าด้วย state ธรรมดา เหมาะกับแอปขนาดนี้ แต่ไม่รองรับ URL ที่ deep-link ได้
  (เช่น กด back/forward ของเบราว์เซอร์ไม่เปลี่ยนหน้าจอ)
- **ไม่มี endpoint ลบใบแจ้งซ่อม** — เป็นการตัดสินใจเชิงออกแบบ (ประวัติการแจ้งซ่อมต้องอยู่ครบเสมอ เหมือน Assignment)
  ไม่ใช่ข้อจำกัดทางเทคนิค
- **Email delivery ต้องมี scheduler ภายนอก** — production ใช้ GitHub Actions เรียก operational endpoint ที่ป้องกัน
  ด้วย `SCHEDULER_SECRET`; deployment อื่นยังใช้ Render Cron Job, EventBridge หรือ `npm run scheduler` ได้
  การส่งจริงต้องใช้โดเมนที่ Verify SPF/DKIM กับ Resend แล้ว
- **EMPLOYEE แจ้งปัญหาได้เฉพาะครุภัณฑ์ที่ตัวเองถือครองอยู่** — ไม่สามารถแจ้งปัญหาแทนเพื่อนร่วมงานหรือครุภัณฑ์ส่วนกลาง
  (เช่น เครื่องพิมพ์/network switch) ได้ ต้องให้ ADMIN/IT_STAFF เป็นผู้แจ้งแทนในกรณีนี้
- **Export ดึงข้อมูลสูงสุด 25,000 แถวในคำสั่งเดียว (ไม่ใช่ DB cursor stream)** — HTTP response ของทั้ง 3 ฟอร์แมตเขียนแบบ
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
- **ไม่มีการ log LOGOUT** — ระบบไม่มี server-side logout endpoint (JWT เป็น stateless token, ออกจากระบบทำที่
  ฝั่งเว็บด้วยการลบ token ออกจาก `localStorage` เท่านั้น) จึงไม่มีจุดที่จะบันทึก audit event นี้ได้จริง
- **`AuditLog.performedById` ไม่ผูก Prisma relation กับ `User`** — เป็น string ธรรมดา ไม่มี foreign key
  constraint ระดับฐานข้อมูล (ตั้งใจ ดูเหตุผลที่ schema.prisma และหัวข้อ Architecture Overview) หมายความว่าถ้า
  ในอนาคตมี endpoint ลบผู้ใช้จริง ๆ audit log เก่าจะยังอ้างอิง id ที่ไม่มีตัวตนอยู่ในระบบแล้วได้ (แสดงผลเป็น
  "ระบบ/ไม่ทราบ" ที่หน้า Audit Log แทน ไม่ error)
- **Audit outbox ไม่มี dead-letter UI** — retry metadata อยู่ใน `AuditOutbox` และ scheduler retry อัตโนมัติ
  แต่การตรวจ/แก้ event ที่ล้มเหลวถาวรยังต้องทำผ่าน database/operations tooling
- **Rate limit เก็บสถานะไว้ในหน่วยความจำของแต่ละ instance (ไม่ใช่ distributed)** — ถ้า deploy หลาย instance
  พร้อมกัน (`desired-count` > 1) โควตาจะนับแยกอิสระต่อ instance ไม่รวมกัน (เช่น ตั้ง max 10 ครั้ง แต่มี
  2 instance = ผู้โจมตีมีโอกาสยิงได้จริงสูงสุด ~20 ครั้งถ้ากระจาย request ไปสองฝั่งพอดี) ปัจจุบัน deploy
  script ตั้ง `desired-count` ไว้ที่ 1 เท่านั้น (ดูหัวข้อ Deploy) จึงยังไม่กระทบจริง — ถ้าในอนาคต scale เกิน
  1 instance ควรย้ายไปใช้ store แบบ shared (เช่น Redis) แทน
- **ไม่มี email verification หรือ account lockout ถาวร** — rate limit ชะลอการ brute-force ได้ แต่ไม่ได้ล็อก
  บัญชีถาวรหลังพยายามผิดหลายครั้ง และไม่มีการยืนยันอีเมลตอนสมัครสมาชิก
- **Health check ตรวจแค่ "ต่อฐานข้อมูลได้ไหม" ไม่ได้ตรวจว่า schema ตรงกับ migration ล่าสุดหรือไม่** — ถ้า
  migration ค้าง (เช่น deploy image ใหม่ก่อนรัน migration) endpoint นี้จะยังตอบ "ok" อยู่ แม้ query บางอย่าง
  จะพังเพราะ column/table ไม่ตรงกับโค้ดจริงก็ตาม
- **Self-hosted TLS ต้องจัดหา certificate เอง** — compose เปิด HTTPS แล้วและ mount path จาก
  `TLS_CERT_PATH`/`TLS_KEY_PATH` แต่ repository ไม่ออก/renew Let's Encrypt certificate แทนผู้ดูแลระบบ
- **Brotli compression ยังไม่เปิดใช้งาน** (RC3) — `nginx:alpine` ไม่มี `ngx_brotli` module ในตัว ปัจจุบันใช้
  gzip เท่านั้น เปิด Brotli ได้ในอนาคตด้วยการ build custom nginx image
- **ไม่มี scheduled backup อัตโนมัติสำหรับทาง B (self-hosted)** (RC3) — เอกสารมีขั้นตอน backup/restore ให้
  ครบ (`docs/BACKUP_RECOVERY.md`) แต่ผู้ดูแลระบบต้องตั้ง cron/scheduler เองตามสภาพแวดล้อมของตัวเอง (ทาง A
  ผ่าน AWS ECS ใช้ RDS automated backup ที่มีอยู่แล้วโดยไม่ต้องตั้งอะไรเพิ่ม)

---

## 🗺️ Roadmap

- [x] Employee Management Foundation — model/migration, REST API, RBAC, Audit Log และ responsive UI (`v1.1.0-alpha.1`)
- [x] Assignment Integration Phase 2 — เชื่อม Employee กับ Assignment แบบ incremental โดยยังรักษาข้อมูล User เดิม (`v1.1.0-alpha.2`)
- [x] Borrow Request Workflow — submit/approve/reject/cancel, auto Assignment, Dashboard, Report และ Audit (`v1.1.0-alpha.3`)
- [x] Approval Workflow Enhancement — comments, reviewer, decision time, timeline, dashboard SLA metrics และ Approval Report (`v1.1.0-alpha.4`)
- [x] Return Workflow Enhancement — inspection, inspector, timeline, dashboard metrics, report และ audit (`v1.1.0-alpha.5`)
- [x] Notifications & Reminder System — workflow events, unread/read, due/overdue, Dashboard, Report และ Audit (`v1.1.0-beta.1`)
- [x] RC2 Production Hardening — identity FK, state transaction, scheduler/dedupe, audit outbox, TLS/proxy/indexes/a11y (`v1.1.0-rc2`)
- [ ] HR Integration บน Employee foundation
- [x] แจ้งเตือนอีเมลสำหรับ lifecycle/Helpdesk พร้อม Settings, verification, durable outbox และ retry
- [ ] รายงานประจำสัปดาห์อัตโนมัติ (อยู่นอกขอบเขต Email Notification รอบนี้)
- [ ] QR Code ติดครุภัณฑ์ (สแกนเพื่อดูรายละเอียด/แจ้งปัญหาได้ทันที) — ตั้งใจเว้นไว้จาก Milestone 7/8
- [ ] SLA tracking (เวลาตอบสนอง/แก้ไขตามระดับความสำคัญ) ต่อยอดจากโครง Ticket ที่มีอยู่แล้ว
- [ ] Background export job (queue) สำหรับรายงานขนาดใหญ่มาก — ปัจจุบัน export เป็น synchronous request
- [ ] จัดการผู้ใช้เต็มรูปแบบ (สร้าง/แก้ไข/ปิดใช้งาน/เปลี่ยน role) — เฉพาะ ADMIN
- [ ] ขยาย automated test suite ให้ครอบคลุม module เดิมทั้งหมดและเพิ่ม database/browser E2E ใน CI
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

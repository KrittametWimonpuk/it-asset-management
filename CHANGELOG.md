# Changelog

ทุกการเปลี่ยนแปลงที่มีนัยสำคัญของโปรเจกต์นี้บันทึกไว้ในไฟล์นี้ เรียงจากใหม่ไปเก่า
รูปแบบอ้างอิงจาก [Keep a Changelog](https://keepachangelog.com/) แบบคร่าว ๆ

---

## [v1.1.0-beta.1] — Notifications & Reminder System

Beta 1 เพิ่มชั้นการสื่อสารบน lifecycle เดิม โดย Notification เป็น best-effort หลังธุรกรรมสำเร็จ จึงไม่ทำให้
Borrow Request, Approval, Assignment หรือ Return ล้มเหลวหากการแจ้งเตือนมีปัญหา

### Added
- Migration expand-only `0014_notifications_reminders`: เพิ่ม `Notification`, `NotificationType`,
  `NotificationPriority`, recipient index และ soft delete โดยไม่แก้ตาราง lifecycle เดิม
- REST API สำหรับ list/unread count/read/read-all/soft delete ทุก endpoint จำกัดด้วย `userId` ของ JWT
- Workflow hooks สำหรับคำขอใหม่, อนุมัติ/ปฏิเสธ, มอบหมาย, รอตรวจรับ และผลคืนปกติ/ชำรุด/สูญหาย
- Due reminder 3 วันและ overdue reminder แบบ idempotent โดย generate เมื่อเปิด Notification/Dashboard
- กระดิ่ง unread badge/dropdown, หน้า Notification พร้อม search/filter/pagination/read/archive,
  responsive, dark mode, semantic list และ live status สำหรับ assistive technology
- Dashboard เพิ่ม Unread Notifications, Overdue Assets, Pending Actions
- Notification Summary Report พร้อม Preview และ export CSV/Excel/PDF
- Audit actions `NOTIFICATION_SENT`, `NOTIFICATION_READ` และ entity `Notification`
- OpenAPI/Swagger อัปเดตเป็น 75 methods พร้อม schema และ path ของ Notification

### Compatibility & Security
- Notification ทำงานหลัง core transaction และ helper จับ error ภายในเสมอ จึงไม่เปลี่ยนผลลัพธ์ workflow เดิม
- User ทุก role เห็น/อ่าน/ลบได้เฉพาะ notification ที่ส่งถึงบัญชีตนเอง; staff ได้เฉพาะ approval/pending inspection/
  overdue ที่เกี่ยวข้องกับงานฝ่ายดูแล
- Helpdesk notification เดิมในกระดิ่งยังคงอยู่และถูกผสานกับ Notification API

### Testing
- Prisma validate/generate, API/frontend lint, frontend production build และ backend tests `31/31` ผ่าน
- Migration `0014` apply สำเร็จบน PostgreSQL 16 และยืนยันครบ 14 migrations
- Docker E2E ผ่าน 23 assertions: workflow events, ไม่แจ้งผู้ส่งคำขอ, recipient scope/cross-user 404,
  unread/read/read-all, soft delete, upcoming/overdue/idempotency, return pending/completed, Dashboard,
  Notification Report, Audit และ unauthenticated 401
- ล้าง E2E marker หลังทดสอบและยืนยันเหลือ `0` รายการ

### Known Limitations
- Reminder รุ่น Beta ใช้ on-access sweep ยังไม่มี background scheduler จึงถูกสร้างเมื่อผู้ใช้เปิด Dashboard/
  Notification แทนการส่งตรงตามวินาทีขณะไม่มีผู้ใช้งาน
- Employee ที่ไม่มี User account อีเมลตรงกันจะไม่มีช่องทางรับ in-app notification
- ยังไม่มี email/push/WebSocket delivery และไม่มี source key สำหรับ dedupe ระดับ database
- Environment รอบนี้ไม่มี browser session เชื่อมต่อ จึงยืนยัน accessibility จาก semantic markup,
  keyboard-operable native controls, responsive CSS, lint/build แต่ยังไม่ได้ทดสอบด้วย NVDA และ visual regression จริง

---

## [v1.1.0-alpha.5] — Return Workflow Enhancement

เฟส 5 ขยายการรับคืนเดิมเป็น workflow ตรวจรับที่ติดตามได้ครบ โดยคง `Assignment.status`, Authentication,
RBAC, ผู้ถือครองแบบ Employee และ endpoint `/api/assignments/:id/return` เดิมไว้ทั้งหมด

### Added
- Migration expand-only `0013_return_workflow_enhancement`: เพิ่มสถานะ/ข้อมูลสรุปการตรวจรับแบบ nullable และ
  `AssignmentReturnEvent` สำหรับ Timeline append-only พร้อม backfill ประวัติปิด Assignment เดิมโดยไม่สร้างผู้ตรวจปลอม
- API `POST /api/assignments/:id/return/start` และ `/return/inspect`; ผู้ตรวจมาจาก User ที่ล็อกอินเท่านั้น
- ผลตรวจบังคับ condition/notes/date สำหรับการคืนจริง, ปิด Assignment อัตโนมัติเมื่อผ่าน และอัปเดต
  `Asset.assetCondition` เมื่อชำรุด
- Return dialog รองรับเริ่มตรวจ, บันทึก condition/notes/inspector/timestamps, status badges, timeline/history,
  keyboard focus, responsive และ dark mode
- Dashboard เพิ่ม Pending Inspections, Completed Returns Today, Damaged Returns, Lost Assets และ Average Return Processing Time
- Return Report แสดง Employee, Asset, Return Date, Inspector, Condition, Inspection Result และ Processing Time
  พร้อม Preview และ export CSV/Excel/PDF
- Audit actions `RETURN_STARTED`, `RETURN_INSPECTED`, `RETURN_COMPLETED`, `RETURN_DAMAGED`, `RETURN_LOST`
- OpenAPI/Swagger อัปเดตเป็น 69 methods พร้อม schema สำหรับ Return Workflow และ Return Report

### Compatibility & Security
- `/api/assignments/:id/return` เดิมยังรับ request body แบบเดิมและทำงานแบบ atomic inspection เพื่อไม่ทำให้ client เก่าพัง
- ฟิลด์ใหม่ทั้งหมด nullable และไม่ลบ/เปลี่ยน `userId`, `employeeId`, `AssignmentStatus` หรือข้อมูลเดิม
- ADMIN/IT_STAFF เท่านั้นที่เริ่มและตรวจรับ; EMPLOYEE ยังคง read-only ตาม scope เดิม

### Testing
- Prisma validate/generate, API lint, frontend lint (0 errors), backend tests `25/25` และ production build ผ่าน
- Migration `0013` apply สำเร็จบน PostgreSQL 16 และยืนยันครบ 13 migrations
- Docker E2E ผ่าน Start/Inspect/Return, normal/damaged/lost, API `/return` เดิม, ADMIN/IT_STAFF,
  EMPLOYEE 403, Dashboard metrics, Return Report และ Audit actions ครบ 5 รายการ
- ล้างข้อมูล E2E marker หลังทดสอบและยืนยัน Asset/Employee/Assignment คงเหลือ `0/0/0`

### Known Limitations
- Workflow เป็นการตรวจรับหนึ่งขั้นโดยผู้ตรวจคนเดียว ยังไม่มี re-inspection, checklist รายชิ้น, attachment หรือ e-signature
- ประวัติก่อน alpha.5 ไม่มีข้อมูล inspector/result เดิม จึงแสดงว่าไม่มีข้อมูลย้อนหลัง แต่วันคืน สภาพ หมายเหตุ และสถานะยังอยู่ครบ
- รอบตรวจนี้ไม่มี browser session เชื่อมต่อ จึงตรวจ accessibility จาก semantic markup/focus handling/lint/build
  แต่ยังไม่ได้ทำ screen-reader และ visual regression แบบ manual

---

## [v1.1.0-alpha.4] — Approval Workflow Enhancement

เฟส 4 เพิ่มข้อมูลประกอบการอนุมัติและประวัติการตัดสินใจบน Borrow Request เดิม โดยไม่เปลี่ยน Authentication,
RBAC หรือสถาปัตยกรรม Assignment

### Added
- `BorrowRequestApproval` และ enum `BorrowRequestApprovalAction` สำหรับ Timeline แบบ append-only พร้อม
  migration `0012_borrow_request_approval_history` ที่ backfill ข้อมูลคำขอเดิมเท่าที่ระบุผู้ดำเนินการได้
- Approve/Reject รองรับความคิดเห็น พร้อมผู้พิจารณาและเวลาตัดสินใจ; Reject ยังคงบังคับเหตุผลเหมือนเดิม
- Approval Queue มีแท็บ Pending/Approved/Rejected และ Timeline modal ที่แสดง reviewer, timestamp และ comment
- Dashboard เพิ่ม Average Approval Time โดยคำนวณที่ PostgreSQL; คง Pending/Approved Today/Rejected Today เดิม
- Approval Report แสดงระยะเวลาพิจารณาและ Top Approvers พร้อม Preview และ export CSV/Excel/PDF
- Audit actions `APPROVAL_STARTED`, `APPROVAL_APPROVED`, `APPROVAL_REJECTED`
- OpenAPI/Swagger อัปเดตเป็น 66 methods พร้อม schema ของ approval history/report

### Security & Compatibility
- ADMIN/IT_STAFF เท่านั้นที่ Approve/Reject; EMPLOYEE ไม่ได้รับสิทธิ์ใหม่และยังเห็นเฉพาะคำขอของตนเอง
- Approve ยังคงสร้าง Assignment ใน Serializable transaction เดิม และ request body แบบเดิมที่ไม่ส่ง comment
  ยังทำงานได้
- ไม่มีการแก้ Assignment schema, endpoint เดิม, Authentication หรือ role definitions

### Testing
- Prisma validate/generate, API lint, backend tests `21/21` และ frontend production build ผ่าน
- Migration `0012` apply สำเร็จบน PostgreSQL 16 และยืนยันครบ 12 migrations
- Docker E2E ผ่าน STARTED/APPROVED/REJECTED timeline, comments, reviewer, timestamps, automatic Assignment,
  ADMIN/IT_STAFF permissions, EMPLOYEE 403, Dashboard average time, Approval Report/Top Approvers และ Audit
- ล้างข้อมูล E2E ด้วย marker หลังทดสอบและยืนยัน BorrowRequest/Assignment/Approval คงเหลือ `0/0/0`

### Known Limitations
- เป็น single-step approval เท่านั้น ยังไม่มีหลายลำดับผู้อนุมัติ, delegation หรือ attachment
- รายการ REJECTED ก่อน alpha.4 ไม่มี reviewer เก็บไว้ใน BorrowRequest เดิม จึง backfill ผู้พิจารณาไม่ได้และแสดง
  "ไม่ทราบผู้ดำเนินการ"; เหตุผลและเวลายังคงอยู่ครบ

---

## [v1.1.0-alpha.3] — Borrow Request Workflow

เฟส 3 เพิ่มขั้นตอนคำขอยืมก่อนสร้าง Assignment โดยยังคง User authentication/RBAC และสถาปัตยกรรม
Assignment เดิมทั้งหมด Employee เป็นผู้ยืม และ User ของ ADMIN/IT_STAFF เป็นผู้อนุมัติหรือปฏิเสธ

### Added
- Prisma model/enum `BorrowRequest`/`BorrowRequestStatus` และ migration `0011_borrow_request_workflow`
  พร้อมเลขคำขอ `BR-000001` จาก PostgreSQL sequence, foreign keys, indexes และ soft delete
- REST workflow สำหรับ list/detail/create/approve/reject/cancel พร้อม pagination, sorting, status filter,
  search, response envelope, Zod validation และ RBAC ตาม role
- การ Approve ทำใน Serializable transaction: ตรวจ Employee ACTIVE และ active assignment ซ้ำอีกครั้ง,
  สร้าง Assignment อัตโนมัติ แล้วจบคำขอเป็น `COMPLETED`
- หน้า Borrow Request responsive: Employee request form/own history/cancel และ ADMIN/IT_STAFF approval
  queue/approve/reject พร้อม status badges, loading/empty/error states และ dark mode
- Dashboard summary: Pending Borrow Requests, Approved Today, Rejected Today
- Borrow Request Report พร้อม Preview และ export CSV/Excel/PDF โดยคง data scope ตาม role
- Audit actions `BORROW_REQUEST_CREATED`, `BORROW_REQUEST_APPROVED`, `BORROW_REQUEST_REJECTED`,
  `BORROW_REQUEST_CANCELLED` และ entity `BorrowRequest`
- OpenAPI/Swagger schemas และ paths สำหรับ workflow/report ใหม่

### Security & Compatibility
- EMPLOYEE สร้าง/ดู/ยกเลิกได้เฉพาะคำขอของตนเองผ่าน Employee email mapping; ADMIN/IT_STAFF
  ดูทั้งหมดและอนุมัติ/ปฏิเสธได้ แต่สร้างคำขอแทนไม่ได้
- ไม่เปลี่ยน endpoint, relation, RBAC หรือพฤติกรรมเดิมของ Assignment; การมอบหมายโดยตรงยังทำงานเหมือนเดิม
- conditional update ป้องกัน Reject/Cancel ซ้ำ และ partial unique index เดิมของ Assignment ร่วมกับ
  Serializable transaction ป้องกันการอนุมัติครุภัณฑ์ชิ้นเดียวพร้อมกัน

### Testing
- Prisma validate/generate, backend lint/test (20/20), frontend lint/build ผ่าน
- Migration `0011` apply สำเร็จบน PostgreSQL 16 และยืนยันสถานะครบ 11 migrations
- Docker E2E ผ่าน Create/own scope/Cancel/Reject/Approve/automatic Assignment/RBAC 403/Report/Audit;
  ล้างเฉพาะข้อมูลทดสอบด้วย marker หลังตรวจเสร็จ

### Known Limitations
- คำขอ `PENDING` ยังไม่ reserve ครุภัณฑ์ ผู้อนุมัติจึงอาจเห็นหลายคำขอสำหรับชิ้นเดียวกันได้; คำขอแรกที่
  อนุมัติสำเร็จจะสร้าง Assignment ส่วนคำขอถัดไปตอบ 409 และต้องปฏิเสธภายหลัง
- User ↔ Employee ยังเชื่อมด้วย case-insensitive email ตาม Phase 2; บัญชีที่ไม่พบ Employee ACTIVE ส่งคำขอไม่ได้
- `APPROVED` เก็บไว้ใน enum สำหรับ workflow extension แต่ flow ปัจจุบันเปลี่ยนจาก PENDING เป็น COMPLETED
  ภายใน transaction เดียวหลังสร้าง Assignment สำเร็จ

---

## [v1.1.0-alpha.2] — Assignment Employee Integration

เฟส 2 เปลี่ยน business identity ของผู้ถือครองครุภัณฑ์จากบัญชี `User` เป็น `Employee` แบบ incremental
โดยยังคง User authentication/RBAC, `assignedById` และข้อมูล assignment เดิมไว้ครบถ้วน

### Added
- Migration `0010_assignment_employee_integration`: เพิ่ม `Assignment.employeeId` และ Foreign Key ไปยัง
  Employee พร้อม index; backfill เฉพาะคู่ User/Employee ที่มีอีเมลตรงกันแบบไม่กำกวม
- Assignment API ส่ง nested Employee (รหัส/ชื่อ/แผนก/ตำแหน่ง/สถานะ), ค้นหารหัสพนักงาน ชื่อ และแผนก
  พร้อมตัวกรอง `employeeId`
- Employee selector ในฟอร์มมอบหมาย รองรับค้นหารหัส ชื่อ และแผนก แสดงสถานะ และเลือกเฉพาะพนักงาน
  Active ที่ไม่ถูก archive
- Current Holder, Assignment History, Employee dashboard และ Assignment Report แสดงข้อมูล Employee
- Audit ASSIGN/RETURN ระบุ Employee identity และเก็บ `employeeId`/`employeeCode` ใน audit values

### Changed
- Assignment ใหม่บังคับ `employeeId`; `User` ยังคงระบุ operator ผ่าน `assignedById` และ `userId` เดิม
  ยังรับได้แบบ deprecated เพื่อ backward compatibility
- EMPLOYEE data scope ตรวจทั้ง relation Employee ที่ match อีเมลบัญชี และ legacy `userId` เดิม
- Assignment Report เพิ่ม Employee Code, Employee Name, Department และ Position
- Swagger/OpenAPI และ package version อัปเดตเป็น `v1.1.0-alpha.2`

### Backward Compatibility
- `employeeId` เป็น nullable ที่ฐานข้อมูลเพื่อให้ migration ไม่ทำข้อมูลเก่าหาย; assignment เก่าที่ยัง map ไม่ได้
  แสดง User เดิม หรือ `Unknown Employee` แทนโดยไม่ crash
- ไม่ลบ User authentication, RBAC, `Assignment.userId` หรือ endpoint/filter เดิม

### Known Limitations
- การเชื่อม User ↔ Employee ยังใช้ case-insensitive email matching ระหว่างช่วงเปลี่ยนผ่าน ยังไม่มี account link table
- ข้อมูลเก่าที่ไม่มี Employee อีเมลตรงกันจะไม่ถูกเดาและคง `employeeId = null`
- Borrow Request, Approval Workflow, Notifications และ HR Integration ยังไม่รวมใน alpha นี้

---

## [v1.1.0-alpha.1] — Employee Management Foundation

เฟสแรกของ v1.1.0 เพิ่มทะเบียนพนักงานแบบ incremental โดยแยก `Employee` ออกจากบัญชี `User` อย่างชัดเจน
และคง `Assignment.userId` เดิมไว้ทั้งหมด เพื่อให้ระบบเดิม backward-compatible และพร้อมต่อยอด Phase 2

### Added
- Prisma model/enum `Employee`/`EmployeeStatus` พร้อม migration `0009_employee_management`, unique
  `employeeCode`, relation แบบ optional กับ Department และ soft delete (`deletedAt`)
- REST API 6 endpoint: list/detail/create/update/archive/restore พร้อม response envelope, pagination,
  sorting, filter, search (รหัส/ชื่อเต็ม/อีเมล/โทรศัพท์), Zod validation และ duplicate conflict `409`
- RBAC: ADMIN ทำได้ครบทุก action, IT_STAFF อ่าน/สร้าง/แก้ไข, EMPLOYEE ไม่มีสิทธิ์เข้าถึง
- Audit Log entity `Employee` และ action `RESTORE`; บันทึก CREATE/UPDATE/DELETE/RESTORE พร้อม before/after values
- หน้า Employee Management ใช้ Design System เดิม รองรับ search/filter/pagination, status badges,
  Department/Position, Create/Edit/Archive/Restore, loading/empty/error states, responsive และ dark mode
- OpenAPI/Swagger schemas และ paths สำหรับ Employee ทั้งหมด
- Node test suite สำหรับ validation, search/filter, RBAC และ audit policy พร้อมเพิ่ม `npm test` ใน CI

### Testing
- Migration `0009` apply สำเร็จบน PostgreSQL 16 ผ่าน Docker Compose; API container healthy
- Integration CRUD/RBAC ผ่านครบ: EMPLOYEE `403`, IT_STAFF create/update แต่ archive `403`, ADMIN archive/restore
- ยืนยัน unique employee code `409`, search/pagination, active/archive scopes และ Audit Log ครบ 4 action
- Prisma validate/generate, backend test/lint, frontend lint/build และ OpenAPI generation ผ่าน

### Known Limitations
- Employee ยังไม่เชื่อมกับ User และ Assignment ยังอ้าง User ตามเดิมโดยตั้งใจ; การเชื่อมเป็นงาน Phase 2
- ยังไม่มี Borrow Request, Approval Workflow, HR Integration หรือ employee notifications ใน alpha นี้
- Automated integration test กับฐานข้อมูลและ browser E2E ยังไม่รันใน CI; รอบนี้ตรวจ integration ผ่าน Docker แบบ manual

---

## [v1.0.0-rc3] — Release Candidate 3: Production Deployment & Operations

Milestone ด้าน production deployment/operations ล้วน ๆ — ไม่มี business feature ใหม่, ไม่มี API/schema
เปลี่ยนแปลง (ยกเว้น RDS backup retention 1→7 วัน), development compose (`docker-compose.yml`) ไม่ถูกแก้
แม้แต่บรรทัดเดียว มุ่งเน้น infrastructure/deployment/operations/recovery/เอกสารล้วน ๆ

### Added
- `apps/web/nginx.prod.conf` — production nginx reverse proxy config: gzip compression, static asset
  caching (`immutable` 1 ปีสำหรับไฟล์ที่ผ่าน content-hash, `no-cache` สำหรับ `index.html`), security
  headers (`X-Content-Type-Options`/`X-Frame-Options`/`Referrer-Policy`/`X-XSS-Protection`/
  `Strict-Transport-Security`), proxy timeout ยาวขึ้น (`proxy_read_timeout 120s`) รองรับ export รายงานใหญ่
- `docker-compose.prod.yml` — compose file แยกต่างหากสำหรับ self-hosted production: `restart: always`
  ทุก service, `db`/`api` ไม่ publish port ออก host, แยก network เป็น 2 วง (`frontend-net`/`backend-net`),
  ใช้ `nginx.prod.conf` แทน config เดิม
- `.env.production.example` — ต้นแบบตัวแปร environment สำหรับ `docker-compose.prod.yml` (แยกจาก
  `.env.example` ที่ใช้ตอน dev)
- HEALTHCHECK directive ใน `apps/api/Dockerfile` (Node `http` module เช็ก `/health`) และ
  `apps/web/Dockerfile` (`wget` เช็ก `/`) — ไม่ติดตั้ง dependency ใหม่ทั้งคู่ (minimal attack surface)
- OCI image labels (`org.opencontainers.image.title/description/licenses`) ในทั้งสอง Dockerfile
- `docs/DEPLOYMENT.md` — คู่มือ deploy เต็มรูปแบบ ครอบคลุมทั้งสอง path (AWS ECS + self-hosted Docker
  Compose): server requirements, build, startup, migration, health verification, log locations,
  troubleshooting
- `docs/BACKUP_RECOVERY.md` — retention policy, backup (RDS automated + `pg_dump` manual), restore
  procedure, disaster recovery checklist (documentation only — ไม่มี scheduled backup อัตโนมัติในโค้ด)
- `docs/ROLLBACK.md` — application rollback (ECS task definition revision / git tag + rebuild),
  database migration rollback (SQL ย้อนกลับด้วยมือ หรือ restore จาก backup), Docker image rollback,
  health verification หลัง rollback
- `docs/PRODUCTION_CHECKLIST.md` — checklist ก่อน deploy จริง ครอบคลุม Infrastructure/Deployment/
  Security/Monitoring/Recovery/Documentation/Operations/Release process
- `CONTRIBUTING.md`, `CODEOWNERS`, `.github/PULL_REQUEST_TEMPLATE.md`,
  `.github/ISSUE_TEMPLATE/{bug_report,feature_request}.md` — repository hygiene files ที่ยังขาดอยู่
  (ไม่มีไฟล์เดิมถูกทับ — `LICENSE` ที่มีอยู่แล้วไม่ถูกแตะ)

### Changed
- `deploy/02-infra.sh` — RDS `--backup-retention-period` จาก `1` เป็น `7` วัน (บรรทัดเดียว ตอบสนอง finding
  จาก RC1 review)
- `.gitignore` — เพิ่ม `.env.production` เข้ากลุ่ม env/secrets ที่ห้าม commit
- README.md — เพิ่มหัวข้อ "🚀 Production Deployment & Operations (RC3)" (Docker images, deployment paths,
  nginx, environment variables, backup/rollback/checklist พร้อมลิงก์ไปเอกสารเต็ม), อัปเดต Known
  Limitations (TLS termination ไม่มีในตัว, Brotli ยังไม่เปิด, ไม่มี scheduled backup อัตโนมัติสำหรับทาง
  self-hosted), อัปเดต project structure diagram

### Testing
- `docker build` ทั้งสอง image สำเร็จพร้อม HEALTHCHECK/LABEL directive ใหม่ — ยืนยัน non-root execution
  (RC2) ยังคงอยู่ (`docker run --rm <image> whoami` → `node`)
- `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build` — ทุก service
  ขึ้นสถานะ `healthy`, migration รันสำเร็จอัตโนมัติผ่าน entrypoint เดิม
- Nginx routing: `/` เสิร์ฟ SPA (fallback ไป `index.html`), `/api/*` proxy ไปที่ backend ถูกต้อง, gzip
  header (`Content-Encoding: gzip`) ปรากฏบน response ที่เข้าเงื่อนไข, security headers ครบตามที่ตั้งไว้
- `GET /api/health` ตอบ `200 {status:"ok", database:"connected"}` ผ่าน nginx proxy
- Swagger UI (`/api/docs/`) เข้าถึงได้ผ่าน nginx proxy เหมือนตอน dev
- Graceful shutdown (RC2) ยืนยันซ้ำว่ายังทำงานถูกต้องภายใต้ topology ใหม่ (`docker compose stop api` →
  log ครบ 3 ขั้นตอน → exit `0`)
- ยืนยัน `docker-compose.yml` (dev) ไม่มีการเปลี่ยนแปลงใด ๆ (`git diff --stat docker-compose.yml` ว่างเปล่า)
- Security review: ไม่พบ secret ใด ๆ ใน git history หรือ tracked files, `contentSecurityPolicy: false`
  (RC2) ยังคงเปิดให้ Swagger UI ใช้งานได้, error handler ไม่รั่ว stack trace ดิบออกไปหา client, CORS
  fail-closed behavior (RC2) ไม่เปลี่ยน

### Known Limitations
- `docker-compose.prod.yml` ไม่มี TLS termination ในตัว — `Strict-Transport-Security` header จะไม่มีผลจริง
  จนกว่าจะมี HTTPS จริง (ต้องเพิ่มเอง)
- Brotli compression ยังไม่เปิดใช้งาน (`nginx:alpine` ไม่มี `ngx_brotli` module ในตัว) — ใช้ gzip เท่านั้น
- ไม่มี scheduled backup อัตโนมัติสำหรับทาง self-hosted — ต้องตั้ง cron/scheduler เอง (เอกสารมีขั้นตอนให้
  ครบใน `docs/BACKUP_RECOVERY.md`)
- Prisma ไม่มีกลไก "down migration" อัตโนมัติ — rollback migration ที่ทำลายข้อมูลต้อง restore จาก backup
  หรือเขียน SQL ย้อนกลับด้วยมือ (ดู `docs/ROLLBACK.md`)

---

## [v1.0.0-rc2] — Release Candidate 2: Production Hardening

Milestone ด้าน production readiness ล้วน ๆ — ไม่มี business feature ใหม่, ไม่มีการแก้ database schema,
ไม่มี API endpoint ใหม่/redesign เดิม (ยกเว้นค่า response ที่ upgrade ของ `/health`), maintain backward
compatibility กับพฤติกรรมเดิมทุกจุดที่ไม่ได้ตั้งใจเปลี่ยน — ตอบสนอง 11 findings จาก RC1 production readiness
review (Critical/High severity ทั้งหมด)

### Added
- `apps/api/src/middleware/rateLimit.js` — จำกัดจำนวนครั้ง `POST /api/auth/login`/`POST /api/auth/register`
  ต่อ IP (ใช้ [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit)) ปรับได้ผ่าน
  `AUTH_RATE_LIMIT_WINDOW_MS`/`AUTH_RATE_LIMIT_MAX` (default 10 ครั้ง/15 นาที) เกินโควตาตอบ `429` ด้วย
  response envelope เดียวกับ error อื่นทั้งระบบ — ไม่แตะ logic ตรวจสอบ credential/สมัครสมาชิกเดิมเลย
- `apps/api/src/middleware/requestLogger.js` — log แบบ structured (JSON) ทุก request: requestId (`crypto.randomUUID()`),
  method, path, status, durationMs, ip — ไม่ log request body/header ใด ๆ (กัน password/JWT หลุดเข้า log)
  แนบ `X-Request-Id` ไปกับ response header ด้วย
- `apps/api/src/utils/corsOptions.js` — สร้าง CORS options จาก `CORS_ORIGIN` env var แทนการเปิดกว้างทุก
  origin แบบเดิม (`cors()` เฉย ๆ) — ไม่ตั้งค่า + dev = reflect origin (เหมือนเดิม), ไม่ตั้งค่า + production =
  fail closed
- Graceful shutdown ใน `apps/api/src/index.js` — ดัก `SIGTERM`/`SIGINT`: หยุดรับ connection ใหม่
  (`server.close()`) → request ที่ค้างอยู่ทำงานจนจบตามปกติ → `prisma.$disconnect()` → `process.exit()` ด้วย
  status code ที่เหมาะสม พร้อม timer บังคับปิดถ้ารอนานเกินไป (10 วินาที) — log ทุกขั้นตอน
- `/health`, `/api/health` อัปเกรด — เช็ก `SELECT 1` ผ่าน Prisma จริง ตอบ `200 {status:"ok", database:"connected"}`
  เมื่อต่อ DB ได้, ตอบ `503 {status:"error", database:"disconnected"}` เมื่อต่อไม่ได้ (เดิมตอบ `200` เสมอ
  ไม่เช็กอะไรเลย)
- Helmet middleware — security header มาตรฐาน (`X-Content-Type-Options`, `X-Frame-Options`,
  `Strict-Transport-Security` ฯลฯ) ปิดเฉพาะ `contentSecurityPolicy` (จะบล็อก inline script/style ที่
  Swagger UI ต้องใช้) header อื่นทั้งหมดเปิดใช้งานตามปกติ
- Environment variables ใหม่ (ทุกตัวไม่บังคับ มี default ที่ backward-compatible): `NODE_ENV`, `CORS_ORIGIN`,
  `AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX` — เพิ่มใน `.env.example` และ README

### Changed
- `apps/api/src/index.js` — เพิ่ม helmet/cors(ใหม่)/requestLogger middleware, upgrade health handler,
  เปลี่ยน `app.listen()` ให้เก็บ `server` reference สำหรับ graceful shutdown — ลำดับ route/error handler
  เดิมไม่เปลี่ยน
- `apps/api/src/routes/auth.js` — เพิ่ม `authRateLimit` เป็น middleware ตัวแรกของ `POST /register` และ
  `POST /login` (ก่อนถึง validation/business logic เดิมทั้งหมด) และเปลี่ยน `registerSchema.password` จาก
  `min(6)` เป็น `min(8)` (ข้อความ error ปรับเลขให้ตรงกัน) — ไม่แตะ logic ส่วนอื่นเลย
- `apps/api/src/docs/openapi.js` — อัปเดต `RegisterRequest.password.minLength` จาก 6 เป็น 8 ให้ตรงกับ
  validation จริง
- `apps/web/src/pages/Register.jsx` — ป้ายกำกับรหัสผ่านเปลี่ยนจาก "(อย่างน้อย 6 ตัว)" เป็น "(อย่างน้อย 8 ตัว)"
- `apps/web/src/components/{AssetForm,AssignmentForm,MasterDataForm,ReturnAssignmentForm}.jsx` — เพิ่ม
  `htmlFor`/`id` ให้ทุกคู่ label-input ที่ขาดอยู่ (screen reader อ่านชื่อฟิลด์ถูกต้อง, กด label แล้ว focus ที่
  input ได้) — ไม่เปลี่ยน layout/behavior ใด ๆ
- `apps/api/Dockerfile` — `node:20` → `node:24` (ตรงกับ `.nvmrc`/CI), `npm install` → `npm ci` (ต้อง copy
  `package-lock.json` เข้าไปด้วย), เพิ่ม `USER node` ก่อน `CMD` (รันเป็น non-root — ใช้ user `node` ที่มีอยู่
  แล้วในตัว official image ไม่ต้องสร้างเอง)
- `apps/web/Dockerfile` — `node:20-alpine` → `node:24-alpine`, `npm install` → `npm ci` (ต้อง copy
  `package-lock.json` เข้าไปด้วย) เฉพาะ build stage (stage สุดท้ายเป็น nginx ไม่มี npm)
- `deploy/task-def-api.json` — เพิ่ม `NODE_ENV=production` เข้า environment array ของ container API
- `deploy/config.example.sh` — เพิ่มคอมเมนต์อธิบาย `CORS_ORIGIN`/`AUTH_RATE_LIMIT_*` (เป็นตัวอย่างที่ปิดไว้
  ไม่บังคับตั้ง — ค่า default ในโค้ดใช้งานได้โดยไม่ต้องตั้งอะไรเพิ่ม)
- `.env.example`, README.md — เพิ่มเอกสารตัวแปรใหม่ทั้งหมด + หัวข้อ "🛡️ Production Hardening (RC2)" อธิบาย
  rate limiting/graceful shutdown/health endpoint/logging/security headers/CORS/Docker

### Testing
- Backend/frontend lint: 0 error (เหมือนเดิม, ไม่มี regression จากการแก้ accessibility)
- `prisma validate`/`prisma generate`: ผ่าน
- Docker build ทั้งสอง image สำเร็จด้วย `node:24`; ยืนยัน backend container รันเป็น `node` (non-root, UID 1000)
  ด้วย `docker run --rm <image> whoami`/`id`
- Container จริง (ผ่าน docker, ต่อ Postgres จริง): migration รันสำเร็จเป็น non-root user, `/health` ตอบ `200`
  ตอน DB ต่อได้ และ `503` ทันทีที่ DB ถูก stop (ทดสอบจริงด้วยการ stop/start container ฐานข้อมูล)
- Rate limit: ยิง `POST /api/auth/login` รัว ๆ 12 ครั้ง — 10 ครั้งแรกผ่าน (401 ตามที่ credential ผิดจริง) ครั้งที่
  11-12 ได้ `429` พร้อมข้อความที่ตั้งใจไว้
- Password policy: สมัครด้วยรหัสผ่าน 7 ตัวอักษร → `400` พร้อม field error ที่ถูกต้อง, 8 ตัวอักษร → `201` สำเร็จ
- Graceful shutdown: `docker stop` (ส่ง `SIGTERM`) → log ครบทั้ง 4 ขั้นตอนตามลำดับที่ตั้งใจ, exit code `0`
- Request logging: ยืนยัน log JSON มี requestId/method/path/status/durationMs/ip ครบ ไม่มี body/header ปน
- CORS: request ที่มี `Origin` header (ไม่ได้ตั้ง `CORS_ORIGIN`, ไม่ได้ตั้ง `NODE_ENV`) ได้
  `Access-Control-Allow-Origin` reflect กลับมาตามเดิม (backward compatible กับ dev workflow)
- Helmet: header มาตรฐานครบ (`Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`
  ฯลฯ) ยืนยันไม่มี `Content-Security-Policy` header (ปิดไว้ตามตั้งใจ)
- Swagger UI (`/docs`): โหลดหน้าได้ปกติ (HTTP 200, title ถูกต้อง) และ asset ทั้ง 4 ไฟล์
  (`swagger-ui.css`/`swagger-ui-bundle.js`/`swagger-ui-standalone-preset.js`/`swagger-ui-init.js`) โหลด
  สำเร็จทุกไฟล์ (ไม่ถูก Helmet บล็อก)
- Browser regression: login ผ่าน Vite dev server ทำงานปกติ, เปิดฟอร์ม "เพิ่มครุภัณฑ์ใหม่" แล้วทุกช่อง input
  มี accessible name ที่ถูกต้อง (ยืนยันผ่าน accessibility tree, ตรงกับ label ที่ผูกด้วย `htmlFor`/`id` ใหม่)
  ไม่มี error ใน console

### Known Limitations
- Rate limit เก็บ state ในหน่วยความจำต่อ instance ไม่ใช่ distributed store — ถ้า deploy มากกว่า 1 instance
  พร้อมกันในอนาคต โควตาจะไม่ถูกนับรวมข้าม instance (ปัจจุบัน `desired-count` ยังเป็น 1 จึงไม่กระทบจริง)
- ยังไม่มี email verification หรือ account lockout ถาวรหลังพยายามผิดหลายครั้ง — rate limit ชะลอการโจมตีได้
  แต่ไม่ใช่กลไกล็อกบัญชีแบบถาวร
- `/health` เช็กแค่ "ต่อฐานข้อมูลได้ไหม" ไม่ได้เช็กว่า schema ตรงกับ migration ล่าสุด
- `CORS_ORIGIN` ไม่ได้ผูกเข้า ECS task definition โดยตรง (ไม่จำเป็นสำหรับ deployment topology ปัจจุบันที่ ALB
  route แบบ same-origin อยู่แล้ว) — ถ้ามี client ข้าม origin จริงในอนาคตต้องตั้งค่าด้วยตนเอง

---

## [v1.0.0-rc1] — Milestone 10: CI/CD & Release Engineering

Milestone ด้าน engineering quality ล้วน ๆ — ไม่มีการเปลี่ยน business logic, ไม่มีการแก้ database schema,
ไม่มี application feature ใหม่ ทุกอย่างในรอบนี้คือ tooling/CI/documentation

### Added
- `.github/workflows/ci.yml` — GitHub Actions workflow "Continuous Integration" รันทุก `push`/`pull_request`
  เข้า `master` และ `feature/*` — 1 job เดียว รันตามลำดับ: checkout → setup Node.js (Active LTS จาก `.nvmrc`
  + npm cache) → `npm ci` (backend+frontend แยกกัน) → `prisma validate` (ตรวจ schema syntax เท่านั้น ไม่
  migrate/เชื่อมต่อ DB จริง) → lint backend → lint frontend → build backend (`prisma generate`) → build
  frontend (`vite build`) → success summary (เขียนลง `$GITHUB_STEP_SUMMARY`) ล้มเหลว step ไหนหยุดทันที
  (ไม่มี `continue-on-error` ที่ไหนเลย) ใช้ `actions/checkout@v4` และ `actions/setup-node@v4` (official,
  maintained version ปัจจุบัน)
- ESLint สำหรับทั้งสอง app (flat config, ESLint v10):
  - `apps/api/eslint.config.js` — Node/ESM, ใช้ `@eslint/js` recommended + `no-unused-vars` (warn)
  - `apps/web/eslint.config.js` — React, ใช้ `@eslint/js` recommended + เฉพาะ `react-hooks/rules-of-hooks`
    (error) และ `react-hooks/exhaustive-deps` (warn) จาก `eslint-plugin-react-hooks` v7 — ตั้งใจไม่ใช้
    `configs.recommended` ทั้งชุดของเวอร์ชันนี้ เพราะรวม rule ชุด "React Compiler" ใหม่ (เช่น
    `set-state-in-effect`, `immutability`) ที่จะ flag pattern ปกติที่ใช้อยู่ทั่วโปรเจกต์ (เช่น
    `setPage(1)` ใน `useEffect` ตอนรีเซ็ตหน้าเวลาตัวกรองเปลี่ยน) การแก้ตาม rule เหล่านั้นจะกลายเป็นการ
    เปลี่ยน business logic ซึ่งอยู่นอกขอบเขตของ milestone นี้
  - `"lint"` script เพิ่มในทั้งสอง `package.json`
- `apps/api/package.json`: เพิ่ม `"validate": "prisma validate"` และ `"build": "prisma generate"` script
  (backend ไม่มีขั้นตอน compile/bundle เหมือน frontend — "build" ในที่นี้คือการ generate Prisma Client
  ซึ่งเป็น artifact เดียวที่จำเป็นก่อนรันแอปได้จริง)
- `.nvmrc` — pin Node.js เวอร์ชัน 24 (Active LTS ปัจจุบัน) ให้ทั้ง local dev และ CI ใช้ตัวเลขเดียวกัน
- `.editorconfig` — บังคับ indent 2 space, LF line ending, UTF-8, trim trailing whitespace ให้ทุก editor
  ใช้กติกาเดียวกัน (ตรงกับ code style ที่ใช้อยู่แล้วทั้งโปรเจกต์)
- `.gitattributes` — normalize line ending เป็น LF สำหรับไฟล์ text ทั้งหมด (กัน diff แปลกข้าม OS) และ mark
  ไฟล์ binary (`.woff`, รูปภาพ, `.pdf`) ให้ Git ไม่ไป normalize ทับจนไฟล์เสีย
- `.prettierignore` — ระบุ path ที่ไม่ควร format (migration SQL ที่ Prisma generate เอง, lock files,
  `node_modules`, `dist`) เผื่อผู้พัฒนาเปิด Prettier ใน editor ของตัวเอง (โปรเจกต์นี้ยังไม่ได้ตั้ง Prettier
  เป็น dependency บังคับ)

### Changed
- `.gitignore` — เพิ่ม entry ใหม่เท่านั้น ไม่ลบของเดิม: `.vscode/`, `.idea/`, `.eslintcache`, `coverage/`
- `apps/api/src/middleware/auth.js` — เปลี่ยน `catch (err)` เป็น `catch` เฉย ๆ (optional catch binding) —
  `err` ไม่เคยถูกใช้ เป็น dead code ที่ ESLint เจอ ไม่กระทบ behavior ใด ๆ
- `apps/api/src/routes/auth.js` — เอา `auditContext` ที่ import มาแต่ไม่เคยเรียกใช้ออก (register/login ยังคง
  เรียก `logAudit()` เหมือนเดิมทุกประการ แค่ประกอบ context เองตรง ๆ เพราะ `req.user` ยังไม่ถูกตั้งค่าตอนนั้น)
- `apps/api/src/routes/reports.js` — เอา `fail` (import แต่ไม่เคยเรียกใช้ในไฟล์นี้เลย) และ
  `TICKET_CATEGORY_LABELS` (นิยามไว้แต่ไม่เคยถูกอ้างอิงที่ไหน) ที่เป็น dead code ออก — ไม่มี endpoint ไหน
  เปลี่ยนพฤติกรรม
- README.md — เพิ่ม CI badge, ส่วน "🟢 Build Status", "⚙️ CI/CD Pipeline" (อธิบายว่า CI รันตอนไหน/ขั้นตอน
  อะไรบ้าง/เกิดอะไรขึ้นถ้าล้มเหลว/วิธี reproduce ในเครื่องตัวเอง), ขยาย "🌿 Git Workflow" ด้วย Branch
  Strategy / Contribution Workflow / Project Structure, เพิ่ม "🔍 Quality Checks" (คำสั่งเดียวกับที่ CI รัน)

### Testing
- Syntax ของ `.github/workflows/ci.yml` ตรวจผ่าน YAML parser (js-yaml) — โครงสร้าง `on`/`jobs`/`steps` ถูกต้อง
- รันทุก step ของ CI ซ้ำในเครื่องจริง (ไม่ใช่แค่บน GitHub): `npm ci` (backend+frontend), `prisma validate`
  (พร้อม `DATABASE_URL` หลอกตามที่ CI ใช้), `npm run lint` ทั้งสอง app, `npm run build` ทั้งสอง app — ผ่านหมด
- Backend lint: 0 error, 0 warning (แก้ dead code ทั้งหมดที่เจอแล้ว)
- Frontend lint: 0 error, 12 warning (ทั้งหมดเป็น pattern ที่ตั้งใจไว้อยู่แล้ว — `exhaustive-deps` ที่ตั้งใจ
  ไม่ใส่ `load` ใน dependency array ของ 6 หน้าจอ list, และ `react-refresh/only-export-components` ของไฟล์
  form ที่ export ทั้ง component และ option array ร่วมกัน — ไม่แก้เพราะจะกลายเป็นการเปลี่ยน business logic)
- ไม่มี regression: backend/frontend ยังรันได้ปกติ, endpoint และหน้าจอทั้งหมดไม่เปลี่ยนพฤติกรรม

### Not Implemented (ตั้งใจเว้นไว้ ตามขอบเขต Milestone 10)
- Automated test suite / step "Test" ใน CI — โปรเจกต์นี้ยังไม่มี test suite เลย (ดู Roadmap ใน README)
- Deploy step อัตโนมัติจาก CI (เช่น auto-deploy ขึ้น AWS เมื่อ merge เข้า `master`) — ปัจจุบัน deploy ยังเป็น
  ขั้นตอนแยกที่รันมือผ่านสคริปต์ใน `deploy/` (ดูหัวข้อ Deploy ใน README)
- Prettier เป็น dependency บังคับ + step "Format check" ใน CI — มีแค่ `.prettierignore` เผื่อผู้พัฒนาเปิดใช้เอง

---

## [v0.9.0] — Milestone 9: Audit Log

### Added
- โมเดล `AuditLog` (migration `0008_audit_log`) — บันทึกประวัติการทำรายการสำคัญทั้งระบบ: `action`,
  `entityType`, `entityId`, `description`, `oldValues`/`newValues` (JSON), `performedById`, `performedAt`,
  `ipAddress`, `userAgent` พร้อม index บน `(entityType, entityId)`, `performedById`, `performedAt`, `action` —
  ไม่แตะตารางเดิมตารางไหนเลย (ไม่ผูก Prisma relation กับ `User` โดยเจตนา ดูเหตุผลในคอมเมนต์ schema.prisma)
- `utils/auditLog.js` — `logAudit()` (เขียน audit record แบบ fire-and-forget ไม่ block business logic),
  `auditContext(req)` (ดึง performedById/ipAddress/userAgent จาก request), `attachPerformer()` (join กับ
  `User` ด้วยมือครั้งเดียวต่อหน้า ไม่ query ทีละแถว), และค่าคงที่ `AUDIT_ACTIONS`/`AUDIT_ENTITY_TYPES`
- `routes/audit.js` — `GET /api/audit` (แบ่งหน้า + กรอง page/pageSize/action/entityType/performedBy/
  dateFrom/dateTo/search, เรียง `performedAt desc` เสมอ) และ `GET /api/audit/:id` — อ่านอย่างเดียว ไม่มี
  endpoint สร้าง/แก้ไข/ลบ (immutable) เฉพาะ ADMIN/IT_STAFF
- หน้า "Audit Log" ฝั่ง frontend (`AuditLog.jsx`) — ตาราง + ค้นหา + ตัวกรอง + แบ่งหน้า + กล่องรายละเอียด
  (`AuditLogDetail.jsx`) แสดง `oldValues`/`newValues` เป็น JSON viewer อ่านง่าย (`.json-viewer`)
- ขยาย `GET /api/dashboard` (ไม่สร้าง endpoint ใหม่): เพิ่ม `recentAuditLogs` (10 เหตุการณ์ล่าสุดทั้งระบบ,
  array ว่างสำหรับ EMPLOYEE) และการ์ด "Audit Log ล่าสุด" ในหน้าแดชบอร์ด — section ใหม่ ไม่แก้ logic
  `recentActivities`/`recentTickets` เดิม
- Swagger: schema `AuditLog`/`AuditAction`/`AuditEntityType`, tag "Audit Log", และ path docs
  `docs/paths/audit.js` ครอบคลุมทั้ง 2 endpoint

### Changed (เพิ่ม audit call เท่านั้น ไม่แก้ business logic เดิม)
- `routes/auth.js` — log `CREATE` (entityType `User`) ตอนสมัครสมาชิก, log `LOGIN` ตอนเข้าสู่ระบบสำเร็จ
- `routes/assets.js` — log `CREATE`/`UPDATE`/`DELETE` พร้อม `oldValues`/`newValues` เฉพาะฟิลด์ที่เปลี่ยน
- `utils/masterDataRouter.js` — log `CREATE`/`UPDATE`/`DELETE` ผ่าน option ใหม่ `entityType` (ใช้ร่วมกันทั้ง
  Category/Location/Department/Vendor ในจุดเดียว ไม่เขียนซ้ำ 4 รอบ) — `routes/categories.js`/`locations.js`/
  `departments.js`/`vendors.js` เพิ่มแค่ `entityType` เข้าไปใน config ที่ส่งให้ factory
- `routes/assignments.js` — log `ASSIGN` ตอนมอบหมาย, `UPDATE` ตอนแก้ไขรายละเอียด, `RETURN` ตอนรับคืน
- `routes/tickets.js` — log `OPEN` ตอนแจ้งปัญหาใหม่, `START_PROGRESS`/`ON_HOLD`/`UPDATE` ตอน PUT (action
  ตาม target status ของ transition), `RESOLVE` ตอนแก้ไขสำเร็จ, `CLOSE` ตอนปิดงาน
- `routes/reports.js` — log `EXPORT_REPORT` ทุกครั้งที่ export ไฟล์สำเร็จ (`?format=csv|xlsx|pdf`) ผ่าน
  helper กลาง `logReportExport()` ใช้ร่วมกันทั้ง 6 รายงาน
- `apps/api/src/index.js` — mount `app.use('/api/audit', auditRoutes)`
- `apps/api/.env.example`/README — ไม่เปลี่ยนแปลง (audit log ไม่เพิ่ม environment variable ใหม่)

### Business Rules
- Log เฉพาะการกระทำที่สำเร็จจริงเท่านั้น — validation ที่ล้มเหลว (400) หรือสิทธิ์ไม่พอ (403) ไม่ถูกบันทึก
- ทุกการทำรายการสำเร็จหนึ่งครั้งสร้าง audit record ได้เพียงหนึ่งแถวเท่านั้น ไม่มีการ log คำสั่ง GET ใด ๆ
- ADMIN/IT_STAFF เข้าถึง audit log ได้เต็มรูปแบบ, EMPLOYEE เข้าไม่ได้เลย (403 ทั้ง endpoint และ dashboard field)
- `oldValues`/`newValues` ไม่มี password hash หรือ JWT token ปนอยู่เด็ดขาด (ผู้เรียก `logAudit()` เลือกเฉพาะ
  ฟิลด์ที่เปลี่ยนมาเองก่อนส่งเข้ามาเสมอ)

### Fixed
- Bug เดิมจาก Milestone 8.1 (swagger-jsdoc glob ไม่รองรับ backslash Windows path) ไม่กระทบรอบนี้ — path
  docs ใหม่ (`docs/paths/audit.js`) ทำงานถูกต้องตั้งแต่แรกเพราะ glob ที่แก้ไว้แล้วใน `openapi.js`

### Not Implemented (ตั้งใจเว้นไว้ ตามขอบเขต Milestone 9)
- Log `LOGOUT` — ไม่มี server-side logout endpoint ในระบบ (JWT stateless, logout ทำที่ frontend อย่างเดียว)
- Retry queue / dead-letter mechanism สำหรับ audit write ที่ล้มเหลว — ปัจจุบันแค่ log error ไว้ที่ console
- Export/ดาวน์โหลด audit log เป็นไฟล์ (ไม่ได้อยู่ใน scope ของ Reports & Export เดิม)

---

## [v0.8.1] — Milestone 8.1: OpenAPI Documentation

Milestone เอกสารล้วน ๆ — ไม่มีการเปลี่ยน business logic, ไม่มีการแก้ database schema, ไม่มี endpoint ใหม่
เพิ่มขึ้นมาจริง (มีแค่ `/docs` ซึ่งเป็นหน้าเอกสารเอง ไม่ใช่ resource endpoint)

### Added
- `GET /docs` — Swagger UI แบบ interactive (`swagger-ui-express`) ครอบคลุมทั้ง 49 endpoint จริงของระบบ
  จัดกลุ่มตาม tag: Authentication, Users, Assets, Assignments, Dashboard, Master Data, Tickets, Reports, Health
- `apps/api/src/docs/openapi.js` — swagger-jsdoc config หลัก: `info`, `servers`, security scheme
  `bearerAuth` (JWT), และ `components.schemas` ที่ใช้ซ้ำได้ทั้งหมด (`User`, `Asset`, `Assignment`, `Ticket`,
  `MasterDataItem`, `Vendor`, `DashboardResponse`, schema รายงานทั้ง 6 แบบ, `ErrorResponse`,
  `ValidationError`, `Pagination` และ request-body schema ของทุก create/update/resolve/close operation)
- `apps/api/src/docs/paths/*.js` (9 ไฟล์ — 1 ต่อ module) — คอมเมนต์ `@openapi` ล้วน ๆ อธิบายทุก endpoint:
  summary, description, การยืนยันตัวตน/สิทธิ์ (RBAC) ที่ต้องใช้, path/query parameters, request body,
  response ทุก status code (รวม validation error และ permission error), ตัวอย่าง request/response จริงจาก
  ข้อมูล seed (`IT-0001`, `Dell Latitude 5440`, `HD-000001`, `Admin User`)
- หัวข้อ "📘 API Documentation (Swagger)" ใน README — วิธีเปิด `/docs`, วิธี Authorize ด้วย JWT, และ
  โครงสร้างของเอกสาร

### Changed
- `apps/api/src/index.js` — เพิ่ม `import swaggerUi`/`swaggerSpec` และ mount `app.use('/docs', ...)`
  เท่านั้น (ไม่แตะ route/middleware/business logic เดิมแม้แต่บรรทัดเดียว)
- `apps/api/package.json` — เพิ่ม dependency ใหม่: `swagger-jsdoc`, `swagger-ui-express`

### Fixed
- swagger-jsdoc ใช้ `glob` ภายในเพื่อหาไฟล์ตาม `apis` pattern ที่กำหนด ซึ่งไม่รองรับ backslash ของ Windows
  path (`path.join` บน Windows คืนค่าเป็น `C:\...\paths\*.js` ทำให้หาไฟล์ไม่เจอเลยสักไฟล์ — spec ว่างเปล่า
  แต่ไม่ error) แก้โดยแปลงเป็น forward slash เสมอก่อนส่งให้ swagger-jsdoc (`.split(path.sep).join('/')`)

### Design Decisions
- เอกสารทั้งหมดแยกไว้ที่ `apps/api/src/docs/` ไม่ใช่คอมเมนต์แนบในไฟล์ route จริง — เพื่อรับประกันว่า
  route file ที่มีอยู่แล้วทุกไฟล์ไม่ถูกแก้แม้แต่บรรทัดเดียว (สอดคล้องกับข้อกำหนด "ห้ามแก้ business logic"
  อย่างเข้มงวดที่สุด) เอกสารอ้างอิงพฤติกรรมจริงของ route/validation/response ที่มีอยู่แล้วเท่านั้น
- Schema ที่ตอบโครงสร้างเดียวกันซ้ำ ๆ (response envelope, pagination, error) ใช้ `$ref`/`allOf` อ้างอิงกลับ
  schema เดียวกันเสมอ ไม่มีการนิยามซ้ำ (ตามข้อกำหนด "avoid duplicated schema definitions")

### Testing
- `swagger-jsdoc` โหลด spec สำเร็จ: 30 path items / 39 reusable schemas ไม่มี JSDoc parse error
- Backend start สำเร็จ ไม่มี error ตอน boot (`node src/index.js`)
- ตรวจผ่านเบราว์เซอร์: `/docs` โหลดได้, endpoint ทั้ง 9 tag แสดงครบพร้อม description ภาษาไทย, "Try it out"
  ของ `POST /api/auth/login` ส่ง request จริงไปที่ backend ได้ถูกต้อง (พารามิเตอร์/body ตรงกับที่กำหนดไว้ใน
  schema, ตัวอย่างค่าที่ pre-fill มาใช้ข้อมูล seed จริง) และ response ที่ตอบกลับ (รวม error response) render
  ถูกต้องตาม schema ที่ประกาศไว้
- ปุ่ม "Authorize" ใช้งานได้ (ใส่ JWT ครั้งเดียว endpoint ที่ต้องล็อกอินแนบ header ให้อัตโนมัติ)

### Known Limitations
- ไม่มีการ sync อัตโนมัติระหว่างเอกสารกับโค้ดจริง — ถ้า route ถูกแก้ในอนาคต ต้องอัปเดตไฟล์ใน `src/docs/`
  ประกอบด้วยตนเอง
- ทดสอบ "Try It Out" แบบ end-to-end กับฐานข้อมูลจริงไม่สำเร็จในสภาพแวดล้อมทดสอบนี้ (local PostgreSQL
  service ที่ตั้งค่าไว้ใน `.env` เชื่อมต่อไม่ได้ — เป็นปัญหาการตั้งค่าฐานข้อมูลของเครื่องทดสอบ ไม่เกี่ยวกับ
  โค้ด/เอกสารที่เพิ่มเข้ามาใน milestone นี้) ยืนยันแล้วว่า request/response ที่ Swagger UI สร้างและแสดงผล
  ถูกต้องตรงตาม schema ที่ประกาศไว้

---

## [v0.8.0] — Milestone 8: Reports & Export

### Added
- หน้า "รายงาน" — การ์ดเลือกจาก 6 รายงาน (Asset Inventory, Asset Assignment, Warranty, Helpdesk,
  Department Summary, Vendor Summary) แต่ละตัวมี preview เป็นตาราง + ตัวกรอง + ปุ่มส่งออก
- `routes/reports.js` — `GET /api/reports/assets`, `/assignments`, `/warranty`, `/helpdesk`,
  `/departments`, `/vendors` ทุกตัวรองรับ `?format=csv|xlsx|pdf` เพื่อดาวน์โหลดไฟล์แทนการตอบ JSON preview
  (ไม่ส่ง `format` มา = JSON แบ่งหน้าปกติ)
- `utils/reportHelpers.js` — ตัวแปลง query filter ที่ใช้ร่วมกันทั้ง 6 รายงาน, ตัวคำนวณ bucket การรับประกัน
  (หมดแล้ว/ใกล้หมด 30/90 วัน/ปกติ), และตัวสร้างไฟล์ export ทั้ง 3 ฟอร์แมต (CSV เขียนตรงไปที่ response พร้อม
  UTF-8 BOM, Excel ใช้ ExcelJS streaming writer, PDF ใช้ PDFKit วาดตารางเอง)
- ฟอนต์ Sarabun (SIL OFL, ผ่าน Fontsource) บันทึกไว้ที่ `apps/api/assets/fonts/` — ใช้ render ข้อความไทยใน
  PDF export ด้วยการตัดข้อความเป็นช่วงตาม Unicode range แล้วสลับฟอนต์ไทย/ละตินทีละช่วง (ไฟล์ subset ของ
  Sarabun แยกชุดตัวอักษรไทย/ละตินคนละไฟล์ ไม่มีไฟล์เดียวที่ครอบคลุมทั้งคู่)
- Export dependencies ใหม่: `exceljs`, `pdfkit`

### Changed
- `routes/assets.js`, `routes/assignments.js`, `routes/tickets.js`: export `scopeForRead` (และรายชื่อ
  ฟิลด์ค้นหาที่เกี่ยวข้อง) ออกมาให้ `routes/reports.js` เรียกใช้ตรง ๆ — รายงานทุกตัวใช้เงื่อนไข RBAC เดียวกับ
  endpoint หลักเป๊ะ ไม่มีการเขียนเงื่อนไขสิทธิ์ซ้ำที่เสี่ยงพลาดไม่ตรงกัน

### Business Rules
- ADMIN/IT_STAFF เข้าถึงรายงานได้ทุกตัวแบบภาพรวมทั้งองค์กร
- EMPLOYEE เห็น Asset Inventory/Assignment/Warranty/Helpdesk เฉพาะของตัวเอง (ขอบเขตเดียวกับหน้าจอปกติ),
  Department Summary/Vendor Summary เข้าไม่ได้เลย (403 — ภาพรวมองค์กรล้วน ๆ ไม่มีทาง scope ให้เหลือ "ของตัวเอง"
  ได้อย่างมีความหมาย)
- Export ดึงข้อมูล "ทั้งหมด" ที่ตรงกับตัวกรอง+ขอบเขตสิทธิ์เสมอ ไม่ใช่แค่หน้าที่กำลัง preview อยู่ — ไม่ export
  รายการที่ถูกกรอง/ซ่อนออกไปแล้ว

### Not Implemented (ตั้งใจเว้นไว้ ตามขอบเขต Milestone 8)
- QR Code, Audit Log, Notifications, Email — ดู Roadmap ใน README

---

## [v0.7.0] — Milestone 7: Helpdesk & Maintenance

### Added
- โมเดล `Ticket` — ใบแจ้งซ่อม/ปัญหาครุภัณฑ์ หนึ่งแถวต่อหนึ่งปัญหา ห้ามลบ (เหมือนแพทเทิร์น `Assignment`)
  พร้อม enum `TicketPriority` (LOW/MEDIUM/HIGH/CRITICAL), `TicketStatus`
  (OPEN/IN_PROGRESS/ON_HOLD/RESOLVED/CLOSED), `TicketCategory`
  (HARDWARE/SOFTWARE/NETWORK/PRINTER/ACCOUNT/OTHER)
- เลขที่ใบแจ้งซ่อมอัตโนมัติ (`HD-000001`, `HD-000002`, ...) สร้างจาก PostgreSQL sequence — atomic ในตัว
  กันเลขซ้ำแม้มี request สร้างตั๋วพร้อมกันหลายตัว (migration `0007_tickets`)
- `routes/tickets.js` — `GET /api/tickets` (list), `GET /api/tickets/:id`, `POST /api/tickets` (แจ้งใหม่ —
  ทุก role รวม EMPLOYEE), `PUT /api/tickets/:id` (แก้ไข/มอบหมาย — ADMIN/IT_STAFF), `POST /api/tickets/:id/resolve`,
  `POST /api/tickets/:id/close`
- Workflow state machine บังคับจริงที่ backend (`utils/ticketHelpers.js`): `OPEN → IN_PROGRESS → RESOLVED →
  CLOSED` พร้อม `IN_PROGRESS ↔ ON_HOLD` — ปฏิเสธ transition ที่ไม่ถูกต้องด้วย `400` เสมอ
- ผสาน Ticket เข้ากับ Asset — `GET /api/assets` แนบ `openTicketsCount`, `closedTicketsCount`,
  `ticketHistoryCount`, `recentTickets` มาด้วยเสมอ (ไม่ยิง query แยกต่อ asset)
- ขยาย `GET /api/dashboard` (ไม่สร้าง endpointใหม่): เพิ่ม section `tickets` (open/inProgress/resolvedToday/
  closedToday), กราฟ `ticketsByPriority`/`ticketsByStatus`/`topTicketCategories`, และ `recentTickets`
  — ทั้ง org-wide (ADMIN/IT_STAFF) และ scoped เฉพาะตั๋วของตัวเอง (EMPLOYEE)
- หน้า Helpdesk ฝั่ง frontend (`Tickets.jsx`) — ค้นหา/กรอง (ความสำคัญ/สถานะ/หมวดหมู่/ผู้ดูแล/ผู้แจ้ง/ครุภัณฑ์)/
  แบ่งหน้า พร้อมฟอร์มแจ้งปัญหาใหม่ แก้ไข/มอบหมาย แก้ไขสำเร็จ และปิดงาน (`TicketForm`, `ResolveTicketForm`,
  `CloseTicketForm`) — reuse โครงสร้างฟอร์ม/modal เดิมทั้งหมด
- ปุ่ม "ดูใบแจ้งซ่อม" ในหน้าครุภัณฑ์ พาไปแท็บ Helpdesk กรองเฉพาะ asset นั้น (เหมือนแพทเทิร์น "ดูประวัติ" ของ
  Milestone 5) และคอลัมน์เสริม (ซ่อน/แสดงได้) แสดงจำนวนใบแจ้งซ่อมที่เปิดอยู่/ทั้งหมดต่อ asset

### Business Rules
- EMPLOYEE แจ้งปัญหาได้เฉพาะครุภัณฑ์ที่ตัวเองถือครองอยู่ (active assignment) เท่านั้น — กันเห็น/อ้างอิง asset ID
  ของทั้งระบบผ่านฟอร์มแจ้งปัญหา, ดูได้เฉพาะตั๋วที่ตัวเองแจ้ง, มอบหมาย/แก้ไขสำเร็จ/ปิดงานไม่ได้
- `assignedToId` ต้องเป็นผู้ใช้ role ADMIN/IT_STAFF เท่านั้น (ตรวจที่ backend เสมอ) — มอบหมายให้ EMPLOYEE ดูแลไม่ได้
- ตั๋วที่ RESOLVED/CLOSED แล้วแก้ไขรายละเอียดไม่ได้อีก (เหมือนแพทเทิร์น Assignment ที่แก้ไม่ได้หลังคืนแล้ว)
- มอบหมายผู้ดูแลครั้งแรกให้ตั๋วที่ยัง OPEN จะขยับสถานะเป็น IN_PROGRESS ให้อัตโนมัติ

### Seed
- เพิ่มครุภัณฑ์ตัวอย่าง 2 ชิ้น (เครื่องพิมพ์ HP LaserJet, Network Switch) และตั๋วตัวอย่างครบทั้ง 5 สถานะ:
  Dell Latitude จอฟ้า (IN_PROGRESS), เครื่องพิมพ์กระดาษติด (RESOLVED), Network Switch packet loss (CLOSED),
  Lenovo ติดตั้งโปรแกรมไม่ได้ (OPEN), iPhone ล็อกอินอีเมลไม่ได้ (ON_HOLD)

### Not Implemented (ตั้งใจเว้นไว้ ตามขอบเขต Milestone 7)
- แจ้งเตือนอีเมล, QR Code, รายงาน/ส่งออกข้อมูล, Audit Log — ดู Roadmap ใน README

---

## [v0.6.1-rc1] — Release Candidate 1 (ก่อน Milestone 7)

Release Candidate — ไม่ใช่ milestone ฟีเจอร์ใหม่ เป็นรอบตรวจสอบคุณภาพ/ความสม่ำเสมอ/เสถียรภาพก่อนเดินหน้า
Milestone 7 ไม่มีการเปลี่ยน database schema และไม่มีฟีเจอร์ธุรกิจใหม่เพิ่มเข้ามา

### Fixed
- **[Bug — Medium/High]** ลบครุภัณฑ์ (soft delete) ไม่เคยเช็กว่ามีผู้ถือครองอยู่หรือไม่ — เพราะ soft delete
  เป็นแค่ `UPDATE` ไม่ใช่ `DELETE` จริง ทำให้ FK constraint `onDelete: Restrict` ของ `Assignment.assetId`
  ไม่ถูกกระตุ้นเลย ลบ asset ที่มีคนถือครองอยู่ได้โดยไม่มีการเตือน ทิ้ง assignment ที่ active ค้างไว้กับ asset
  ที่มองไม่เห็นแล้ว ตอนนี้ `DELETE /api/assets/:id` เช็กก่อนเสมอ และตอบ `409` พร้อมข้อความแจ้งให้รับคืนก่อน
  ([assets.js](apps/api/src/routes/assets.js))
- ลบ method `.remove()` ที่ตายแล้วออกจาก `api.assignments` ฝั่ง frontend — เดิม spread มาจาก
  `createEntityApi()` ทั้งที่ backend ไม่มี `DELETE /api/assignments/:id` เลย (ตั้งใจไม่มี — ประวัติการมอบหมาย
  ห้ามลบ) เรียกแล้วจะเงียบ ๆ ไปโดน 404 ทั่วไปแทน ([api.js](apps/web/src/api.js))

### Changed
- ลดจำนวน API call ซ้ำซ้อนตอนเปิดฟอร์มเพิ่ม/แก้ไขครุภัณฑ์ — เดิม `AssetForm` เรียก
  `useMasterDataOptions()` เองอีกชุดหนึ่ง ทั้งที่ `Assets.jsx` (ผู้เรียกเดียวที่ render `AssetForm`)
  โหลดข้อมูลเดียวกันไว้แล้วสำหรับแถบตัวกรอง ตอนนี้ส่งต่อ options ที่โหลดแล้วลงมาเป็น props แทน
  ลดจาก 4 request เหลือ 0 request ทุกครั้งที่เปิด modal ([AssetForm.jsx](apps/web/src/components/AssetForm.jsx),
  [Assets.jsx](apps/web/src/pages/Assets.jsx))

### Accessibility
- เพิ่ม `htmlFor`/`id` เชื่อม `<label>` กับ input ในหน้า Login และ Register ให้ตรงกับแพทเทิร์นที่
  AssetFilterBar/Assignments ใช้อยู่แล้ว (screen reader อ่านชื่อฟิลด์ถูกต้อง, กด label แล้ว focus ที่ input ได้)
  ([Login.jsx](apps/web/src/pages/Login.jsx), [Register.jsx](apps/web/src/pages/Register.jsx))

### Reviewed — ไม่พบปัญหา / ยืนยันว่าถูกต้องแล้ว
- โครงสร้าง RBAC ทั้งหมด (middleware, master data router, assets/assignments/dashboard scoping) — ไม่พบ
  privilege escalation path, ทุก endpoint ที่ควรถูกจำกัด role ถูกจำกัดจริงที่ backend
- การแก้บั๊ก Zod `.optional()` chain ordering จาก milestone ก่อนหน้า (ทำให้ partial update เคลียร์ field
  ที่ไม่ได้ส่งมาโดยไม่ตั้งใจ) — ยังคงถูกต้องในทุก helper ของ [zodHelpers.js](apps/api/src/utils/zodHelpers.js)
- Master data ที่ถูกลบยังผูกกับ asset เก่าและแสดงชื่อได้ถูกต้อง — ยืนยันว่าเป็นพฤติกรรมที่ตั้งใจออกแบบไว้
  ไม่ใช่บั๊ก (ตรวจสอบด้วยการทดสอบจริง: ลบ category ที่มี asset อ้างอิงอยู่ แล้วดูว่า asset ยังแสดงชื่อ category
  ถูกต้อง)
- Partial unique index `Assignment_active_per_asset_key` ตรงกับเงื่อนไข `ACTIVE_ASSIGNMENT_WHERE` ที่ใช้ทั่ว
  โค้ด ทำให้ query หา "ผู้ถือครองปัจจุบัน" ใช้ index ได้อย่างมีประสิทธิภาพแม้ไม่ได้ filter ด้วย `assetId`

### ไม่ทำ (Deferred — อยู่นอกขอบเขต RC นี้)
- Index เพิ่มเติมบน `Asset.warrantyExpiry` (ใช้กับ dashboard warranty query 3 ตัว) — จะช่วย performance
  จริง แต่ต้องแก้ schema ซึ่งไม่ผ่านเงื่อนไข "ไม่ critical พอที่จะแก้ schema" ของรอบนี้ ดู Roadmap ใน README
- Retrofit `htmlFor`/`id` ให้ฟอร์มขนาดใหญ่ (AssetForm, MasterDataForm, AssignmentForm,
  ReturnAssignmentForm) — เสี่ยง diff ใหญ่เกินความจำเป็นของ RC นี้ ทำเฉพาะฟอร์มเล็ก (Login/Register) ที่
  ความเสี่ยงต่ำ

---

## [v0.6.0] — Milestone 6: Dashboard & Analytics

### Added
- `GET /api/dashboard` — endpoint รวมสถิติทั้งหมดในคำสั่งเดียว (การ์ดสรุป/กราฟ/กิจกรรมล่าสุด) คำนวณที่
  backend ทั้งหมดด้วย Prisma `groupBy`/aggregate, ยิง query แบบขนานผ่าน `Promise.all` (ไม่มี N+1)
- แยก path การคำนวณ 2 แบบตาม role: ADMIN/IT_STAFF เห็นภาพรวมทั้งองค์กร, EMPLOYEE เห็นเฉพาะของตัวเอง
  (บังคับที่ backend เสมอ)
- หน้า Dashboard ฝั่ง frontend — การ์ดสรุป, กราฟแบบ bar ด้วย CSS ล้วน (ไม่ใช้ chart library), รายการ
  กิจกรรมล่าสุด — ตั้งเป็นแท็บ landing page หลังล็อกอิน

---

## [v0.5.0] — Milestone 5: Asset Assignment & Lifecycle

### Added
- โมเดล `Assignment` — ประวัติการมอบหมาย/รับคืนครุภัณฑ์ หนึ่งแถวต่อหนึ่งรอบการถือครอง ห้ามแก้ไข/ลบ
  ประวัติเก่าเมื่อคืนแล้ว
- Partial unique index บังคับว่า asset หนึ่งชิ้นมีการมอบหมายที่ active พร้อมกันได้สูงสุด 1 แถว
- `routes/assignments.js` — มอบหมาย/แก้ไขรายละเอียด (จำกัดฟิลด์)/รับคืน พร้อมประวัติแบบเต็ม
- หน้า Assignments ฝั่ง frontend + ปุ่ม "ดูประวัติ" จากหน้า Assets เชื่อมไปแท็บนี้แบบกรองอัตโนมัติ

### Changed
- **BREAKING (เชิงตรรกะ, ไม่ใช่ schema)**: "ผู้ถือครองปัจจุบัน" ของ asset เปลี่ยนจากอิง `Asset.ownerId`
  (ผู้สร้าง) มาเป็นคำนวณจาก `Assignment` ล่าสุดที่ `returnedAt IS NULL` แทน — `ownerId` เก็บไว้เพื่อ
  backward compatibility ทางประวัติศาสตร์เท่านั้น ไม่ใช้ตัดสินสิทธิ์การมองเห็นอีกต่อไป (ระบุ `@deprecated`
  ใน schema comment)
- `users.js`: เปิดให้ `IT_STAFF` ดูรายชื่อผู้ใช้ได้ด้วย (เดิม ADMIN เท่านั้น) เพราะฟอร์มมอบหมายต้องเลือก
  พนักงานจากรายชื่อนี้

---

## [v0.4.1] — Milestone 4.1: Asset Explorer & UX Improvements

### Added
- ตัวกรองฝั่ง server สำหรับรายการครุภัณฑ์ (category/location/department/vendor/status)
- Hook `useMasterDataOptions()` แยกออกมาใช้ร่วมกันระหว่างฟอร์มและแถบตัวกรอง
- ตัวเลือกคอลัมน์ที่จะแสดง/ซ่อนในตาราง — จำค่าไว้ใน localStorage ข้ามการรีเฟรช
- Sticky table header, responsive filter bar

---

## [v0.4.0] — Milestone 4: Role Based Access Control

### Added
- Enum `UserRole` (`ADMIN` / `IT_STAFF` / `EMPLOYEE`), middleware `requireRole(...roles)`
- JWT ฝัง role ไว้ในตัว ตรวจสอบทุก request ที่ผ่าน `requireAuth`
- Endpoint สร้าง/แก้/ลบครุภัณฑ์และ master data จำกัดเฉพาะ ADMIN/IT_STAFF, EMPLOYEE เห็นได้อย่างเดียว
- `registerSchema` ไม่รับ `role` จาก client โดยเจตนา — กันการยกระดับสิทธิ์ตัวเองตอนสมัคร

### Fixed
- พบและแก้บั๊ก Zod `.optional()` chain ordering — ถ้า `.optional()` ไม่ได้อยู่ท้ายสุดของ chain, field ที่
  ไม่ได้ส่งมาใน partial update จะโดน `.transform()`/`.refine()` รันทับเป็น `null` โดยไม่ตั้งใจ

---

## [v0.3.0] — Milestone 3: Asset Details & Technical Specifications

### Added
- ฟิลด์รายละเอียดครุภัณฑ์ครบชุด: การจัดซื้อ (ราคา/ผู้ขาย/ใบแจ้งหนี้/ประกัน), ฮาร์ดแวร์ (CPU/RAM/Storage/
  Graphics), เครือข่าย (IP/MAC/Hostname/OS), lifecycle dates
- Zod validator เพิ่มเติม: IPv4, MAC address, currency code, non-negative number
- Badge แจ้งเตือนวันหมดประกัน (หมดแล้ว / ใกล้หมดภายใน 30 วัน)

---

## [v0.2.0] — Initial Commit: Webapp Starter Baseline

### Added
- โครงสร้างเริ่มต้น: React + Vite (frontend), Express + Prisma + PostgreSQL (backend)
- Authentication (สมัคร/เข้าสู่ระบบ) ด้วย JWT + bcrypt
- Soft delete pattern, master data (Category/Location/Department/Vendor) แบบ CRUD เต็มรูปแบบ
- Docker Compose สำหรับรันทั้งระบบบนเครื่องตัวเอง + สคริปต์ deploy ขึ้น AWS ECS Fargate

---

> โปรเจกต์นี้ยังไม่มี git remote — ดูรายละเอียด commit/tag แต่ละเวอร์ชันด้วย `git log --oneline --decorate`

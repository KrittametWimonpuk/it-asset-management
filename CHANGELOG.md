# Changelog

ทุกการเปลี่ยนแปลงที่มีนัยสำคัญของโปรเจกต์นี้บันทึกไว้ในไฟล์นี้ เรียงจากใหม่ไปเก่า
รูปแบบอ้างอิงจาก [Keep a Changelog](https://keepachangelog.com/) แบบคร่าว ๆ

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

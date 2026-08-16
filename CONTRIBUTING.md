# Contributing

ขอบคุณที่สนใจร่วมพัฒนา Enterprise IT Asset Management System — เอกสารนี้สรุปขั้นตอนพื้นฐานสำหรับ
การส่ง contribution เข้ามาในโปรเจกต์

## เริ่มต้น (Development Setup)

ดูขั้นตอนเต็มที่ [README.md](README.md#-การติดตั้งและเริ่มใช้งาน-development) — สรุปสั้น ๆ:

```bash
git clone <repo-url>
cd webapp-starter
docker compose up -d   # PostgreSQL + backend + frontend สำหรับ dev
```

Node.js เวอร์ชันที่ใช้ระบุไว้ใน [.nvmrc](.nvmrc) — ถ้าใช้ `nvm` รัน `nvm use` ก่อนเริ่มงาน

## Workflow

1. Fork หรือสร้าง branch ใหม่จาก `master` ตั้งชื่อสื่อความหมาย (เช่น `fix/asset-filter-bug`,
   `feature/xyz`)
2. เขียนโค้ด — ทำตาม convention ที่มีอยู่แล้วในไฟล์ข้าง ๆ (ไม่ต้อง refactor สิ่งที่ไม่เกี่ยวกับงานที่ทำ)
3. รัน lint ก่อน commit เสมอ:
   ```bash
   cd apps/api && npm run lint
   cd apps/web && npm run lint
   ```
4. ทดสอบด้วยมือผ่าน UI จริง (โปรเจกต์นี้ยังไม่มี automated test suite — ดู
   [README: Known Limitations](README.md#️-known-limitations))
5. Commit message สั้น กระชับ อธิบาย "ทำไม" มากกว่า "ทำอะไร" (โค้ด diff บอกอยู่แล้วว่าทำอะไร)
6. เปิด Pull Request ไปที่ `master` — กรอกตาม
   [Pull Request template](.github/PULL_REQUEST_TEMPLATE.md) ที่ปรากฏอัตโนมัติ

## Pull Request ต้องผ่านอะไรบ้าง

- GitHub Actions CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) ต้องเขียว — lint +
  build ทั้ง backend และ frontend + validate Prisma schema
- Reviewer อย่างน้อย 1 คน approve ก่อน merge (ดู [CODEOWNERS](CODEOWNERS))
- ไม่มี secret/credential ใด ๆ หลุดเข้ามาใน diff (ตรวจตัวเองก่อนเปิด PR)

## ขอบเขตของโปรเจกต์ในช่วง Release Candidate

โปรเจกต์อยู่ในสถานะ **feature complete** มุ่งสู่ v1.0.0 — PR ที่เพิ่ม business feature ใหม่, เปลี่ยน
API ที่มีอยู่, หรือแก้ database schema โดยไม่จำเป็นจะไม่ถูกรับในช่วงนี้ ยินดีรับ:
- แก้ bug
- ปรับปรุงเอกสาร
- แก้ปัญหา security/production readiness
- ปรับปรุง test coverage, CI, tooling

## รายงานปัญหา

เปิด [Issue](.github/ISSUE_TEMPLATE/) — เลือกแบบฟอร์มที่ตรงกับสิ่งที่พบ (bug report หรือ feature
request)

## จรรยาบรรณ

ให้เกียรติกัน สื่อสารตรงไปตรงมา เปิดใจรับ feedback — ไม่มี Code of Conduct แยกต่างหากในตอนนี้
ยึดตามมาตรฐานความสุภาพทั่วไปของ open source community

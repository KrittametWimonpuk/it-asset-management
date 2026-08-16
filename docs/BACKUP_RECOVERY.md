# Backup & Recovery

> RC3 — Production Deployment & Operations. เอกสารนี้เป็น **documentation only** — ไม่มีการติดตั้ง
> scheduled backup อัตโนมัติใด ๆ ในโค้ด ผู้ดูแลระบบ (operator) ต้องตั้ง cron/scheduler เองตามขั้นตอน
> ด้านล่าง หรือพึ่งพา automated backup ของ RDS (ทาง A) ตามที่อธิบายไว้

## สารบัญ

- [Retention Policy](#retention-policy)
- [ทาง A: AWS RDS — Backup](#ทาง-a-aws-rds--backup)
- [ทาง B: Docker Compose — Backup](#ทาง-b-docker-compose--backup)
- [Restore Procedure](#restore-procedure)
- [Disaster Recovery Checklist](#disaster-recovery-checklist)

---

## Retention Policy

| ทาง | เก็บนานเท่าไร | กลไก |
|-----|---------------|------|
| **A (RDS)** | 7 วัน (automated snapshot, ปรับใน RC3 จาก 1 วันเดิม — ดู `deploy/02-infra.sh`) | AWS จัดการให้อัตโนมัติทุกวัน |
| **B (Docker Compose)** | แนะนำ 7-14 วัน สำหรับ daily backup + เก็บ 1 ชุดต่อเดือนไว้ 6-12 เดือน (monthly archive) | **ต้องตั้งเอง** — ไม่มีอะไรรันอัตโนมัติในโปรเจกต์นี้ |

เหตุผลที่ไม่ทำ scheduled backup ให้อัตโนมัติในทาง B: แต่ละ host/VPS มีเครื่องมือ scheduling
(`cron`, `systemd timer`, managed backup service ของผู้ให้บริการ) ต่างกัน การ hardcode
ไว้ในโปรเจกต์เสี่ยงต่อการ assume ผิดเรื่อง environment — ผู้ดูแลระบบควรเลือกกลไกที่เหมาะกับ
infrastructure ของตัวเอง โดยใช้คำสั่งด้านล่างเป็นฐาน

---

## ทาง A: AWS RDS — Backup

RDS ทำ automated backup ให้อัตโนมัติอยู่แล้ว (ไม่ต้องทำอะไรเพิ่ม) ตาม
`--backup-retention-period 7` ที่ตั้งไว้ใน `deploy/02-infra.sh` — RDS จะ snapshot ให้ทุกวันในช่วง
maintenance window และเก็บย้อนหลัง 7 วัน (รวมถึงรองรับ point-in-time recovery ภายในช่วงนั้นด้วย)

ตรวจสอบว่ามี backup ล่าสุดจริง:
```bash
aws rds describe-db-snapshots \
  --db-instance-identifier <app-name>-db \
  --query 'DBSnapshots[].{ID:DBSnapshotIdentifier,Created:SnapshotCreateTime,Status:Status}' \
  --output table
```

สร้าง manual snapshot เพิ่มเติมก่อนทำการเปลี่ยนแปลงเสี่ยง ๆ (เช่น ก่อน apply migration ใหญ่):
```bash
aws rds create-db-snapshot \
  --db-instance-identifier <app-name>-db \
  --db-snapshot-identifier <app-name>-db-manual-$(date +%Y%m%d-%H%M%S)
```

---

## ทาง B: Docker Compose — Backup

### Backup ด้วยมือ (รันตอนนี้เลย)
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db \
  pg_dump -U "$DB_USER" "$DB_NAME" | gzip > backup-$(date +%Y%m%d-%H%M%S).sql.gz
```
ไฟล์ผลลัพธ์เป็น plain SQL dump บีบอัดด้วย gzip — restore ได้ด้วย `psql` ตรง ๆ (ดูหัวข้อถัดไป)
ควรเก็บไฟล์นี้ไว้ **นอกเครื่อง** เสมอ (เช่น อัปโหลดขึ้น S3/object storage อื่น) ไม่ใช่แค่บนดิสก์เดียวกับ
ตัว container — ถ้าดิสก์เสียจะสูญเสียทั้งข้อมูลจริงและ backup พร้อมกัน

### ตั้งเป็น scheduled job เอง (แนะนำ)
ตัวอย่าง cron entry รันทุกวันตี 2 (ผู้ดูแลระบบเพิ่มเองผ่าน `crontab -e` บนเครื่อง host):
```cron
0 2 * * * cd /path/to/webapp-starter && docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db pg_dump -U postgres appdb | gzip > /path/to/backups/backup-$(date +\%Y\%m\%d).sql.gz
```
ลบไฟล์ backup ที่เก่ากว่า retention policy (ตัวอย่าง 14 วัน):
```bash
find /path/to/backups -name 'backup-*.sql.gz' -mtime +14 -delete
```

### ตรวจสอบ backup ล่าสุดยังใช้งานได้จริง
อย่าเชื่อว่า backup ใช้ได้แค่เพราะไฟล์มีขนาด > 0 — ทดสอบ restore ขึ้น database ชั่วคราวเป็นระยะ
(เช่น เดือนละครั้ง) ตามขั้นตอนใน [Restore Procedure](#restore-procedure) ข้างล่าง แต่ restore ใส่
database แยกต่างหาก ไม่ใช่ทับของจริง

---

## Restore Procedure

> ⚠️ ขั้นตอนนี้ทับข้อมูลปัจจุบันทั้งหมด — ยืนยันว่าเป็น backup ไฟล์ที่ถูกต้องก่อนรันจริงเสมอ และถ้าเป็นไปได้
> ให้ backup ข้อมูล**ปัจจุบัน**ไว้ก่อนด้วย (เผื่อ restore ผิดไฟล์)

### ทาง A: AWS RDS
RDS restore จาก snapshot จะได้ **DB instance ใหม่** (endpoint ใหม่) ไม่ใช่ restore ทับตัวเดิม:
```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier <app-name>-db-restored \
  --db-snapshot-identifier <snapshot-id>
```
จากนั้นต้อง:
1. รอ `aws rds wait db-instance-available --db-instance-identifier <app-name>-db-restored`
2. อัปเดต `DATABASE_URL` ใน task definition (`deploy/task-def-api.json`) ให้ชี้ไปที่ endpoint ใหม่
3. รัน `deploy/03-deploy.sh` เพื่ออัปเดต ECS service ให้ใช้ค่าใหม่
4. ยืนยันแอปทำงานถูกต้องแล้วค่อยพิจารณาลบ DB instance เก่า (อย่าลบทันที — เก็บไว้เป็น fallback สักพัก)

### ทาง B: Docker Compose
```bash
# 1) หยุด backend ก่อนกัน connection ใหม่เข้ามาระหว่าง restore
docker compose -f docker-compose.prod.yml --env-file .env.production stop api

# 2) restore ทับ database ปัจจุบัน (ตัวอย่างจากไฟล์ backup ที่ gzip ไว้)
gunzip -c backup-20260810-020000.sql.gz | \
  docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db \
  psql -U "$DB_USER" "$DB_NAME"

# 3) รัน pending migration ให้ตรงกับโค้ดเวอร์ชันปัจจุบัน (เผื่อ backup เก่ากว่า schema ปัจจุบัน)
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm api \
  npx prisma migrate deploy

# 4) เริ่ม backend ใหม่
docker compose -f docker-compose.prod.yml --env-file .env.production start api
```
ยืนยันผลลัพธ์ตามขั้นตอนใน [docs/DEPLOYMENT.md — Health Verification](DEPLOYMENT.md#health-verification)

---

## Disaster Recovery Checklist

ใช้เมื่อฐานข้อมูล/เซิร์ฟเวอร์เสียหายทั้งหมด (ไม่ใช่แค่ต้อง restore ข้อมูลปกติ):

- [ ] ยืนยันขอบเขตความเสียหายจริง — ฐานข้อมูลเสีย, เซิร์ฟเวอร์เสีย, หรือทั้งคู่
- [ ] แจ้งผู้ใช้/ทีมที่เกี่ยวข้องว่าระบบกำลัง down (ก่อนเริ่มแก้ เพื่อจัดการ expectation)
- [ ] หา backup ล่าสุดที่ใช้งานได้จริง (ตรวจ timestamp — ยอมรับข้อมูลสูญหายได้กี่ชั่วโมงตาม RPO ที่ยอมรับได้)
- [ ] ถ้าเซิร์ฟเวอร์/instance เสียหายทั้งหมด: เตรียมเครื่องใหม่ตาม
      [docs/DEPLOYMENT.md — Server Requirements](DEPLOYMENT.md#server-requirements)
- [ ] Deploy โค้ดเวอร์ชันล่าสุดที่ผ่านการทดสอบ (ไม่ใช่โค้ดที่อาจเป็นสาเหตุของปัญหา — ถ้าสงสัยโค้ด
      ให้ดู [docs/ROLLBACK.md](ROLLBACK.md) ก่อน)
- [ ] Restore ฐานข้อมูลตามขั้นตอนด้านบน
- [ ] รัน [Health Verification](DEPLOYMENT.md#health-verification) ครบทุกข้อ
- [ ] ตรวจสอบข้อมูลสำคัญแบบสุ่ม (login ทดสอบ, เช็ค asset/assignment ล่าสุดที่ควรมีอยู่)
- [ ] บันทึก timeline ของเหตุการณ์ (เกิดตอนไหน, พบตอนไหน, แก้เสร็จตอนไหน) ไว้ทำ post-mortem
- [ ] ทบทวนสาเหตุ — backup ใช้ได้จริงไหม, retention พอไหม, ตรวจพบช้าไปหรือเปล่า — ปรับ policy ถ้าจำเป็น

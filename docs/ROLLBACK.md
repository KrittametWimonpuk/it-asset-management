# Rollback Strategy

> RC3 — Production Deployment & Operations. ใช้เอกสารนี้เมื่อ deploy เวอร์ชันใหม่แล้วพบปัญหา
> และต้องการย้อนกลับไปเวอร์ชันก่อนหน้าอย่างรวดเร็วและปลอดภัย

## สารบัญ

- [หลักการทั่วไป](#หลักการทั่วไป)
- [Application Rollback](#application-rollback)
- [Database Migration Rollback](#database-migration-rollback)
- [Docker Image Rollback](#docker-image-rollback)
- [Health Verification หลัง Rollback](#health-verification-หลัง-rollback)

---

## หลักการทั่วไป

1. **Rollback โค้ด/image ก่อนเสมอ** ถ้าปัญหาไม่เกี่ยวกับ schema ฐานข้อมูล — เร็วที่สุดและเสี่ยงน้อยที่สุด
2. **แตะฐานข้อมูลเป็นทางเลือกสุดท้าย** — Prisma ไม่มีกลไก "down migration" อัตโนมัติในตัว การย้อน schema
   ต้องเขียน SQL เองหรือ restore จาก backup (ดู [docs/BACKUP_RECOVERY.md](BACKUP_RECOVERY.md)) ทั้งสองทาง
   มีความเสี่ยงสูงกว่าการ rollback โค้ดมาก
3. **Backup ก่อน rollback ทุกครั้ง** ถึงแม้จะแค่ rollback โค้ดอย่างเดียว — เผื่อกรณีที่ไม่คาดคิด
4. **ยืนยัน health หลัง rollback ทุกครั้ง** ตามหัวข้อสุดท้ายของเอกสารนี้ — rollback ที่ "ดูเหมือนสำเร็จ"
   แต่ไม่ผ่าน health check ไม่ถือว่าเสร็จ

---

## Application Rollback

### ทาง A: AWS ECS
ECS เก็บ task definition ทุกเวอร์ชันไว้ให้อัตโนมัติ (revision history) — rollback คือสั่งให้ service
ใช้ revision เก่ากลับไป ไม่ต้อง build ใหม่:
```bash
# ดู revision ก่อนหน้าที่ใช้ได้
aws ecs list-task-definitions --family-prefix <app-name>-api --sort DESC

# สั่ง service กลับไปใช้ revision เก่า (ตัวอย่าง revision 12)
aws ecs update-service \
  --cluster <app-name>-cluster \
  --service <app-name>-api-service \
  --task-definition <app-name>-api:12
```
ทำแบบเดียวกันสำหรับ `<app-name>-web-service` ถ้า frontend ก็มีปัญหาเช่นกัน — ECS จะ rolling-update
container ทีละตัวโดยรอ health check ผ่านก่อนดึงตัวเก่าออก (zero-downtime โดยธรรมชาติ)

### ทาง B: Docker Compose
```bash
# 1) กลับไปที่ commit/tag เวอร์ชันก่อนหน้าที่ต้องการ
git checkout v1.0.0-rc2   # หรือ tag/commit ที่ต้องการ rollback กลับไป

# 2) build image จากโค้ดเวอร์ชันนั้น แล้วสั่งรันใหม่
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# 3) กลับมาที่ branch ทำงานปกติหลัง rollback เสร็จ (โค้ดใน git ไม่ได้หายไปไหน)
git checkout <branch-เดิม>
```
ถ้าเคยเก็บ image tag เก่าไว้ (เช่น push ขึ้น registry ส่วนตัวด้วย tag ระบุเวอร์ชัน) ใช้
`docker compose ... up -d --no-build` แทนได้ทันทีโดยไม่ต้อง build ใหม่ — เร็วกว่ามาก แนะนำให้ทำเป็น
practice ระยะยาว (tag image ทุกครั้งที่ deploy จริง)

---

## Database Migration Rollback

ก่อนอื่น ถามคำถามนี้: **migration ล่าสุดทำอะไรกับ schema?** เพราะวิธี rollback ต่างกันตามความเสี่ยง:

| ประเภทการเปลี่ยนแปลง | วิธี rollback ที่ปลอดภัย |
|----------------------|--------------------------|
| เพิ่มคอลัมน์ใหม่ (nullable หรือมี default) | rollback โค้ดอย่างเดียวพอ — คอลัมน์ใหม่เฉย ๆ ไม่กระทบโค้ดเก่า |
| เพิ่มตารางใหม่ | rollback โค้ดอย่างเดียวพอ — ตารางที่ไม่มีใครอ้างอิงไม่กระทบอะไร |
| ลบ/เปลี่ยนชื่อคอลัมน์หรือตาราง | **เสี่ยงสูง** — โค้ดเก่าจะพังทันทีถ้าคอลัมน์หายไปแล้ว ต้อง restore จาก backup ที่ทำ**ก่อน** migrate เท่านั้น |
| เปลี่ยน type ของคอลัมน์ที่มีข้อมูลอยู่แล้ว | **เสี่ยงสูง** — เขียน SQL ย้อนกลับด้วยมือ หรือ restore จาก backup |

### วิธีที่ 1: เขียน SQL ย้อนกลับด้วยมือ (สำหรับ migration ง่าย ๆ)
ดู SQL ที่ migration ล่าสุดรันจริงได้ที่ `apps/api/prisma/migrations/<timestamp>_<name>/migration.sql`
เขียน SQL ตรงข้ามแล้วรันผ่าน:
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db \
  psql -U "$DB_USER" "$DB_NAME" -c "ALTER TABLE ... "
```
จากนั้น**ต้องลบ record ของ migration นั้นออกจากตาราง `_prisma_migrations`** ด้วย ไม่งั้น Prisma จะคิดว่า
migration ยัง apply อยู่และไม่ยอมรันซ้ำตอน deploy รอบถัดไป:
```sql
DELETE FROM "_prisma_migrations" WHERE migration_name = '<timestamp>_<name>';
```

### วิธีที่ 2: Restore จาก backup (สำหรับ migration ที่ทำลายข้อมูลจริง — ปลอดภัยกว่า)
ทำตามขั้นตอนเต็มใน [docs/BACKUP_RECOVERY.md — Restore Procedure](BACKUP_RECOVERY.md#restore-procedure)
โดยเลือก backup ที่ทำไว้**ก่อน**รัน migration ที่มีปัญหา — วิธีนี้ยอมรับการเสียข้อมูลที่เกิดขึ้นระหว่าง
ตอน migrate จนถึงตอน restore แลกกับความชัวร์ว่า schema กลับมาถูกต้อง 100%

---

## Docker Image Rollback

ถ้า image เวอร์ชันใหม่มีปัญหาที่ไม่เกี่ยวกับโค้ดแอป (เช่น base image เปลี่ยนพฤติกรรม, dependency
เวอร์ชันใหม่พัง) แต่โค้ดแอปเองไม่ได้เปลี่ยน — rollback แค่ image ได้โดยไม่ต้อง revert โค้ด:

```bash
# ทาง B: ถ้ามี image tag เก่าอยู่ในเครื่อง (docker images ตรวจดูได้)
docker tag <app-name>-api:previous <app-name>-api:latest
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --no-build
```

```bash
# ทาง A: ECR เก็บทุก image ที่เคย push ไว้ให้อัตโนมัติ — ดู tag ที่มี
aws ecr describe-images --repository-name <app-name>-api \
  --query 'imageDetails[].imageTags' --output table
# แล้วอัปเดต task definition ให้ชี้ image tag เก่า จากนั้นรัน deploy/03-deploy.sh
```

---

## Health Verification หลัง Rollback

**บังคับทำทุกครั้ง** หลัง rollback เสร็จ — rollback ที่ยังไม่ผ่านขั้นตอนนี้ถือว่ายังไม่เสร็จ ทำตาม
checklist เดียวกับหลัง deploy ปกติทุกประการ (ดู
[docs/DEPLOYMENT.md — Health Verification](DEPLOYMENT.md#health-verification)):

1. Container/Service ขึ้น "healthy"
2. `GET /api/health` ตอบ `200` พร้อม `database: "connected"`
3. Swagger UI (`/api/docs/`) เข้าถึงได้
4. Frontend โหลดได้ + login ทดสอบผ่าน
5. ตรวจ log ว่าไม่มี error ที่เคยพบก่อน rollback หลงเหลืออยู่
6. ถ้า rollback เกี่ยวข้องกับฐานข้อมูล: สุ่มตรวจข้อมูลสำคัญ (asset/assignment ล่าสุด) ว่าตรงกับที่คาดไว้

บันทึกไว้เสมอว่า rollback ครั้งนี้เกิดจากอะไร แก้ยังไง — ใช้เป็นข้อมูลตอนแก้ปัญหาถาวรและ deploy
เวอร์ชันถัดไปใหม่อีกครั้ง

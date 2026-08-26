# Production Readiness Checklist

> v1.1.0 Stable — Production Deployment & Operations. ใช้ checklist นี้ก่อนปล่อยจริงขึ้น production
> ครั้งแรก และก่อน deploy เวอร์ชันสำคัญทุกครั้งถัดไป — ทำเครื่องหมายทีละข้อ ไม่ข้าม

## Infrastructure

- [ ] เลือก deployment path แล้ว (AWS ECS หรือ self-hosted Docker Compose — ดู
      [docs/DEPLOYMENT.md](DEPLOYMENT.md#deployment-paths-ที่รองรับ))
- [ ] เซิร์ฟเวอร์/instance ตรงตาม [Server Requirements](DEPLOYMENT.md#server-requirements) ขั้นต่ำ
- [ ] Docker Engine + Compose v2 ติดตั้งแล้ว (ทาง B) หรือ AWS CLI v2 configure แล้ว (ทาง A)
- [ ] DNS ชี้มาที่เซิร์ฟเวอร์/ALB ถูกต้องแล้ว (ถ้ามีโดเมนจริง)
- [ ] TLS/HTTPS ใช้ certificate ที่ valid: ACM ARN สำหรับ AWS หรือ TLS paths สำหรับ self-hosted

## Deployment

- [ ] Build image ล่าสุดจาก branch/tag ที่ต้องการจริง (ไม่ใช่ branch ทดลอง)
- [ ] `.env.production` (ทาง B) หรือ `deploy/config.sh` (ทาง A) ตั้งค่าครบทุกตัว ไม่มีค่า `CHANGE-ME` หลงเหลือ
- [ ] `JWT_SECRET` เป็นค่าสุ่มยาวจริง (`openssl rand -hex 32`) ไม่ใช่ค่าตัวอย่าง
- [ ] `DB_PASSWORD`/RDS master password เป็นรหัสผ่านที่แข็งแรงจริง
- [ ] Migration ทั้งหมด apply สำเร็จ (`prisma migrate deploy` ผ่านไม่มี error)
- [ ] Container/Service ทุกตัวขึ้นสถานะ "healthy" (ไม่ใช่แค่ "running")
- [ ] cron/EventBridge เรียก `npm run scheduler` เป็นระยะและตรวจ log แล้ว

## Security

- [ ] ไม่มี secret ใด ๆ ถูก commit ขึ้น git (`.env`, `.env.production`, `deploy/config.sh` อยู่ใน
      `.gitignore` แล้ว — ตรวจด้วย `git log --all --full-history -- .env.production` ว่าไม่เคยมีอยู่)
- [ ] `NODE_ENV=production` ตั้งไว้จริงในระบบจริง (ไม่ใช่ค่า default/ว่าง)
- [ ] `CORS_ORIGIN` ตั้งค่าเหมาะสม หรือปล่อยว่างถ้าใช้ topology same-origin ผ่าน nginx ตามปกติ — **ห้าม**
      ปล่อยให้ CORS เปิดกว้างแบบ wildcard ใน production
- [ ] Security headers (Helmet + nginx) ทำงานจริง — เช็คด้วย `curl -I https://<host>` ว่ามี
      `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` เป็นต้น
- [ ] Rate limiting บน login/register ทำงานจริง (ทดสอบยิงเกิน limit แล้วได้ `429`)
- [ ] Password policy (ขั้นต่ำ 8 ตัวอักษร) บังคับใช้จริงตอนสมัคร/เปลี่ยนรหัสผ่าน
- [ ] Backend container รันด้วย non-root user (`USER node` ใน Dockerfile — ตรวจด้วย `docker exec ... whoami`)
- [ ] db/api ไม่ publish port ออก host โดยไม่จำเป็น (ทาง B — เปิดเฉพาะ `web:80/443`)
- [ ] Swagger UI (`/docs`) เข้าถึงได้ตามที่ตั้งใจ (ถ้าต้องการปิดใน production จริง ต้องตัดสินใจและ
      บันทึกเป็น known trade-off — ปัจจุบันเปิดไว้โดยตั้งใจเพื่อความสะดวกของทีม)
- [ ] ไม่มี debug flag/verbose error stack trace รั่วไหลออกไปหา client จริง

## Monitoring

- [ ] `GET /api/health` เข้าถึงได้จากภายนอกและตอบ `200` พร้อม `database: "connected"`
- [ ] Log ของ backend อ่านได้จริง (CloudWatch ทาง A / `docker compose logs` ทาง B) — ดู
      [Log Locations](DEPLOYMENT.md#log-locations)
- [ ] Request logging (RC2) ทำงานจริง — เห็น `requestId`/method/path/status/duration ต่อ request ใน log
- [ ] มีคนหรือกระบวนการที่ตรวจ health endpoint เป็นระยะ (แม้จะเป็น manual check เบื้องต้นก็ตาม)

## Recovery

- [ ] ทดสอบ backup อย่างน้อย 1 ครั้งแล้วว่ารันได้จริง (ดู
      [docs/BACKUP_RECOVERY.md](BACKUP_RECOVERY.md))
- [ ] ทดสอบ restore อย่างน้อย 1 ครั้ง (ขึ้น database ทดสอบแยก ไม่ใช่ทับของจริง) แล้วยืนยันข้อมูลถูกต้อง
- [ ] Retention policy ตั้งไว้ตามที่ต้องการ (RDS 7 วัน default, self-hosted ต้องตั้ง cron เอง)
- [ ] ทีมรู้ขั้นตอน [Rollback](ROLLBACK.md) และเคย dry-run อย่างน้อย 1 ครั้งในสภาพแวดล้อมที่ไม่ใช่ production จริง

## Documentation

- [ ] README.md มีลิงก์ไปทุกเอกสาร production (deployment/backup/rollback/checklist)
- [ ] CHANGELOG.md มี entry ของเวอร์ชันที่กำลังจะปล่อยจริง
- [ ] ตัวแปร environment ทุกตัวมีคำอธิบายใน `.env.example`/`.env.production.example`
- [ ] Known Limitations (เช่น certificate renewal, ไม่มี Brotli) บันทึกไว้ชัดเจน ไม่ปิดบัง

## Operations

- [ ] คนที่ deploy รู้วิธี restart service แต่ละตัวโดยไม่กระทบ service อื่นที่ไม่เกี่ยวข้อง
- [ ] คนที่ deploy รู้ว่า log อยู่ที่ไหน และรู้วิธีดู error ล่าสุดได้ภายใน 1 นาที
- [ ] มีช่องทางแจ้งเตือนทีม/ผู้ใช้เมื่อระบบ down (แม้จะเป็น manual เช่น แชทกลุ่ม ก็ยังดีกว่าไม่มี)
- [ ] Graceful shutdown ทำงานจริง (ทดสอบ `docker compose stop api` แล้วดู log ว่า `SIGTERM` ถูกจัดการ
      ก่อน process ตาย ไม่ตัด connection ที่ค้างอยู่ทันที)

## Release Process

- [ ] ทุก milestone/RC ผ่าน CI (`.github/workflows/ci.yml`) เขียว ก่อน merge เข้า `master`
- [ ] Git tag ตรงกับเวอร์ชันที่ deploy จริง (`git describe --tags`)
- [ ] CHANGELOG entry ตรงกับสิ่งที่เปลี่ยนจริงใน diff ของ tag นั้น
- [ ] มีแผน rollback ที่รู้ล่วงหน้าก่อน deploy ทุกครั้ง (ไม่ใช่คิดตอนมีปัญหาแล้วเท่านั้น)
- [ ] Deploy นอกเวลาเร่งด่วน/นอกช่วงที่ผู้ใช้งานหนาแน่น ถ้าเป็นไปได้

---

**หมายเหตุ**: checklist นี้ไม่ใช่ gate อัตโนมัติ (ไม่มีสคริปต์บังคับ) — เป็นเอกสารอ้างอิงให้คนที่ deploy
ไล่เช็คด้วยตัวเองเพื่อลดความเสี่ยงของการลืมขั้นตอนสำคัญ

# Deployment Guide

> v1.1.0 Stable — Production Deployment & Operations. เอกสารนี้ครอบคลุมการ deploy ระบบขึ้น production จริง
> ทั้งสองเส้นทางที่โปรเจกต์นี้รองรับ ดูภาพรวมสถาปัตยกรรมที่ [README.md](../README.md) ก่อนอ่านต่อ

## สารบัญ

- [Deployment Paths ที่รองรับ](#deployment-paths-ที่รองรับ)
- [Cloudflare Pages + Render](#cloudflare-pages--render)
- [Server Requirements](#server-requirements)
- [Build](#build)
- [Startup](#startup)
- [Database Migration](#database-migration)
- [Rollback](#rollback)
- [Health Verification](#health-verification)
- [Log Locations](#log-locations)
- [Common Troubleshooting](#common-troubleshooting)

---

## Deployment Paths ที่รองรับ

โปรเจกต์นี้รองรับ deployment ต่อไปนี้ เลือกตามความเหมาะสม:

| ทาง | ใช้เมื่อไร | เครื่องมือ |
|-----|-----------|-----------|
| **A. AWS ECS Fargate** | ต้องการ managed infrastructure, auto-scaling, ALB, RDS แบบ managed | `deploy/*.sh` (มีอยู่ตั้งแต่ก่อน RC3) |
| **B. Self-hosted Docker Compose** | มีเซิร์ฟเวอร์/VPS ของตัวเองอยู่แล้ว ต้องการควบคุมเต็มรูปแบบ ต้นทุนคงที่ | `docker-compose.prod.yml` (เพิ่มใน RC3) |
| **C. Cloudflare Pages + Render** | Static frontend บน CDN และ managed Node API | Cloudflare/Render Dashboard + `apps/web/.env.cloudflare` |

ทาง A/B รัน image เดียวกัน (`apps/api/Dockerfile`, `apps/web/Dockerfile`) ส่วนทาง C build frontend
เป็น static assets และรัน backend เป็น Render Web Service

---

## Cloudflare Pages + Render

### Cloudflare Pages

- Root directory: `apps/web`
- Build command: `npm run build`
- Build output directory: `dist`
- Production branch: `master`
- Environment variable: `VITE_API_URL=https://it-asset-management-api.onrender.com`

Build script ใช้ Vite mode `cloudflare` และโหลด `apps/web/.env.cloudflare` เป็นค่า default สาธารณะ
Dashboard env สามารถ override ได้ ทุกครั้งที่เปลี่ยนค่าให้สั่ง Redeploy เพราะ Vite ฝังค่านี้ลง bundle
ระหว่าง build ตรวจ bundle หลัง deploy แล้วต้องพบ Render hostname และต้องไม่ใช้ relative `/api` URL

### Render

- Root directory: `apps/api`
- Build command: `npm ci && npm run generate`
- Pre-deploy command: `npm run migrate`
- Start command: `npm start`
- Health check path: `/api/health`

Environment variables:

```dotenv
NODE_ENV=production
DATABASE_URL=<Render PostgreSQL connection string>
JWT_SECRET=<long random secret>
CORS_ORIGIN=https://it-asset-management.pages.dev
CORS_ALLOW_PAGES_PREVIEWS=true # optional; set false to disable Pages previews
TRUST_PROXY=1
SEED_DEMO_DATA=true
DEMO_ACCOUNT_PASSWORD=<strong secret, Render Secret>
```

Render inject `PORT` ให้ Web Service อยู่แล้ว; Express อ่าน `process.env.PORT` ก่อน fallback ไป 4000
เมื่อ `CORS_ORIGIN` เป็นโดเมน `pages.dev` ระบบจะอนุญาตเฉพาะ HTTPS preview subdomain ของ project
เดียวกันโดยอัตโนมัติ หากไม่ต้องการ Preview ให้ตั้ง `CORS_ALLOW_PAGES_PREVIEWS=false` โดย production
origin หลักยังทำงานตามปกติ

`SEED_DEMO_DATA=true` ใช้สำหรับ Portfolio/Demo deployment เท่านั้น โดย entrypoint จะรัน seed แบบ
idempotent หลัง migration และก่อนเปิด API ต้องกำหนด `DEMO_ACCOUNT_PASSWORD` เป็น secret ที่คาดเดายาก
และห้ามใส่ไว้ใน Git; production seed จะหยุดทันทีหากไม่มี secret นี้ สำหรับระบบที่ใช้ข้อมูลจริงให้ละตัวแปร
`SEED_DEMO_DATA` ไว้หรือตั้งเป็น `false`

### CORS verification

```bash
curl -i -X OPTIONS https://it-asset-management-api.onrender.com/api/auth/login \
  -H "Origin: https://it-asset-management.pages.dev" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization"
```

ผลที่ถูกต้องคือ `204`, `Access-Control-Allow-Origin` ตรงกับ Origin ที่ส่งมา และ
`Access-Control-Allow-Credentials: true` โดยไม่มี wildcard

---

## Server Requirements

### ทาง A: AWS ECS Fargate
ไม่ต้องมีเซิร์ฟเวอร์ของตัวเอง — ต้องมีแค่:
- [AWS CLI](https://aws.amazon.com/cli/) v2 ติดตั้งและ `aws configure` แล้ว (สิทธิ์ ECS/ECR/RDS/ELB/IAM)
- [Docker](https://www.docker.com/) สำหรับ build image ก่อน push ขึ้น ECR
- `envsubst` (มาพร้อม `gettext` package — มักติดตั้งอยู่แล้วบน macOS/Linux)

### ทาง B: Self-hosted Docker Compose
| ทรัพยากร | ขั้นต่ำ | แนะนำ |
|----------|---------|-------|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB | 40 GB+ (ขึ้นกับขนาดข้อมูล + จำนวน backup ที่เก็บ) |
| OS | Linux ที่รัน Docker Engine ได้ (Ubuntu 22.04+ แนะนำ) | เดียวกัน |
| Docker | Docker Engine 24+ พร้อม Docker Compose v2 (`docker compose`, ไม่ใช่ `docker-compose` แยก) | เดียวกัน |
| Network | เปิด port 80 (redirect) และ 443 (HTTPS) | เดียวกัน |

---

## Build

### ทาง A: AWS ECS
```bash
cd deploy
cp config.example.sh config.sh   # ครั้งแรกเท่านั้น แล้วแก้ค่าใน config.sh
./01-build-push.sh                # build ทั้งสอง image แล้ว push ขึ้น ECR
```

ตั้ง `CERTIFICATE_ARN` เป็น ACM certificate ที่ valid ใน region เดียวกับ ALB สคริปต์จะสร้าง HTTPS listener
และ redirect HTTP → HTTPS; `DATABASE_URL`/`JWT_SECRET` ถูกเก็บใน Secrets Manager ไม่อยู่ plaintext ใน task definition

### ทาง B: Docker Compose
```bash
cp .env.production.example .env.production   # ครั้งแรกเท่านั้น แล้วแก้ค่าทุกตัวที่มี CHANGE-ME
docker compose -f docker-compose.prod.yml --env-file .env.production build
```
กำหนด `TLS_CERT_PATH` และ `TLS_KEY_PATH` ให้ชี้ fullchain/private key ที่อ่านได้จาก Docker daemon
Image ทั้งสองตัวถูก build จาก Dockerfile เดียวกับที่ CI ใช้ตรวจสอบ (`npm ci`, non-root, healthcheck)
ดูรายละเอียดที่หัวข้อ "🐳 Production Docker Images" ใน README

---

## Startup

### ทาง A: AWS ECS
```bash
cd deploy
./02-infra.sh    # สร้าง VPC/RDS/ALB/ECS Cluster (รันครั้งแรกครั้งเดียว ใช้เวลา ~10-15 นาที เพราะรอ RDS)
./03-deploy.sh   # สร้าง/อัปเดต ECS service — รันซ้ำได้ทุกครั้งที่ deploy เวอร์ชันใหม่
```
หรือรันรวดเดียวครั้งแรก: `./deploy-all.sh`

### ทาง B: Docker Compose
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```
`-d` = รันเบื้องหลัง (detached) — `docker-entrypoint.sh` ของ `api` service รัน `prisma migrate deploy`
ให้อัตโนมัติก่อน server จะเริ่มฟัง request จริง (เหมือนพฤติกรรมเดิมของ `docker-compose.yml` ตอน dev ทุกประการ)

เปิดเบราว์เซอร์ไปที่ `https://<server-host>`; port 80 มีไว้ redirect ไป HTTPS เท่านั้น

---

## Database Migration

ทั้งสองทางใช้กลไกเดียวกัน: `prisma migrate deploy` (คำสั่งสำหรับ production โดยเฉพาะ — ต่างจาก
`migrate dev` ตรงที่ไม่ถามคำถามแบบ interactive และไม่สร้าง migration ใหม่ แค่ apply ที่มีอยู่แล้ว)

- **ทาง A**: `docker-entrypoint.sh` รัน migration อัตโนมัติทุกครั้งที่ container `api` เริ่มทำงานใหม่
  (ทุก deploy/restart)
- **ทาง B**: เหมือนกันทุกประการ — `docker-entrypoint.sh` ตัวเดียวกัน

**ก่อน deploy migration ใหม่ทุกครั้งในระบบจริง**: สำรองข้อมูลก่อนเสมอ (ดู
[docs/BACKUP_RECOVERY.md](BACKUP_RECOVERY.md)) เพราะ Prisma ไม่มีกลไก "down migration" ในตัว — ถ้า
migration มีปัญหา ทางแก้เดียวคือ restore จาก backup หรือเขียน SQL ย้อนกลับด้วยมือ (ดู
[docs/ROLLBACK.md](ROLLBACK.md))

รัน migration แยกต่างหากโดยไม่ต้องรีสตาร์ท container (เช่น ตรวจสอบก่อน apply จริง):
```bash
# ทาง B (docker compose)
docker compose -f docker-compose.prod.yml --env-file .env.production exec api npx prisma migrate status
```

---

## Rollback

ดูรายละเอียดเต็มที่ [docs/ROLLBACK.md](ROLLBACK.md) — สรุปสั้น ๆ:
- **ทาง A**: `aws ecs update-service --task-definition <previous-task-def-arn>`
- **ทาง B**: `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --no-build`
  หลัง checkout โค้ด/image เวอร์ชันก่อนหน้า (หรือ `docker tag`/`docker pull` image tag เก่าที่เก็บไว้)

---

## Health Verification

หลัง deploy ทุกครั้ง ตรวจสอบตามลำดับนี้:

1. **Container/Service สถานะ**
   ```bash
   # ทาง B
   docker compose -f docker-compose.prod.yml ps
   # ทุก service ควรขึ้น "healthy" (ไม่ใช่แค่ "running") — ดู HEALTHCHECK ที่ตั้งไว้ใน Dockerfile ทั้งสอง
   ```
   ```bash
   # ทาง A
   aws ecs describe-services --cluster <cluster> --services <service-name>
   ```

2. **Health endpoint**
   ```bash
   curl -s https://<host>/api/health
   # ต้องได้ {"status":"ok","time":"...","database":"connected"}
   # ถ้าได้ status:"error"/database:"disconnected" แปลว่า backend ต่อฐานข้อมูลไม่ได้ — เช็ก DATABASE_URL
   ```

3. **Swagger UI ยังเข้าถึงได้** (ยืนยันว่า backend serve request จริงได้ ไม่ใช่แค่ health endpoint เฉย ๆ)
   ```bash
   curl -s -o /dev/null -w "%{http_code}" https://<host>/docs
   # ควรได้ 200
   ```

4. **Frontend โหลดได้ + route ทำงาน** — เปิดเบราว์เซอร์ที่ `https://<host>` ล็อกอินทดสอบ 1 ครั้ง

5. **ตรวจ log ว่าไม่มี error ผิดปกติ** — ดูหัวข้อ [Log Locations](#log-locations) ด้านล่าง

---

## Scheduler

Reminder และ audit outbox retry ใช้ one-shot command เดียว ซึ่งต้องให้ platform เรียกเป็นระยะ (แนะนำทุก 5 นาที):

```bash
# Self-hosted cron/systemd timer
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T api npm run scheduler
```

บน AWS ให้ใช้ EventBridge Scheduler เรียก ECS task จาก API task definition โดย override command เป็น
`["npm","run","scheduler"]` คำสั่ง idempotent และปลอดภัยเมื่อ trigger ซ้ำหรือทำงานเหลื่อมกัน

---

## Log Locations

| ทาง | อยู่ที่ไหน | คำสั่งดู |
|-----|-----------|---------|
| **A (ECS)** | CloudWatch Logs, log group `/ecs/<app-name>-api` และ `/ecs/<app-name>-web` (ตั้งไว้ใน `deploy/task-def-*.json`) | `aws logs tail /ecs/<app-name>-api --follow` |
| **B (Compose)** | Docker container logs (stdout/stderr — ไม่มีไฟล์ log แยกในตัว container เอง เพราะ backend log ออก stdout ล้วน ตาม 12-factor app) | `docker compose -f docker-compose.prod.yml logs -f api` (หรือ `web`/`db`) |

Backend log เป็น structured JSON (RC2: request logging) หนึ่งบรรทัดต่อหนึ่ง request — grep หา
`requestId` เฉพาะที่ผู้ใช้แจ้งปัญหามาได้ทันที (ดู `X-Request-Id` response header)

---

## Common Troubleshooting

| อาการ | สาเหตุที่เป็นไปได้ | วิธีแก้ |
|-------|---------------------|---------|
| `/api/health` ตอบ `503` | ต่อฐานข้อมูลไม่ได้ | เช็ก `DATABASE_URL` ถูกต้องไหม, `db` service/RDS instance รันอยู่ไหม, security group/network เปิดพอร์ต 5432 ระหว่าง api↔db ไหม |
| `docker compose up` ค้างที่ api ไม่ยอม healthy | migration กำลังรัน (ปกติ, รอสักครู่) หรือ migration พัง | `docker compose logs api` ดู error จาก `prisma migrate deploy` ตรง ๆ |
| หน้าเว็บขึ้น 502/504 | backend (api) ยังไม่พร้อม หรือ crash | เช็ก `docker compose ps` ว่า api ยัง "healthy" ไหม, ดู log ของ api |
| Login ไม่ผ่านทั้งที่ credential ถูก | `JWT_SECRET` เปลี่ยนไปจากตอนที่ token เดิมถูกออก (เช่น restart แล้วสุ่มค่าใหม่โดยไม่ตั้งใจ) | ตรวจว่า `.env.production`/`config.sh` มี `JWT_SECRET` ค่าเดิมคงที่เสมอ ไม่สุ่มใหม่ทุกครั้งที่ deploy |
| CORS error ใน browser console | `NODE_ENV=production` แต่ frontend เรียก API จากคนละ origin โดยไม่ได้ตั้ง `CORS_ORIGIN` | ตั้ง `CORS_ORIGIN` ให้ตรงกับ origin จริงของหน้าเว็บ (ปกติไม่เกิดกับ topology มาตรฐานของโปรเจกต์นี้ที่ web/api อยู่ origin เดียวกันผ่าน nginx — ดู README: CORS) |
| Rate limit (`429`) ตอนทดสอบ login ซ้ำ ๆ | ตั้งใจ (RC2 — ป้องกัน brute-force) | รอตามเวลาที่ `AUTH_RATE_LIMIT_WINDOW_MS` กำหนด (default 15 นาที) หรือปรับค่าถ้าจำเป็นสำหรับ QA |
| Export PDF/Excel timeout | รายงานใหญ่หรือ format ใช้ CPU สูง แม้ RC2 จำกัด query ไว้ 25,000 แถว | ใช้ตัวกรองลดจำนวนแถวก่อน export หรือปรับ `proxy_read_timeout` ใน `nginx.prod.conf` |
| ไม่มี due reminder/audit retry | ยังไม่ได้ตั้ง cron/EventBridge ให้เรียก scheduler | เรียก `npm run scheduler` และตรวจ log/ตาราง `AuditOutbox` |
| `npm ci` fail ตอน build image | `package-lock.json` ไม่ตรงกับ `package.json` (ลืม commit lockfile หลังแก้ dependency) | รัน `npm install` ในเครื่อง dev เพื่ออัปเดต lockfile แล้ว commit ทั้งคู่ |

ดูเพิ่มเติม: [docs/BACKUP_RECOVERY.md](BACKUP_RECOVERY.md), [docs/ROLLBACK.md](ROLLBACK.md),
[docs/PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)

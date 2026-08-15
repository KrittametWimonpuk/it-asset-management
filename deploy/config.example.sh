# ---------------------------------------------------------------------------
# ตั้งค่าการ deploy — คัดลอกไฟล์นี้เป็น config.sh แล้วแก้ค่าตามต้องการ
#   cp deploy/config.example.sh deploy/config.sh
#
# (config.sh ถูกใส่ไว้ใน .gitignore แล้ว จะไม่ถูก push ขึ้น git)
# ---------------------------------------------------------------------------

# ภูมิภาค AWS ที่จะ deploy (ap-southeast-7 = กรุงเทพฯ)
export AWS_REGION="ap-southeast-7"

# ชื่อโปรเจกต์ — ใช้ตั้งชื่อ resource ต่าง ๆ (ห้ามเว้นวรรค ใช้ตัวเล็ก-ขีดกลาง)
export APP_NAME="webapp-starter"

# tag ของ image (ปกติใช้ latest หรือจะใส่เลข version ก็ได้)
export IMAGE_TAG="latest"

# ---- ฐานข้อมูล ----
# ถ้าเว้นว่างไว้ สคริปต์ 02-infra.sh จะสร้าง RDS PostgreSQL ให้อัตโนมัติ
# ถ้ามี Postgres อยู่แล้ว (เช่น Neon / Supabase / RDS เดิม) ให้ใส่ทั้งสายที่นี่
#   ตัวอย่าง: export DATABASE_URL="postgresql://user:pass@host:5432/db"
export DATABASE_URL=""

# ค่าที่ใช้ตอนสร้าง RDS ใหม่ (ใช้เมื่อ DATABASE_URL ว่างเท่านั้น)
export DB_NAME="appdb"
export DB_USER="postgres"
export DB_PASSWORD="CHANGE-ME-Strong-Passw0rd"   # <-- แก้ให้เดายาก

# ---- ความลับของแอป ----
# สร้างค่าสุ่มยาว ๆ ด้วย:  openssl rand -hex 32
export JWT_SECRET="CHANGE-ME-to-a-long-random-secret"

# ---- ขนาดเครื่อง (Fargate) ----
# 256 = 0.25 vCPU, 512 = 0.5 GB RAM  (ค่าต่ำสุด ประหยัดสุด)
export TASK_CPU="256"
export TASK_MEMORY="512"

# ---- Production Hardening (RC2) ----
# NODE_ENV ของ container API ถูกตั้งเป็น "production" ไว้ตรงใน task-def-api.json แล้วเสมอ (ไม่ต้อง
# ตั้งที่นี่) — ผลคือถ้าไม่ได้ตั้ง CORS_ORIGIN ไว้ API จะปิดรับ cross-origin request ทั้งหมด (fail closed)
# ในทางปฏิบัติไม่กระทบอะไร เพราะ ALB route ทั้ง / และ /api/* อยู่ใต้ origin เดียวกันอยู่แล้ว (ดู
# 02-infra.sh) จึงไม่ถือเป็น cross-origin request ตั้งแต่ต้น — ตั้งค่านี้เฉพาะถ้ามี client อื่นที่ต้อง
# เรียก API ข้าม origin จริง ๆ (เช่น mobile app, frontend ที่ deploy แยกที่อื่น)
#   ตัวอย่าง: export CORS_ORIGIN="https://asset.example.com,https://admin.example.com"

# ตัวจำกัดจำนวนครั้ง login/register ต่อ IP — ไม่ต้องตั้งก็ได้ (ค่าเริ่มต้นในโค้ดคือ 10 ครั้ง/15 นาที)
#   export AUTH_RATE_LIMIT_WINDOW_MS="900000"
#   export AUTH_RATE_LIMIT_MAX="10"

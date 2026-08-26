#!/bin/sh
# ---------------------------------------------------------------------------
# สคริปต์ที่รันตอน container เริ่มทำงาน
#   1) อัปเดตตารางฐานข้อมูลให้ตรงกับ schema ล่าสุด (migrate deploy)
#   2) สตาร์ท API server
# ---------------------------------------------------------------------------
set -e

echo "==> กำลังอัปเดตฐานข้อมูล (prisma migrate deploy)..."
npx prisma migrate deploy

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  echo "==> กำลังเตรียมข้อมูลตัวอย่างแบบ idempotent..."
  npm run seed
fi

echo "==> เริ่มต้น API server"
exec node src/index.js

# ---------------------------------------------------------------------------
# Dockerfile ของ Frontend — สร้างแบบ 2 ขั้น (multi-stage) เพื่อให้ image เล็ก
#
#   ขั้นที่ 1 (build) : ใช้ node build โค้ด React ให้เป็นไฟล์ static
#   ขั้นที่ 2 (serve) : เอาเฉพาะไฟล์ static ไปเสิร์ฟด้วย nginx
# ---------------------------------------------------------------------------

# ---- ขั้นที่ 1: build ----
# เลข 24 ต้องตรงกับ .nvmrc และ .github/workflows/ci.yml เสมอ (RC2 — Node Version Consistency)
FROM node:24-alpine AS build
WORKDIR /app
# npm ci แทน npm install — ติดตั้งตรงกับ package-lock.json เป๊ะ ๆ เหมือนที่ CI ใช้ทดสอบ (RC2 — Docker Build)
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build          # ได้ผลลัพธ์อยู่ในโฟลเดอร์ dist/

# ---- ขั้นที่ 2: serve ----
FROM nginx:alpine

# ---- RC3: Image labels (OCI standard) — metadata สำหรับ registry/scanner ไม่กระทบการทำงานของ image ----
LABEL org.opencontainers.image.title="it-asset-management-web" \
      org.opencontainers.image.description="Frontend — React (build แล้ว) เสิร์ฟด้วย nginx" \
      org.opencontainers.image.licenses="MIT"

# คัดลอกไฟล์ static ที่ build เสร็จ ไปไว้ในโฟลเดอร์ที่ nginx เสิร์ฟ
COPY --from=build /app/dist /usr/share/nginx/html
# ใช้ config ของเราเอง (เป็น template เพื่อแทนค่าตัวแปร API_UPSTREAM ตอนสตาร์ท) — docker-compose.prod.yml
# mount นี้ทับด้วย nginx.prod.conf แทนตอน production (ดู docs/DEPLOYMENT.md)
COPY nginx.conf /etc/nginx/templates/default.conf.template

# ---- RC3: Healthcheck — ใช้ wget ที่มากับ busybox ใน image alpine อยู่แล้ว ไม่ต้องติดตั้งเพิ่ม ----
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80

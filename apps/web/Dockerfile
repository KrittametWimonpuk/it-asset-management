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
# คัดลอกไฟล์ static ที่ build เสร็จ ไปไว้ในโฟลเดอร์ที่ nginx เสิร์ฟ
COPY --from=build /app/dist /usr/share/nginx/html
# ใช้ config ของเราเอง (เป็น template เพื่อแทนค่าตัวแปร API_UPSTREAM ตอนสตาร์ท)
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 80

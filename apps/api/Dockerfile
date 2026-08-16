# ---------------------------------------------------------------------------
# Dockerfile ของ API  — สร้าง image สำหรับรัน backend
# ---------------------------------------------------------------------------
# ใช้ node:24 (Debian เต็ม) เพราะมี OpenSSL มาให้ครบ ทำให้ Prisma ทำงานได้เลย
# (ไม่ใช้ alpine เพราะ Prisma มีปัญหาเรื่อง OpenSSL บน musl)
# เลข 24 ต้องตรงกับ .nvmrc และ .github/workflows/ci.yml เสมอ (RC2 — Node Version Consistency)
FROM node:24

# ---- RC3: Image labels (OCI standard) — metadata สำหรับ registry/scanner ไม่กระทบการทำงานของ image ----
LABEL org.opencontainers.image.title="it-asset-management-api" \
      org.opencontainers.image.description="Backend API — Express + Prisma + PostgreSQL" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app

# 1) ติดตั้ง dependency ก่อน (คัดลอก package.json + package-lock.json เพื่อให้ Docker cache ได้)
# ใช้ npm ci แทน npm install — ติดตั้งตรงกับ package-lock.json เป๊ะ ๆ เหมือนที่ CI ใช้ทดสอบ
# (RC2 — Docker Build) กัน dependency drift ระหว่างสิ่งที่ CI ทดสอบผ่านกับสิ่งที่ image จริงมี
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 2) สร้าง Prisma Client จาก schema
COPY prisma ./prisma
RUN npx prisma generate

# 3) คัดลอกโค้ดที่เหลือ
COPY . .

# entrypoint จะรัน migration ให้ก่อนแล้วค่อยสตาร์ท server
RUN chmod +x docker-entrypoint.sh

# รันเป็น non-root user เสมอ (RC2 — Docker Security, least privilege) — "node" คือ user ที่มีอยู่แล้ว
# ในตัว official image (UID 1000) ไม่ต้องสร้างเอง ไฟล์ทั้งหมดที่ COPY มาอ่าน/รันได้อยู่แล้วด้วย
# permission ปกติของ COPY (ไม่ต้องเขียนไฟล์ใด ๆ ตอน runtime — PDF/Excel export เขียนตรงไปที่ HTTP
# response ไม่ใช่ดิสก์ และ migration/query ต่อฐานข้อมูลผ่าน network ไม่ใช่ local filesystem)
USER node

# ---- RC3: Healthcheck — ใช้ Node ที่มีอยู่แล้วในตัว image ยิงเข้า /health เอง ไม่ติดตั้ง curl/wget
# เพิ่ม (ลด attack surface — น้อย package ติดตั้งเท่ากับพื้นที่ให้โจมตีน้อยลง) start-period ยาวหน่อยเผื่อ
# เวลารัน migration (docker-entrypoint.sh) ก่อน server จะเริ่มฟัง request จริง
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

EXPOSE 4000
CMD ["./docker-entrypoint.sh"]

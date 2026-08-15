# ---------------------------------------------------------------------------
# Dockerfile ของ API  — สร้าง image สำหรับรัน backend
# ---------------------------------------------------------------------------
# ใช้ node:24 (Debian เต็ม) เพราะมี OpenSSL มาให้ครบ ทำให้ Prisma ทำงานได้เลย
# (ไม่ใช้ alpine เพราะ Prisma มีปัญหาเรื่อง OpenSSL บน musl)
# เลข 24 ต้องตรงกับ .nvmrc และ .github/workflows/ci.yml เสมอ (RC2 — Node Version Consistency)
FROM node:24

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

EXPOSE 4000
CMD ["./docker-entrypoint.sh"]

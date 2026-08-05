# ---------------------------------------------------------------------------
# Dockerfile ของ API  — สร้าง image สำหรับรัน backend
# ---------------------------------------------------------------------------
# ใช้ node:20 (Debian เต็ม) เพราะมี OpenSSL มาให้ครบ ทำให้ Prisma ทำงานได้เลย
# (ไม่ใช้ alpine เพราะ Prisma มีปัญหาเรื่อง OpenSSL บน musl)
FROM node:20

WORKDIR /app

# 1) ติดตั้ง dependency ก่อน (คัดลอกแค่ package.json เพื่อให้ Docker cache ได้)
COPY package.json ./
RUN npm install --omit=dev

# 2) สร้าง Prisma Client จาก schema
COPY prisma ./prisma
RUN npx prisma generate

# 3) คัดลอกโค้ดที่เหลือ
COPY . .

# entrypoint จะรัน migration ให้ก่อนแล้วค่อยสตาร์ท server
RUN chmod +x docker-entrypoint.sh

EXPOSE 4000
CMD ["./docker-entrypoint.sh"]

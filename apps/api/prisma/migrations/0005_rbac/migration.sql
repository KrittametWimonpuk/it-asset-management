-- Migration ที่ห้า: Milestone 4 — Role Based Access Control (RBAC)
-- เพิ่ม role ให้ User (enum UserRole: ADMIN / IT_STAFF / EMPLOYEE, default EMPLOYEE)
-- และเพิ่ม updatedAt (createdAt มีอยู่แล้วตั้งแต่ 0001_init)
--
-- หมายเหตุ: ไม่แก้ไข migration เดิม (0001-0004) — เพิ่ม migration ใหม่เสมอ

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'IT_STAFF', 'EMPLOYEE');

-- AlterTable
-- updatedAt ใช้ DEFAULT CURRENT_TIMESTAMP เพื่อ backfill แถวผู้ใช้เดิมที่มีอยู่แล้ว (คอลัมน์ NOT NULL
-- แก้ไม่ได้ถ้าไม่มีค่าเริ่มต้นให้แถวเก่า) — role ก็มี DEFAULT อยู่แล้วจาก schema จึงไม่มีปัญหาเดียวกัน
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'EMPLOYEE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

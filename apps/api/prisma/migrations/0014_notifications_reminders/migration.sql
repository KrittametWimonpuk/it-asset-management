-- v1.1.0 Beta 1 — Notifications & Reminder System
-- Expand-only: adds an independent communication layer without changing lifecycle records.
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');
CREATE TYPE "NotificationType" AS ENUM ('BORROW_REQUEST', 'APPROVAL', 'ASSIGNMENT', 'RETURN', 'REMINDER', 'SYSTEM');

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_isRead_deletedAt_createdAt_idx"
  ON "Notification"("userId", "isRead", "deletedAt", "createdAt");
CREATE INDEX "Notification_type_priority_createdAt_idx"
  ON "Notification"("type", "priority", "createdAt");
CREATE INDEX "Notification_deletedAt_idx" ON "Notification"("deletedAt");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

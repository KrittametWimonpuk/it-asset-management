/**
 * @openapi
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: รายการแจ้งเตือนของผู้ใช้ปัจจุบัน
 *     description: ทุก role เห็นเฉพาะ Notification ที่มี userId เป็นบัญชีของตนเอง; due reminder สร้างโดย scheduler แบบ idempotent
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/PageSizeParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - in: query
 *         name: type
 *         schema: { $ref: '#/components/schemas/NotificationType' }
 *       - in: query
 *         name: priority
 *         schema: { $ref: '#/components/schemas/NotificationPriority' }
 *       - in: query
 *         name: isRead
 *         schema: { type: boolean }
 *     responses:
 *       '200': { description: รายการแบบแบ่งหน้า }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *
 * /api/notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: จำนวนการแจ้งเตือนที่ยังไม่อ่าน
 *     responses:
 *       '200': { description: 'คืน count ใน response envelope' }
 *
 * /api/notifications/read-all:
 *   post:
 *     tags: [Notifications]
 *     summary: ทำเครื่องหมายการแจ้งเตือนทั้งหมดของตนเองว่าอ่านแล้ว
 *     responses:
 *       '200': { description: สำเร็จ }
 *
 * /api/notifications/{id}/read:
 *   post:
 *     tags: [Notifications]
 *     summary: ทำเครื่องหมายการแจ้งเตือนหนึ่งรายการว่าอ่านแล้ว
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200': { description: สำเร็จ }
 *       '404': { description: ไม่พบหรือไม่ใช่ของผู้ใช้ปัจจุบัน }
 *
 * /api/notifications/{id}:
 *   delete:
 *     tags: [Notifications]
 *     summary: เก็บการแจ้งเตือนเข้าคลังแบบ soft delete
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200': { description: สำเร็จ }
 *       '404': { description: ไม่พบหรือไม่ใช่ของผู้ใช้ปัจจุบัน }
 *
 * /api/reports/notifications:
 *   get:
 *     tags: [Reports]
 *     summary: รายงานสรุปการแจ้งเตือน
 *     description: สรุปตามประเภท/ความสำคัญเฉพาะรายการที่ส่งถึงบัญชีปัจจุบัน รองรับ CSV/XLSX/PDF
 *     parameters:
 *       - $ref: '#/components/parameters/SearchParam'
 *       - in: query
 *         name: notificationType
 *         schema: { $ref: '#/components/schemas/NotificationType' }
 *       - in: query
 *         name: notificationPriority
 *         schema: { $ref: '#/components/schemas/NotificationPriority' }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [csv, xlsx, pdf] }
 *     responses:
 *       '200': { description: Summary JSON หรือไฟล์ส่งออก }
 */

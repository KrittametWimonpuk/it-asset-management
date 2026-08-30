/**
 * @openapi
 * /api/settings/notifications:
 *   get:
 *     tags: [Notification Settings]
 *     summary: อ่านการตั้งค่าการแจ้งเตือนของบัญชีปัจจุบัน
 *     responses:
 *       '200': { description: การตั้งค่า Email และ In-app ของตนเอง }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *   put:
 *     tags: [Notification Settings]
 *     summary: แก้ไขการตั้งค่าการแจ้งเตือนของบัญชีปัจจุบัน
 *     description: เปลี่ยน notificationEmail แล้วระบบยกเลิกสถานะยืนยันเดิมทันที โดยไม่เปลี่ยนอีเมล Login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/NotificationPreferenceUpdate' }
 *     responses:
 *       '200': { description: บันทึกสำเร็จ }
 *       '400': { description: Validation ไม่ผ่านหรือพยายามเปิด Email ก่อนยืนยัน }
 *
 * /api/settings/notifications/email/verify:
 *   post:
 *     tags: [Notification Settings]
 *     summary: ส่งลิงก์ยืนยันอีเมลแจ้งเตือน
 *     description: One-time token อายุ 20 นาทีและจำกัดจำนวนครั้งต่อบัญชี
 *     responses:
 *       '202': { description: นำอีเมลยืนยันเข้าคิวแล้ว หรือบันทึกเป็น SKIPPED เมื่อ Email ปิดอยู่ }
 *       '429': { description: ขออีเมลยืนยันบ่อยเกินไป }
 *
 * /api/settings/notifications/email/confirm:
 *   post:
 *     tags: [Notification Settings]
 *     summary: ยืนยันอีเมลด้วย one-time token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties: { token: { type: string, minLength: 64, maxLength: 64 } }
 *     responses:
 *       '200': { description: ยืนยันสำเร็จ }
 *       '400': { description: Token ไม่ถูกต้อง หมดอายุ ถูกใช้แล้ว หรือไม่ใช่ของบัญชีนี้ }
 *
 * /api/settings/notifications/email/test:
 *   post:
 *     tags: [Notification Settings]
 *     summary: นำอีเมลทดสอบเข้าสู่คิว
 *     responses:
 *       '202': { description: เข้าคิวสำเร็จ }
 *       '400': { description: อีเมลยังไม่ผ่านการยืนยัน }
 *       '429': { description: ส่งอีเมลทดสอบบ่อยเกินไป }
 */

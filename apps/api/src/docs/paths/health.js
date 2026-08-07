// ---------------------------------------------------------------------------
// เอกสาร OpenAPI: Health check (src/index.js) — ไม่มี business logic ไฟล์นี้เป็น comment ล้วน ๆ
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check (นอก /api)
 *     description: >
 *       ใช้ให้ AWS Application Load Balancer (ALB) หรือระบบ monitoring เช็กว่าเซิร์ฟเวอร์ยังทำงานอยู่
 *       ตอบ 200 เสมอตราบใดที่ Node process ยังรันอยู่ (ไม่ตรวจการเชื่อมต่อฐานข้อมูล)
 *     security: []
 *     responses:
 *       200:
 *         description: เซิร์ฟเวอร์ทำงานปกติ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 time: { type: string, format: date-time }
 */

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: Health check (ใต้ /api — เผื่อ reverse proxy บาง config)
 *     description: เหมือนกับ GET /health ทุกประการ (mount ซ้ำสองจุดใน src/index.js)
 *     security: []
 *     responses:
 *       200:
 *         description: เซิร์ฟเวอร์ทำงานปกติ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 time: { type: string, format: date-time }
 */

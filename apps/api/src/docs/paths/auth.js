// ---------------------------------------------------------------------------
// เอกสาร OpenAPI: /api/auth (src/routes/auth.js) — ไฟล์นี้เป็น comment ล้วน ๆ ไม่แตะ business logic
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: สมัครสมาชิกใหม่
 *     description: >
 *       สร้างผู้ใช้ใหม่ด้วย role EMPLOYEE เสมอ — client ไม่สามารถส่ง role มากำหนดเองได้ (ป้องกันการยกระดับสิทธิ์ตัวเอง)
 *       รหัสผ่านถูกเข้ารหัสด้วย bcrypt ก่อนบันทึก ไม่มีการเก็บรหัสผ่านจริงในฐานข้อมูล
 *       สำเร็จแล้วจะได้ JWT กลับมาทันที (ไม่ต้อง login ซ้ำ)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: สมัครสำเร็จ — คืน JWT และข้อมูลผู้ใช้
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: ข้อมูลไม่ผ่าน validation (อีเมลไม่ถูกต้อง / รหัสผ่านสั้นกว่า 6 ตัวอักษร)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: อีเมลนี้ถูกใช้ไปแล้ว
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: เข้าสู่ระบบ
 *     description: >
 *       ตรวจอีเมล + รหัสผ่าน คืน JWT ที่หมดอายุใน 7 วัน (แนบ id/email/role ไว้ในตัว token)
 *       ตอบข้อความ error เดียวกันไม่ว่าจะเป็นอีเมลไม่มีอยู่จริงหรือรหัสผ่านผิด เพื่อไม่ให้เดาได้ว่าอีเมลมีอยู่ในระบบหรือไม่
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: เข้าสู่ระบบสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: ข้อมูลไม่ผ่าน validation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: อีเมลหรือรหัสผ่านไม่ถูกต้อง
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: อีเมลหรือรหัสผ่านไม่ถูกต้อง
 *               errors: null
 */

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: ดูข้อมูลผู้ใช้ปัจจุบัน
 *     description: คืนข้อมูลผู้ใช้ของ token ที่แนบมา (ไม่รวม password)
 *     responses:
 *       200:
 *         description: ข้อมูลผู้ใช้ปัจจุบัน
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: ไม่ได้แนบ JWT หรือ JWT ไม่ถูกต้อง/หมดอายุ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

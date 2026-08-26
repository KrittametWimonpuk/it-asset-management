// ---------------------------------------------------------------------------
// เอกสาร OpenAPI: /api/users (src/routes/users.js) — ไฟล์นี้เป็น comment ล้วน ๆ ไม่แตะ business logic
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: รายชื่อผู้ใช้ทั้งหมด
 *     description: >
 *       เฉพาะ ADMIN, IT_STAFF (EMPLOYEE เข้าไม่ได้) — ใช้เลือกพนักงานตอนมอบหมายครุภัณฑ์ หรือมอบหมายผู้ดูแลตั๋ว
 *       ไม่ส่ง password กลับมาเด็ดขาด รองรับค้นหาจากชื่อ อีเมล รหัสพนักงาน และชื่อพนักงาน
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/PageSizeParam'
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [email, name, role, createdAt], default: createdAt }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         description: รายชื่อผู้ใช้
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items: { type: array, items: { $ref: '#/components/schemas/User' } }
 *                     page: { type: integer }
 *                     pageSize: { type: integer }
 *                     totalItems: { type: integer }
 *                     totalPages: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @openapi
 * /api/users/{id}/role:
 *   patch:
 *     tags: [Users]
 *     summary: เปลี่ยนสิทธิ์บัญชีผู้ใช้
 *     description: เฉพาะ ADMIN; ห้ามเปลี่ยนสิทธิ์ตัวเองและห้ามลดสิทธิ์ ADMIN คนสุดท้าย
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             additionalProperties: false
 *             properties:
 *               role: { $ref: '#/components/schemas/UserRole' }
 *     responses:
 *       200:
 *         description: เปลี่ยนสิทธิ์สำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/User' }
 *       400:
 *         description: role ไม่ถูกต้องหรือพยายามเปลี่ยนสิทธิ์บัญชีตัวเอง
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: ไม่สามารถลดสิทธิ์ ADMIN คนสุดท้ายหรือมีการแก้ไขพร้อมกัน
 */

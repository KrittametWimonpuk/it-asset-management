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
 *       เป็นการ "ดูอย่างเดียว" ยังไม่มี endpoint สร้าง/แก้ไข/ลบ/เปลี่ยน role ให้ role ไหนเรียกได้เลย — ไม่ส่ง password กลับมาเด็ดขาด
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

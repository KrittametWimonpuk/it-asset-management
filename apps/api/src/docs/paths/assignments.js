// ---------------------------------------------------------------------------
// เอกสาร OpenAPI: /api/assignments (src/routes/assignments.js) — ไฟล์นี้เป็น comment ล้วน ๆ ไม่แตะ business logic
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /api/assignments:
 *   get:
 *     tags: [Assignments]
 *     summary: รายการมอบหมาย/ประวัติการถือครองครุภัณฑ์
 *     description: >
 *       ทุก role เข้าได้ แต่ EMPLOYEE เห็นเฉพาะรายการที่ตัวเองเป็นผู้ถือครอง (ทั้งอดีต+ปัจจุบัน)
 *       ADMIN/IT_STAFF เห็นทุกรายการ — หนึ่งแถวคือการมอบหมายหนึ่งรอบ (ตั้งแต่มอบจนกว่าจะคืน) เป็นประวัติที่ไม่ถูกเขียนทับ
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/PageSizeParam'
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [assignedAt, returnedAt, createdAt, status], default: assignedAt }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - $ref: '#/components/parameters/SearchParam'
 *       - in: query
 *         name: status
 *         schema: { $ref: '#/components/schemas/AssignmentStatus' }
 *       - in: query
 *         name: assetId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: userId
 *         schema: { type: string, format: uuid }
 *         description: กรองตามผู้ถือครอง — ใช้ได้เฉพาะ ADMIN/IT_STAFF (EMPLOYEE ถูกจำกัดที่ตัวเองอยู่แล้ว)
 *     responses:
 *       200:
 *         description: รายการมอบหมาย
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items: { type: array, items: { $ref: '#/components/schemas/Assignment' } }
 *                     page: { type: integer }
 *                     pageSize: { type: integer }
 *                     totalItems: { type: integer }
 *                     totalPages: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   post:
 *     tags: [Assignments]
 *     summary: มอบหมายครุภัณฑ์ให้พนักงาน
 *     description: >
 *       เฉพาะ ADMIN, IT_STAFF — ครุภัณฑ์ต้องยังไม่มีผู้ถือครองอยู่ (asset หนึ่งชิ้นมี assignment
 *       ที่ยัง active ได้สูงสุด 1 แถว บังคับจริงด้วย partial unique index ในฐานข้อมูล)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AssignmentCreateRequest' }
 *     responses:
 *       201:
 *         description: มอบหมายสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { success: { type: boolean, example: true }, data: { $ref: '#/components/schemas/Assignment' } }
 *       400:
 *         description: ข้อมูลไม่ผ่าน validation, ครุภัณฑ์ไม่ถูกต้อง/ถูกลบไปแล้ว, หรือไม่พบผู้ใช้ที่เลือก
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         description: ครุภัณฑ์นี้ถูกมอบหมายให้ผู้อื่นอยู่แล้ว
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */

/**
 * @openapi
 * /api/assignments/{id}:
 *   get:
 *     tags: [Assignments]
 *     summary: ดูรายการมอบหมายชิ้นเดียว
 *     description: ขอบเขตเดียวกับ GET /api/assignments — EMPLOYEE ดูได้เฉพาะของตัวเอง
 *     parameters:
 *       - $ref: '#/components/parameters/AssignmentId'
 *     responses:
 *       200:
 *         description: รายละเอียดรายการมอบหมาย
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { success: { type: boolean, example: true }, data: { $ref: '#/components/schemas/Assignment' } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: ไม่พบรายการมอบหมายนี้ หรือไม่มีสิทธิ์เข้าถึง
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *   put:
 *     tags: [Assignments]
 *     summary: แก้ไขรายละเอียดการมอบหมาย
 *     description: >
 *       เฉพาะ ADMIN, IT_STAFF — แก้ได้เฉพาะ expectedReturnDate/conditionBefore/remark เท่านั้น
 *       (แก้ asset/ผู้ถือครอง/วันที่มอบหมายไม่ได้) และแก้ได้เฉพาะตอนยัง active (ยังไม่ถูกรับคืน)
 *     parameters:
 *       - $ref: '#/components/parameters/AssignmentId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AssignmentUpdateRequest' }
 *     responses:
 *       200:
 *         description: แก้ไขสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { success: { type: boolean, example: true }, data: { $ref: '#/components/schemas/Assignment' } }
 *       400:
 *         description: ข้อมูลไม่ผ่าน validation (เช่น วันที่คาดว่าจะคืนก่อนวันที่มอบหมาย)
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: ไม่พบรายการนี้ หรือถูกรับคืนไปแล้ว (แก้ไขไม่ได้อีก)
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */

/**
 * @openapi
 * /api/assignments/{id}/return:
 *   post:
 *     tags: [Assignments]
 *     summary: รับคืนครุภัณฑ์ (ปิดรายการมอบหมาย)
 *     description: >
 *       เฉพาะ ADMIN, IT_STAFF — ทางเดียวที่จะปิดรายการมอบหมาย (ตั้ง returnedAt) ผลลัพธ์เป็น RETURNED/LOST/DAMAGED
 *       (default RETURNED) เคลียร์สถานะ "ผู้ถือครองปัจจุบัน" ของครุภัณฑ์นั้นโดยอัตโนมัติ
 *     parameters:
 *       - $ref: '#/components/parameters/AssignmentId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AssignmentReturnRequest' }
 *     responses:
 *       200:
 *         description: รับคืนสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { success: { type: boolean, example: true }, data: { $ref: '#/components/schemas/Assignment' } }
 *       400:
 *         description: ข้อมูลไม่ผ่าน validation (เช่น วันที่คืนก่อนวันที่มอบหมาย)
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: ไม่พบรายการนี้ หรือถูกรับคืนไปแล้ว
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */

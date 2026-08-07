// ---------------------------------------------------------------------------
// เอกสาร OpenAPI: /api/assets (src/routes/assets.js) — ไฟล์นี้เป็น comment ล้วน ๆ ไม่แตะ business logic
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /api/assets:
 *   get:
 *     tags: [Assets]
 *     summary: ดึงรายการครุภัณฑ์ (แบ่งหน้า + ค้นหา + กรอง + เรียงลำดับ)
 *     description: >
 *       ทุก role เข้าถึงได้ แต่ขอบเขตต่างกัน: ADMIN/IT_STAFF เห็นครุภัณฑ์ทั้งหมด ส่วน EMPLOYEE
 *       เห็นเฉพาะครุภัณฑ์ที่ตัวเองเป็นผู้ถือครองอยู่ในปัจจุบัน (มี assignment ที่ยัง active)
 *       แต่ละรายการแนบ currentAssignment, assignmentHistoryCount, และสรุปใบแจ้งซ่อม (openTicketsCount ฯลฯ) มาด้วยเสมอ
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [assetTag, name, createdAt, status], default: createdAt }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: ค้นหาใน assetTag, name, brand, model, serialNumber, hostname, ipAddress, macAddress, operatingSystem (ไม่สนตัวพิมพ์เล็ก/ใหญ่)
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: locationId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: departmentId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: vendorId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: status
 *         schema: { $ref: '#/components/schemas/AssetStatus' }
 *       - in: query
 *         name: unassigned
 *         schema: { type: string, enum: [true] }
 *         description: กรองเฉพาะครุภัณฑ์ที่ยังไม่มีผู้ถือครอง (ใช้ตอนเลือกครุภัณฑ์จะมอบหมายใหม่) — ใช้ได้เฉพาะ ADMIN/IT_STAFF
 *     responses:
 *       200:
 *         description: รายการครุภัณฑ์
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties:
 *                     success: { type: boolean, example: true }
 *                     data:
 *                       type: object
 *                       properties:
 *                         items:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/Asset' }
 *                 - type: object
 *                   properties:
 *                     data:
 *                       allOf: [{ $ref: '#/components/schemas/Pagination' }]
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   post:
 *     tags: [Assets]
 *     summary: เพิ่มครุภัณฑ์ใหม่
 *     description: เฉพาะ ADMIN, IT_STAFF — assetTag และ serialNumber ต้องไม่ซ้ำกับที่มีอยู่แล้ว
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AssetCreateRequest' }
 *     responses:
 *       201:
 *         description: สร้างสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Asset' }
 *       400:
 *         description: ข้อมูลไม่ผ่าน validation หรืออ้างอิง master data (categoryId ฯลฯ) ที่ไม่มีอยู่จริง/ถูกลบไปแล้ว
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         description: assetTag หรือ serialNumber ซ้ำกับที่มีอยู่แล้ว
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */

/**
 * @openapi
 * /api/assets/{id}:
 *   get:
 *     tags: [Assets]
 *     summary: ดูรายละเอียดครุภัณฑ์ชิ้นเดียว
 *     description: ขอบเขตเดียวกับ GET /api/assets — EMPLOYEE ดูได้เฉพาะที่ตัวเองถือครองอยู่
 *     parameters:
 *       - $ref: '#/components/parameters/AssetId'
 *     responses:
 *       200:
 *         description: รายละเอียดครุภัณฑ์
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Asset' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: ไม่พบครุภัณฑ์นี้ หรือไม่มีสิทธิ์เข้าถึง (ข้อความเดียวกันทั้งสองกรณี)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *   put:
 *     tags: [Assets]
 *     summary: แก้ไขข้อมูลครุภัณฑ์
 *     description: เฉพาะ ADMIN, IT_STAFF — ทุกฟิลด์ optional (ส่งเฉพาะที่ต้องการแก้)
 *     parameters:
 *       - $ref: '#/components/parameters/AssetId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AssetUpdateRequest' }
 *     responses:
 *       200:
 *         description: แก้ไขสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Asset' }
 *       400:
 *         description: ข้อมูลไม่ผ่าน validation หรืออ้างอิง master data ที่ไม่ถูกต้อง
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: ไม่พบครุภัณฑ์นี้ หรือถูกลบไปแล้ว
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       409:
 *         description: assetTag หรือ serialNumber ซ้ำกับของชิ้นอื่น
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *   delete:
 *     tags: [Assets]
 *     summary: ลบครุภัณฑ์ (soft delete)
 *     description: >
 *       เฉพาะ ADMIN, IT_STAFF — เป็น soft delete (ตั้งค่า deletedAt) ไม่ลบแถวออกจริง
 *       ลบไม่ได้ถ้ายังมีผู้ถือครองอยู่ (active assignment) ต้องรับคืนก่อน
 *     parameters:
 *       - $ref: '#/components/parameters/AssetId'
 *     responses:
 *       200:
 *         description: ลบสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties: { id: { type: string, format: uuid } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: ไม่พบครุภัณฑ์นี้ หรือถูกลบไปแล้ว
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       409:
 *         description: ยังมีผู้ถือครองอยู่ (active assignment) — ต้องรับคืนก่อนลบ
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */

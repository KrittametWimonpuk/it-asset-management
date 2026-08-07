// ---------------------------------------------------------------------------
// เอกสาร OpenAPI: /api/categories, /api/locations, /api/departments, /api/vendors
// (src/utils/masterDataRouter.js — โรงงานสร้าง router เดียวกันสำหรับทั้ง 4 เอนทิตี)
// ไฟล์นี้เป็น comment ล้วน ๆ ไม่แตะ business logic
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /api/categories:
 *   get:
 *     tags: [Master Data]
 *     summary: รายการหมวดหมู่ครุภัณฑ์
 *     description: ทุก role ที่ล็อกอินแล้วดูได้ — รองรับแบ่งหน้า/ค้นหา/เรียงลำดับ/กรอง isActive
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/PageSizeParam'
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [name, createdAt], default: name }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - $ref: '#/components/parameters/SearchParam'
 *       - in: query
 *         name: isActive
 *         schema: { type: string, enum: ['true', 'false'] }
 *     responses:
 *       200:
 *         description: รายการหมวดหมู่
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items: { type: array, items: { $ref: '#/components/schemas/MasterDataItem' } }
 *                     page: { type: integer }
 *                     pageSize: { type: integer }
 *                     totalItems: { type: integer }
 *                     totalPages: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   post:
 *     tags: [Master Data]
 *     summary: เพิ่มหมวดหมู่ใหม่
 *     description: เฉพาะ ADMIN, IT_STAFF — ชื่อห้ามซ้ำ (ไม่สนตัวพิมพ์เล็ก/ใหญ่)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/MasterDataCreateRequest' }
 *     responses:
 *       201:
 *         description: สร้างสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/MasterDataItem' }
 *       400:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         description: ชื่อหมวดหมู่นี้ถูกใช้ไปแล้ว
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */

/**
 * @openapi
 * /api/categories/{id}:
 *   get:
 *     tags: [Master Data]
 *     summary: ดูหมวดหมู่รายการเดียว
 *     parameters:
 *       - $ref: '#/components/parameters/MasterDataId'
 *     responses:
 *       200:
 *         description: รายละเอียดหมวดหมู่
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { success: { type: boolean, example: true }, data: { $ref: '#/components/schemas/MasterDataItem' } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *   put:
 *     tags: [Master Data]
 *     summary: แก้ไขหมวดหมู่
 *     description: เฉพาะ ADMIN, IT_STAFF — ทุกฟิลด์ optional
 *     parameters:
 *       - $ref: '#/components/parameters/MasterDataId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/MasterDataCreateRequest' }
 *     responses:
 *       200:
 *         description: แก้ไขสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { success: { type: boolean, example: true }, data: { $ref: '#/components/schemas/MasterDataItem' } }
 *       400:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       409:
 *         description: ชื่อหมวดหมู่นี้ถูกใช้ไปแล้ว
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *   delete:
 *     tags: [Master Data]
 *     summary: ลบหมวดหมู่ (soft delete)
 *     description: เฉพาะ ADMIN, IT_STAFF
 *     parameters:
 *       - $ref: '#/components/parameters/MasterDataId'
 *     responses:
 *       200:
 *         description: ลบสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { id: { type: string, format: uuid } } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */

/**
 * @openapi
 * /api/locations:
 *   get:
 *     tags: [Master Data]
 *     summary: รายการสถานที่ตั้งครุภัณฑ์
 *     description: โครงสร้าง request/response เหมือน /api/categories ทุกประการ (ใช้ router factory เดียวกัน)
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/PageSizeParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - in: query
 *         name: isActive
 *         schema: { type: string, enum: ['true', 'false'] }
 *     responses:
 *       200:
 *         description: รายการสถานที่ตั้ง
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items: { type: array, items: { $ref: '#/components/schemas/MasterDataItem' } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   post:
 *     tags: [Master Data]
 *     summary: เพิ่มสถานที่ตั้งใหม่
 *     description: เฉพาะ ADMIN, IT_STAFF
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/MasterDataCreateRequest' }
 *     responses:
 *       201:
 *         description: สร้างสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { success: { type: boolean, example: true }, data: { $ref: '#/components/schemas/MasterDataItem' } }
 *       400:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */

/**
 * @openapi
 * /api/locations/{id}:
 *   get:
 *     tags: [Master Data]
 *     summary: ดูสถานที่ตั้งรายการเดียว
 *     parameters:
 *       - $ref: '#/components/parameters/MasterDataId'
 *     responses:
 *       200:
 *         description: รายละเอียดสถานที่ตั้ง
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { success: { type: boolean, example: true }, data: { $ref: '#/components/schemas/MasterDataItem' } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *   put:
 *     tags: [Master Data]
 *     summary: แก้ไขสถานที่ตั้ง
 *     description: เฉพาะ ADMIN, IT_STAFF
 *     parameters:
 *       - $ref: '#/components/parameters/MasterDataId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/MasterDataCreateRequest' }
 *     responses:
 *       200:
 *         description: แก้ไขสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { success: { type: boolean, example: true }, data: { $ref: '#/components/schemas/MasterDataItem' } }
 *       400:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       409:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *   delete:
 *     tags: [Master Data]
 *     summary: ลบสถานที่ตั้ง (soft delete)
 *     description: เฉพาะ ADMIN, IT_STAFF
 *     parameters:
 *       - $ref: '#/components/parameters/MasterDataId'
 *     responses:
 *       200:
 *         description: ลบสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { id: { type: string, format: uuid } } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */

/**
 * @openapi
 * /api/departments:
 *   get:
 *     tags: [Master Data]
 *     summary: รายการแผนก
 *     description: โครงสร้าง request/response เหมือน /api/categories ทุกประการ (ใช้ router factory เดียวกัน)
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/PageSizeParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - in: query
 *         name: isActive
 *         schema: { type: string, enum: ['true', 'false'] }
 *     responses:
 *       200:
 *         description: รายการแผนก
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items: { type: array, items: { $ref: '#/components/schemas/MasterDataItem' } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   post:
 *     tags: [Master Data]
 *     summary: เพิ่มแผนกใหม่
 *     description: เฉพาะ ADMIN, IT_STAFF
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/MasterDataCreateRequest' }
 *     responses:
 *       201:
 *         description: สร้างสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { success: { type: boolean, example: true }, data: { $ref: '#/components/schemas/MasterDataItem' } }
 *       400:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */

/**
 * @openapi
 * /api/departments/{id}:
 *   get:
 *     tags: [Master Data]
 *     summary: ดูแผนกรายการเดียว
 *     parameters:
 *       - $ref: '#/components/parameters/MasterDataId'
 *     responses:
 *       200:
 *         description: รายละเอียดแผนก
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { success: { type: boolean, example: true }, data: { $ref: '#/components/schemas/MasterDataItem' } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *   put:
 *     tags: [Master Data]
 *     summary: แก้ไขแผนก
 *     description: เฉพาะ ADMIN, IT_STAFF
 *     parameters:
 *       - $ref: '#/components/parameters/MasterDataId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/MasterDataCreateRequest' }
 *     responses:
 *       200:
 *         description: แก้ไขสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { success: { type: boolean, example: true }, data: { $ref: '#/components/schemas/MasterDataItem' } }
 *       400:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       409:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *   delete:
 *     tags: [Master Data]
 *     summary: ลบแผนก (soft delete)
 *     description: เฉพาะ ADMIN, IT_STAFF
 *     parameters:
 *       - $ref: '#/components/parameters/MasterDataId'
 *     responses:
 *       200:
 *         description: ลบสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { id: { type: string, format: uuid } } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */

/**
 * @openapi
 * /api/vendors:
 *   get:
 *     tags: [Master Data]
 *     summary: รายการผู้ขาย/ผู้ผลิต
 *     description: เหมือน /api/categories แต่ค้นหาได้เพิ่มจาก contactName และ email ด้วย (นอกเหนือจาก name)
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/PageSizeParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - in: query
 *         name: isActive
 *         schema: { type: string, enum: ['true', 'false'] }
 *     responses:
 *       200:
 *         description: รายการผู้ขาย/ผู้ผลิต
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items: { type: array, items: { $ref: '#/components/schemas/Vendor' } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   post:
 *     tags: [Master Data]
 *     summary: เพิ่มผู้ขาย/ผู้ผลิตใหม่
 *     description: เฉพาะ ADMIN, IT_STAFF
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/VendorCreateRequest' }
 *     responses:
 *       201:
 *         description: สร้างสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { success: { type: boolean, example: true }, data: { $ref: '#/components/schemas/Vendor' } }
 *       400:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */

/**
 * @openapi
 * /api/vendors/{id}:
 *   get:
 *     tags: [Master Data]
 *     summary: ดูผู้ขาย/ผู้ผลิตรายการเดียว
 *     parameters:
 *       - $ref: '#/components/parameters/MasterDataId'
 *     responses:
 *       200:
 *         description: รายละเอียดผู้ขาย/ผู้ผลิต
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { success: { type: boolean, example: true }, data: { $ref: '#/components/schemas/Vendor' } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *   put:
 *     tags: [Master Data]
 *     summary: แก้ไขผู้ขาย/ผู้ผลิต
 *     description: เฉพาะ ADMIN, IT_STAFF
 *     parameters:
 *       - $ref: '#/components/parameters/MasterDataId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/VendorCreateRequest' }
 *     responses:
 *       200:
 *         description: แก้ไขสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { success: { type: boolean, example: true }, data: { $ref: '#/components/schemas/Vendor' } }
 *       400:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       409:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *   delete:
 *     tags: [Master Data]
 *     summary: ลบผู้ขาย/ผู้ผลิต (soft delete)
 *     description: เฉพาะ ADMIN, IT_STAFF
 *     parameters:
 *       - $ref: '#/components/parameters/MasterDataId'
 *     responses:
 *       200:
 *         description: ลบสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { id: { type: string, format: uuid } } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */

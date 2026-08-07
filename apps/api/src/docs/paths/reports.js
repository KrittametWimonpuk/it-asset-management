// ---------------------------------------------------------------------------
// เอกสาร OpenAPI: /api/reports (src/routes/reports.js) — ไฟล์นี้เป็น comment ล้วน ๆ ไม่แตะ business logic
//
// ทุก endpoint รองรับสองโหมด:
//   - ไม่ส่ง ?format= มา -> ตอบ JSON ผ่าน response envelope ปกติ พร้อมแบ่งหน้า (ใช้แสดง Preview)
//   - ?format=csv|xlsx|pdf -> ส่งไฟล์กลับตรง ๆ (ไม่ใช่ JSON) ดึงข้อมูล "ทั้งหมด" ที่ตรงกับตัวกรอง+ขอบเขตสิทธิ์
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /api/reports/assets:
 *   get:
 *     tags: [Reports]
 *     summary: รายงานครุภัณฑ์คงเหลือ (Asset Inventory)
 *     description: >
 *       ADMIN/IT_STAFF เห็นภาพรวมทั้งองค์กร, EMPLOYEE เห็นเฉพาะครุภัณฑ์ที่ตัวเองถือครองอยู่
 *       (ใช้ scopeForRead เดียวกับ GET /api/assets เป๊ะ ๆ)
 *     parameters:
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [csv, xlsx, pdf] }
 *         description: ไม่ส่งมา = ตอบ JSON แบบแบ่งหน้า (Preview) — ส่งมา = ดาวน์โหลดไฟล์รายงานทั้งหมด
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/PageSizeParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *         description: กรองตามวันที่ซื้อ (purchaseDate) ตั้งแต่วันนี้เป็นต้นไป
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
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
 *     responses:
 *       200:
 *         description: รายงาน (JSON แบบแบ่งหน้าถ้าไม่ส่ง format หรือไฟล์ CSV/Excel/PDF ถ้าส่ง format มา)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items: { type: array, items: { $ref: '#/components/schemas/AssetInventoryReportRow' } }
 *                     page: { type: integer }
 *                     pageSize: { type: integer }
 *                     totalItems: { type: integer }
 *                     totalPages: { type: integer }
 *           text/csv:
 *             schema: { type: string, format: binary }
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema: { type: string, format: binary }
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */

/**
 * @openapi
 * /api/reports/assignments:
 *   get:
 *     tags: [Reports]
 *     summary: รายงานการมอบหมายครุภัณฑ์ (Asset Assignment)
 *     description: >
 *       ADMIN/IT_STAFF เห็นภาพรวมทั้งองค์กร, EMPLOYEE เห็นเฉพาะรายการที่ตัวเองเป็นผู้ถือครอง
 *       (ใช้ scopeForRead เดียวกับ GET /api/assignments เป๊ะ ๆ)
 *     parameters:
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [csv, xlsx, pdf] }
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/PageSizeParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *         description: กรองตามวันที่มอบหมาย (assignedAt)
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
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
 *         name: assignmentStatus
 *         schema: { $ref: '#/components/schemas/AssignmentStatus' }
 *     responses:
 *       200:
 *         description: รายงาน (JSON แบบแบ่งหน้าถ้าไม่ส่ง format หรือไฟล์ CSV/Excel/PDF ถ้าส่ง format มา)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items: { type: array, items: { $ref: '#/components/schemas/AssignmentReportRow' } }
 *                     page: { type: integer }
 *                     pageSize: { type: integer }
 *                     totalItems: { type: integer }
 *                     totalPages: { type: integer }
 *           text/csv:
 *             schema: { type: string, format: binary }
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema: { type: string, format: binary }
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */

/**
 * @openapi
 * /api/reports/warranty:
 *   get:
 *     tags: [Reports]
 *     summary: รายงานการรับประกัน (Warranty)
 *     description: >
 *       ADMIN/IT_STAFF เห็นภาพรวมทั้งองค์กร, EMPLOYEE เห็นเฉพาะครุภัณฑ์ที่ตัวเองถือครองอยู่
 *       เฉพาะครุภัณฑ์ที่มีวันหมดประกัน (warrantyExpiry ไม่เป็น null)
 *     parameters:
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [csv, xlsx, pdf] }
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/PageSizeParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - in: query
 *         name: bucket
 *         schema: { type: string, enum: [expired, expiring30, expiring90, normal] }
 *         description: กรองตามช่วงระยะประกัน — หมดแล้ว / ใกล้หมดใน 30 วัน / ใกล้หมดใน 90 วัน / ปกติ
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
 *     responses:
 *       200:
 *         description: รายงาน (JSON แบบแบ่งหน้าถ้าไม่ส่ง format หรือไฟล์ CSV/Excel/PDF ถ้าส่ง format มา)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items: { type: array, items: { $ref: '#/components/schemas/WarrantyReportRow' } }
 *                     page: { type: integer }
 *                     pageSize: { type: integer }
 *                     totalItems: { type: integer }
 *                     totalPages: { type: integer }
 *           text/csv:
 *             schema: { type: string, format: binary }
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema: { type: string, format: binary }
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */

/**
 * @openapi
 * /api/reports/helpdesk:
 *   get:
 *     tags: [Reports]
 *     summary: รายงานใบแจ้งซ่อม (Helpdesk)
 *     description: >
 *       ADMIN/IT_STAFF เห็นภาพรวมทั้งองค์กร, EMPLOYEE เห็นเฉพาะตั๋วที่ตัวเองแจ้ง
 *       (ใช้ scopeForRead เดียวกับ GET /api/tickets เป๊ะ ๆ) แนบระยะเวลาแก้ไข (ชั่วโมง) มาด้วย
 *     parameters:
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [csv, xlsx, pdf] }
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/PageSizeParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *         description: กรองตามวันที่แจ้ง (openedAt)
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
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
 *         name: ticketStatus
 *         schema: { $ref: '#/components/schemas/TicketStatus' }
 *       - in: query
 *         name: ticketCategory
 *         schema: { $ref: '#/components/schemas/TicketCategory' }
 *       - in: query
 *         name: priority
 *         schema: { $ref: '#/components/schemas/TicketPriority' }
 *     responses:
 *       200:
 *         description: รายงาน (JSON แบบแบ่งหน้าถ้าไม่ส่ง format หรือไฟล์ CSV/Excel/PDF ถ้าส่ง format มา)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items: { type: array, items: { $ref: '#/components/schemas/HelpdeskReportRow' } }
 *                     page: { type: integer }
 *                     pageSize: { type: integer }
 *                     totalItems: { type: integer }
 *                     totalPages: { type: integer }
 *           text/csv:
 *             schema: { type: string, format: binary }
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema: { type: string, format: binary }
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */

/**
 * @openapi
 * /api/reports/departments:
 *   get:
 *     tags: [Reports]
 *     summary: สรุปตามแผนก (Department Summary)
 *     description: >
 *       เฉพาะ ADMIN, IT_STAFF — เป็นภาพรวมทั้งองค์กรล้วน ๆ ไม่มีขอบเขต "ของตัวเอง" ที่มีความหมาย
 *       จึงปิดไม่ให้ EMPLOYEE เข้าได้เลย (403) ไม่รองรับแบ่งหน้า (คืนทุกแผนกในคำตอบเดียว)
 *     parameters:
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [csv, xlsx, pdf] }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *         description: กรองครุภัณฑ์ตามวันที่ซื้อ (purchaseDate)
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: departmentId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: locationId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: vendorId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: สรุปตามแผนก (JSON ทุกแผนกในคำตอบเดียว หรือไฟล์ CSV/Excel/PDF ถ้าส่ง format มา)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items: { type: array, items: { $ref: '#/components/schemas/DepartmentSummaryRow' } }
 *           text/csv:
 *             schema: { type: string, format: binary }
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema: { type: string, format: binary }
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: EMPLOYEE ไม่มีสิทธิ์ดูรายงานภาพรวมองค์กรนี้
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */

/**
 * @openapi
 * /api/reports/vendors:
 *   get:
 *     tags: [Reports]
 *     summary: สรุปตามผู้ขาย/ผู้ผลิต (Vendor Summary)
 *     description: >
 *       เฉพาะ ADMIN, IT_STAFF — เป็นภาพรวมทั้งองค์กรล้วน ๆ เช่นเดียวกับ Department Summary (403 สำหรับ EMPLOYEE)
 *       ไม่รองรับแบ่งหน้า (คืนทุกผู้ขาย/ผู้ผลิตในคำตอบเดียว)
 *     parameters:
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [csv, xlsx, pdf] }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *         description: กรองครุภัณฑ์ตามวันที่ซื้อ (purchaseDate)
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: vendorId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: locationId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: departmentId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: สรุปตามผู้ขาย/ผู้ผลิต (JSON ทุกรายในคำตอบเดียว หรือไฟล์ CSV/Excel/PDF ถ้าส่ง format มา)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items: { type: array, items: { $ref: '#/components/schemas/VendorSummaryRow' } }
 *           text/csv:
 *             schema: { type: string, format: binary }
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema: { type: string, format: binary }
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: EMPLOYEE ไม่มีสิทธิ์ดูรายงานภาพรวมองค์กรนี้
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */

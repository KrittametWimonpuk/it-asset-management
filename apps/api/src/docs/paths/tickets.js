// ---------------------------------------------------------------------------
// เอกสาร OpenAPI: /api/tickets (src/routes/tickets.js) — ไฟล์นี้เป็น comment ล้วน ๆ ไม่แตะ business logic
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /api/tickets:
 *   get:
 *     tags: [Tickets]
 *     summary: รายการใบแจ้งซ่อม/ปัญหาครุภัณฑ์
 *     description: >
 *       ทุก role เข้าได้ แต่ EMPLOYEE เห็นเฉพาะตั๋วที่ตัวเองเป็นผู้แจ้ง — ADMIN/IT_STAFF เห็นทุกตั๋ว
 *       Workflow: OPEN → IN_PROGRESS → RESOLVED → CLOSED (IN_PROGRESS ↔ ON_HOLD พักงานได้)
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/PageSizeParam'
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [ticketNumber, openedAt, resolvedAt, closedAt, priority, status, createdAt], default: openedAt }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - $ref: '#/components/parameters/SearchParam'
 *         description: ค้นหาใน ticketNumber, title, assetTag, name, hostname, ชื่อผู้แจ้ง, ชื่อผู้ดูแล
 *       - in: query
 *         name: priority
 *         schema: { $ref: '#/components/schemas/TicketPriority' }
 *       - in: query
 *         name: status
 *         schema: { $ref: '#/components/schemas/TicketStatus' }
 *       - in: query
 *         name: category
 *         schema: { $ref: '#/components/schemas/TicketCategory' }
 *       - in: query
 *         name: assetId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: assignedToId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: reportedById
 *         schema: { type: string, format: uuid }
 *         description: กรองตามผู้แจ้ง — ใช้ได้เฉพาะ ADMIN/IT_STAFF
 *     responses:
 *       200:
 *         description: รายการใบแจ้งซ่อม
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items: { type: array, items: { $ref: '#/components/schemas/Ticket' } }
 *                     page: { type: integer }
 *                     pageSize: { type: integer }
 *                     totalItems: { type: integer }
 *                     totalPages: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   post:
 *     tags: [Tickets]
 *     summary: แจ้งปัญหา/ขอความช่วยเหลือใหม่
 *     description: >
 *       ทุก role แจ้งได้ (รวม EMPLOYEE) — ผู้แจ้งถูกกำหนดจาก JWT เสมอ (ไม่รับจาก client กันแอบอ้าง)
 *       EMPLOYEE แจ้งได้เฉพาะครุภัณฑ์ที่ตัวเองถือครองอยู่ในปัจจุบันเท่านั้น
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TicketCreateRequest' }
 *     responses:
 *       201:
 *         description: แจ้งปัญหาสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { success: { type: boolean, example: true }, data: { $ref: '#/components/schemas/Ticket' } }
 *       400:
 *         description: ข้อมูลไม่ผ่าน validation หรือครุภัณฑ์ไม่ถูกต้อง/ถูกลบไปแล้ว
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: EMPLOYEE พยายามแจ้งปัญหาของครุภัณฑ์ที่ตัวเองไม่ได้ถือครองอยู่
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */

/**
 * @openapi
 * /api/tickets/{id}:
 *   get:
 *     tags: [Tickets]
 *     summary: ดูใบแจ้งซ่อมชิ้นเดียว
 *     description: ขอบเขตเดียวกับ GET /api/tickets — EMPLOYEE ดูได้เฉพาะของตัวเอง
 *     parameters:
 *       - $ref: '#/components/parameters/TicketId'
 *     responses:
 *       200:
 *         description: รายละเอียดใบแจ้งซ่อม
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { success: { type: boolean, example: true }, data: { $ref: '#/components/schemas/Ticket' } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: ไม่พบใบแจ้งซ่อมนี้ หรือไม่มีสิทธิ์เข้าถึง
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *   put:
 *     tags: [Tickets]
 *     summary: แก้ไขรายละเอียด/มอบหมายผู้ดูแลตั๋ว
 *     description: >
 *       เฉพาะ ADMIN, IT_STAFF — แก้ได้เฉพาะตอนสถานะยัง OPEN/IN_PROGRESS/ON_HOLD เท่านั้น
 *       (RESOLVED/CLOSED แก้ไม่ได้อีก) assignedToId ต้องเป็นผู้ใช้ role ADMIN/IT_STAFF เท่านั้น
 *       มอบหมายผู้ดูแลครั้งแรกขณะตั๋วยัง OPEN จะขยับสถานะเป็น IN_PROGRESS ให้อัตโนมัติ
 *     parameters:
 *       - $ref: '#/components/parameters/TicketId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TicketUpdateRequest' }
 *     responses:
 *       200:
 *         description: แก้ไขสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { success: { type: boolean, example: true }, data: { $ref: '#/components/schemas/Ticket' } }
 *       400:
 *         description: ข้อมูลไม่ผ่าน validation, ตั๋วถูกแก้ไข/ปิดงานไปแล้ว, ผู้ดูแลที่เลือกไม่ถูกต้อง, หรือเปลี่ยนสถานะไม่ถูกต้องตาม workflow
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */

/**
 * @openapi
 * /api/tickets/{id}/resolve:
 *   post:
 *     tags: [Tickets]
 *     summary: บันทึกว่าแก้ไขปัญหาสำเร็จ
 *     description: เฉพาะ ADMIN, IT_STAFF — ใช้ได้เฉพาะตั๋วที่สถานะ IN_PROGRESS เท่านั้น บังคับกรอกสรุปวิธีแก้ไข
 *     parameters:
 *       - $ref: '#/components/parameters/TicketId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TicketResolveRequest' }
 *     responses:
 *       200:
 *         description: บันทึกสำเร็จ (สถานะเปลี่ยนเป็น RESOLVED)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { success: { type: boolean, example: true }, data: { $ref: '#/components/schemas/Ticket' } }
 *       400:
 *         description: ข้อมูลไม่ผ่าน validation หรือตั๋วไม่ได้อยู่ในสถานะ IN_PROGRESS
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */

/**
 * @openapi
 * /api/tickets/{id}/close:
 *   post:
 *     tags: [Tickets]
 *     summary: ปิดงานใบแจ้งซ่อม
 *     description: เฉพาะ ADMIN, IT_STAFF — ใช้ได้เฉพาะตั๋วที่สถานะ RESOLVED เท่านั้น
 *     parameters:
 *       - $ref: '#/components/parameters/TicketId'
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TicketCloseRequest' }
 *     responses:
 *       200:
 *         description: ปิดงานสำเร็จ (สถานะเปลี่ยนเป็น CLOSED)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { success: { type: boolean, example: true }, data: { $ref: '#/components/schemas/Ticket' } }
 *       400:
 *         description: ข้อมูลไม่ผ่าน validation หรือตั๋วไม่ได้อยู่ในสถานะ RESOLVED
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */

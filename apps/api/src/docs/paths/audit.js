// ---------------------------------------------------------------------------
// เอกสาร OpenAPI: /api/audit (src/routes/audit.js) — ไฟล์นี้เป็น comment ล้วน ๆ ไม่แตะ business logic
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /api/audit:
 *   get:
 *     tags: [Audit Log]
 *     summary: รายการ audit log (ประวัติการทำรายการทั้งระบบ)
 *     description: >
 *       เฉพาะ ADMIN, IT_STAFF (EMPLOYEE เข้าไม่ได้เลย — 403) อ่านอย่างเดียว ไม่มี endpoint สร้าง/แก้ไข/ลบ
 *       เรียงตามเวลาล่าสุดก่อนเสมอ (performedAt desc) ไม่รองรับ sortBy/sortOrder แบบหน้าอื่น
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/PageSizeParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *         description: ค้นหาใน description และ entityId (ไม่สนตัวพิมพ์เล็ก/ใหญ่)
 *       - in: query
 *         name: action
 *         schema: { $ref: '#/components/schemas/AuditAction' }
 *       - in: query
 *         name: entityType
 *         schema: { $ref: '#/components/schemas/AuditEntityType' }
 *       - in: query
 *         name: performedBy
 *         schema: { type: string, format: uuid }
 *         description: กรองตามผู้ทำรายการ (User ID)
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *         description: กรองตามเวลาที่ทำรายการ (performedAt) ตั้งแต่วันนี้เป็นต้นไป
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: รายการ audit log
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items: { type: array, items: { $ref: '#/components/schemas/AuditLog' } }
 *                     page: { type: integer }
 *                     pageSize: { type: integer }
 *                     totalItems: { type: integer }
 *                     totalPages: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: EMPLOYEE ไม่มีสิทธิ์เข้าถึง audit log
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */

/**
 * @openapi
 * /api/audit/{id}:
 *   get:
 *     tags: [Audit Log]
 *     summary: ดู audit log รายการเดียว
 *     description: เฉพาะ ADMIN, IT_STAFF — แนบ oldValues/newValues แบบเต็มไว้ดูรายละเอียดการเปลี่ยนแปลง
 *     parameters:
 *       - $ref: '#/components/parameters/AuditLogId'
 *     responses:
 *       200:
 *         description: รายละเอียด audit log
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/AuditLog' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: EMPLOYEE ไม่มีสิทธิ์เข้าถึง audit log
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 *       404:
 *         description: ไม่พบ audit log รายการนี้
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
 */

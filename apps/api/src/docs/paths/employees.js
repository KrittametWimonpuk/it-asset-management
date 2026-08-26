/**
 * @openapi
 * /api/employees:
 *   get:
 *     tags: [Employees]
 *     summary: รายชื่อพนักงาน
 *     description: ADMIN/IT_STAFF เท่านั้น ค้นหาได้ด้วยรหัสพนักงาน ชื่อเต็ม อีเมล หรือโทรศัพท์
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/PageSizeParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - name: sortBy
 *         in: query
 *         schema: { type: string, enum: [employeeCode, firstName, lastName, fullName, email, phone, position, status, hireDate, isActive, createdAt, updatedAt] }
 *       - name: sortOrder
 *         in: query
 *         schema: { type: string, enum: [asc, desc] }
 *       - name: status
 *         in: query
 *         schema: { $ref: '#/components/schemas/EmployeeStatus' }
 *       - name: departmentId
 *         in: query
 *         schema: { type: string, format: uuid }
 *       - name: isActive
 *         in: query
 *         schema: { type: boolean }
 *       - name: scope
 *         in: query
 *         description: active = ยังไม่ archive (ค่าเริ่มต้น), archived = เฉพาะที่ archive, all = ทั้งหมด
 *         schema: { type: string, enum: [active, archived, all], default: active }
 *     responses:
 *       '200':
 *         description: สำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Pagination'
 *                     - type: object
 *                       properties:
 *                         items: { type: array, items: { $ref: '#/components/schemas/Employee' } }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *   post:
 *     tags: [Employees]
 *     summary: เพิ่มพนักงาน
 *     description: ADMIN/IT_STAFF เท่านั้น รหัสพนักงานห้ามซ้ำ
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/EmployeeCreateRequest' }
 *     responses:
 *       '201':
 *         description: สร้างสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Employee' }
 *       '400': { description: Validation หรือแผนกไม่ถูกต้อง }
 *       '409': { description: รหัสพนักงานซ้ำ }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *
 * /api/employees/{id}:
 *   get:
 *     tags: [Employees]
 *     summary: รายละเอียดพนักงาน
 *     parameters: [{ $ref: '#/components/parameters/EmployeeId' }]
 *     responses:
 *       '200':
 *         description: สำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Employee' }
 *       '404': { description: ไม่พบพนักงาน }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *   put:
 *     tags: [Employees]
 *     summary: แก้ไขพนักงาน
 *     description: ADMIN/IT_STAFF เท่านั้น แก้พนักงานที่ archive แล้วไม่ได้
 *     parameters: [{ $ref: '#/components/parameters/EmployeeId' }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/EmployeeUpdateRequest' }
 *     responses:
 *       '200': { description: แก้ไขสำเร็จ }
 *       '400': { description: Validation หรือแผนกไม่ถูกต้อง }
 *       '404': { description: ไม่พบพนักงาน }
 *       '409': { description: รหัสพนักงานซ้ำ }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *   delete:
 *     tags: [Employees]
 *     summary: Archive พนักงาน (soft delete)
 *     description: ADMIN เท่านั้น ตั้ง deletedAt โดยไม่ลบข้อมูลจริง
 *     parameters: [{ $ref: '#/components/parameters/EmployeeId' }]
 *     responses:
 *       '200': { description: Archive สำเร็จ }
 *       '404': { description: ไม่พบพนักงาน }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *
 * /api/employees/{id}/restore:
 *   post:
 *     tags: [Employees]
 *     summary: กู้คืนพนักงานจาก Archive
 *     description: ADMIN เท่านั้น ล้าง deletedAt; รหัสพนักงานเดิมยังถูกสงวนไว้ตลอด
 *     parameters: [{ $ref: '#/components/parameters/EmployeeId' }]
 *     responses:
 *       '200':
 *         description: กู้คืนสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Employee' }
 *       '404': { description: ไม่พบพนักงานที่ archive }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 */


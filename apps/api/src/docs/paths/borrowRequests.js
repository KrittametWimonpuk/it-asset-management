/**
 * @openapi
 * /api/borrow-requests:
 *   get:
 *     tags: [Borrow Requests]
 *     summary: รายการคำขอยืม
 *     description: EMPLOYEE เห็นเฉพาะของตัวเอง; ADMIN/IT_STAFF เห็นทั้งหมด
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/PageSizeParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - in: query
 *         name: status
 *         schema: { $ref: '#/components/schemas/BorrowRequestStatus' }
 *     responses:
 *       '200': { description: สำเร็จ }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     tags: [Borrow Requests]
 *     summary: ส่งคำขอยืม
 *     description: EMPLOYEE เท่านั้น ต้องเชื่อมกับ Employee สถานะ ACTIVE และครุภัณฑ์ต้องไม่มี active assignment
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/BorrowRequestCreateRequest' }
 *     responses:
 *       '201': { description: สร้างคำขอ PENDING สำเร็จ }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *       '409': { description: ครุภัณฑ์มีผู้ถือครองแล้ว }
 *
 * /api/borrow-requests/options/assets:
 *   get:
 *     tags: [Borrow Requests]
 *     summary: ตัวเลือกครุภัณฑ์ว่างสำหรับแบบฟอร์ม
 *     description: EMPLOYEE เท่านั้น คืนเฉพาะครุภัณฑ์ที่ไม่มี active assignment โดยไม่เปลี่ยน data scope ของ GET /api/assets
 *     parameters:
 *       - $ref: '#/components/parameters/SearchParam'
 *     responses:
 *       '200': { description: รายการตัวเลือกสูงสุด 100 รายการ }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *
 * /api/borrow-requests/{id}:
 *   get:
 *     tags: [Borrow Requests]
 *     summary: รายละเอียดคำขอยืม
 *     parameters: [{ $ref: '#/components/parameters/BorrowRequestId' }]
 *     responses:
 *       '200': { description: สำเร็จ }
 *       '404': { description: ไม่พบหรือไม่มีสิทธิ์ }
 *
 * /api/borrow-requests/{id}/approve:
 *   post:
 *     tags: [Borrow Requests]
 *     summary: อนุมัติและสร้าง Assignment อัตโนมัติ
 *     description: ADMIN/IT_STAFF เท่านั้น ทำงานใน Serializable transaction และจบคำขอเป็น COMPLETED
 *     parameters: [{ $ref: '#/components/parameters/BorrowRequestId' }]
 *     responses:
 *       '200': { description: อนุมัติและสร้าง Assignment สำเร็จ }
 *       '409': { description: พนักงานไม่ ACTIVE หรือครุภัณฑ์ถูกมอบหมายแล้ว }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *
 * /api/borrow-requests/{id}/reject:
 *   post:
 *     tags: [Borrow Requests]
 *     summary: ปฏิเสธคำขอยืม
 *     description: ADMIN/IT_STAFF เท่านั้น และใช้ได้เฉพาะ PENDING
 *     parameters: [{ $ref: '#/components/parameters/BorrowRequestId' }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/BorrowRequestRejectRequest' }
 *     responses:
 *       '200': { description: ปฏิเสธสำเร็จ }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *
 * /api/borrow-requests/{id}/cancel:
 *   post:
 *     tags: [Borrow Requests]
 *     summary: ยกเลิกคำขอของตัวเอง
 *     description: EMPLOYEE ยกเลิกได้เฉพาะคำขอ PENDING ของตัวเอง
 *     parameters: [{ $ref: '#/components/parameters/BorrowRequestId' }]
 *     responses:
 *       '200': { description: ยกเลิกสำเร็จ }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *       '404': { description: ไม่พบคำขอที่ยกเลิกได้ }
 *
 * /api/reports/borrow-requests:
 *   get:
 *     tags: [Reports]
 *     summary: รายงานคำขอยืม
 *     description: รองรับ Preview และ format=csv|xlsx|pdf; EMPLOYEE เห็นเฉพาะของตัวเอง
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/PageSizeParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - in: query
 *         name: borrowRequestStatus
 *         schema: { $ref: '#/components/schemas/BorrowRequestStatus' }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [csv, xlsx, pdf] }
 *     responses:
 *       '200': { description: รายงาน JSON หรือไฟล์ส่งออก }
 */

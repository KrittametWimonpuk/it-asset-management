// ---------------------------------------------------------------------------
// เอกสาร OpenAPI: /api/dashboard (src/routes/dashboard.js) — ไฟล์นี้เป็น comment ล้วน ๆ ไม่แตะ business logic
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /api/dashboard:
 *   get:
 *     tags: [Dashboard]
 *     summary: ข้อมูลรวมสำหรับหน้าแดชบอร์ด
 *     description: >
 *       ทุก role ที่ล็อกอินแล้วเข้าถึงได้ แต่เนื้อหาต่างกันตาม role:
 *       ADMIN/IT_STAFF ได้ภาพรวมทั้งองค์กร (สถิติ/กราฟ/กิจกรรมล่าสุดของทุกคน) ส่วน EMPLOYEE ได้เฉพาะ
 *       ครุภัณฑ์ที่ตัวเองถือครองและตั๋วที่ตัวเองแจ้ง (ฟิลด์ภาพรวมองค์กรเป็น null หรือ array ว่าง)
 *       ทุก query รวมเป็นคำสั่งเดียวต่อครั้งด้วย Promise.all ไม่มีการ query วนลูป
 *     responses:
 *       200:
 *         description: ข้อมูลแดชบอร์ด (โครงสร้างเดียวกันทั้งสอง role แต่บางฟิลด์เป็น null/ว่างสำหรับ EMPLOYEE)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/DashboardResponse' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */

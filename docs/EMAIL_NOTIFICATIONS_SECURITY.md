# Email Notifications — Security Model

ขอบเขตนี้เพิ่ม delivery channel เท่านั้น ไม่เปลี่ยน Authentication/RBAC หรือ business workflow เดิม

## Trust boundaries

```text
Browser (untrusted input)
  → Authenticated Settings API
  → PostgreSQL (preferences, hashed verification token, email outbox)
  → Scheduler worker
  → Resend HTTPS API
  → Recipient mailbox
```

ข้อมูลที่จัดเป็นความลับ: `RESEND_API_KEY`, verification token และเนื้อหาการแจ้งเตือนเฉพาะผู้รับ
อีเมลแจ้งเตือนเป็นข้อมูลส่วนบุคคลแต่แยกจาก Login email โดยตั้งใจ

## STRIDE findings and controls

| Threat | Risk | Control / verification |
|---|---|---|
| ผู้ใช้แก้ Settings ของบัญชีอื่น (Elevation/Disclosure) | High | ไม่มี `userId` ใน request contract; ทุก query ใช้ `req.user.id`; ทดสอบ route ownership/RBAC |
| ขโมยหรือใช้ verification token ซ้ำ (Spoofing) | High | random 256-bit token, เก็บ SHA-256 hash เท่านั้น, อายุ 20 นาที, atomic consume, ผูก user+email และใช้ครั้งเดียว |
| Email/Header/HTML injection (Tampering) | High | Zod email/length/CRLF validation, subject ตัด CR/LF, template escape HTML, action URL รับเฉพาะ HTTP(S) |
| Provider/API key รั่ว (Disclosure) | Critical | secret อยู่ backend deployment secret เท่านั้น, ไม่ใช้ `VITE_*`, ไม่ log key/token/body และ secret scan ก่อน commit |
| ส่งซ้ำจาก retry/concurrency (Repudiation/Abuse) | Medium | unique `dedupeKey`, atomic claim และ Resend idempotency key คงที่ต่อ outbox |
| Provider ล่มทำ workflow ล้ม (Availability) | High | enqueue หลัง business event ผ่าน Notification layer, worker แยก, timeout, backoff, max attempts และ `SKIPPED` mode |
| Spam verification/test email (DoS/Abuse) | Medium | จำกัด 5 ครั้ง/15 นาที/บัญชี (ปรับได้), recipient ต้องเป็นค่าที่บัญชีตนเองบันทึกและ Test ต้อง verified |
| Token รั่วผ่าน Referer (Disclosure) | High | หน้าเว็บกำหนด `referrer=no-referrer`; token ถูกลบจาก URL หลังยืนยันสำเร็จ |

## Security acceptance checks

- Settings API ต้องตอบเฉพาะข้อมูลของ JWT owner และไม่คืน token hash/outbox body
- เปลี่ยน notification email ต้องล้าง `emailVerifiedAt` และปิด Email delivery
- token หมดอายุ/ใช้แล้ว/ของบัญชีอื่นต้องถูกปฏิเสธ
- ปิด `EMAIL_ENABLED` หรือไม่มี provider secret ต้องไม่กระทบ In-app/workflow
- source และ Git diff ต้องไม่มี API key, JWT, password หรือ plaintext verification token
- Provider call ต้องมี timeout, HTTPS และ idempotency key

## Operational notes

ตรวจ SPF/DKIM/DMARC และจำกัดสิทธิ์ Resend key ตาม environment แยก development/production หมุน key ทันที
เมื่อสงสัยว่ารั่ว การตรวจ outbox ล้มเหลวให้ดูเฉพาะ status/attempts/lastError และหลีกเลี่ยงการคัดลอก
recipient/body ลง issue tracker หรือ log

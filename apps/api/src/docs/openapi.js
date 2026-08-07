// ---------------------------------------------------------------------------
// Milestone 8.1 — OpenAPI / Swagger Documentation
//
// ไฟล์นี้เป็นเอกสารล้วน ๆ ไม่แตะ business logic ใด ๆ ทั้งสิ้น — รวม config หลักของ swagger-jsdoc
// (info, servers, security scheme, component schemas ที่ใช้ซ้ำได้ทุกที่) แล้วสแกนหา JSDoc block
// แบบ @openapi จากไฟล์ใน src/docs/paths/*.js (ไม่ใช่จาก route files ตรง ๆ) — ตั้งใจแยกเอกสารออกจาก
// โค้ดจริงโดยสิ้นเชิง เพื่อไม่ให้ route files ถูกแตะแม้แต่บรรทัดเดียว (milestone นี้คือ "ห้ามแก้ business
// logic" อย่างเข้มงวด) เอกสารชุดนี้อ่าน route/validation/response จริงจากซอร์สโค้ดที่มีอยู่แล้วเท่านั้น
// ไม่มี endpoint ไหนถูก "เดา" หรือคิดขึ้นเอง
// ---------------------------------------------------------------------------
import path from 'path'
import { fileURLToPath } from 'url'
import swaggerJsdoc from 'swagger-jsdoc'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---- ตัวอย่างข้อมูลจริงจาก prisma/seed.js — ใช้ในตัวอย่าง request/response ทั่วทั้งเอกสาร ----
// (Asset Tag IT-0001 / Dell Latitude 5440, ตั๋ว HD-000001, ผู้ใช้ Admin User ฯลฯ ตรงกับที่ seed ไว้จริง)

const errorResponse = {
  ErrorResponse: {
    type: 'object',
    description: 'รูปแบบ error มาตรฐานของทุก endpoint (utils/response.js: fail())',
    properties: {
      success: { type: 'boolean', example: false },
      message: { type: 'string', example: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบฟอร์ม' },
      errors: {
        type: 'array',
        nullable: true,
        description: 'รายการ error ต่อฟิลด์ — มีเฉพาะตอน validation ไม่ผ่าน ไม่งั้นเป็น null',
        items: { $ref: '#/components/schemas/ValidationError' },
      },
    },
    required: ['success', 'message'],
  },
  ValidationError: {
    type: 'object',
    description: 'error ของฟิลด์เดียว — ใช้โชว์ error รายฟิลด์ในฟอร์มฝั่ง frontend',
    properties: {
      field: { type: 'string', example: 'assetTag' },
      message: { type: 'string', example: 'กรุณาใส่เลขทะเบียนครุภัณฑ์ (Asset Tag)' },
    },
  },
  Pagination: {
    type: 'object',
    description: 'ข้อมูลแบ่งหน้า — แนบมาคู่กับ items เสมอในทุก list endpoint (utils/queryParams.js: buildPageMeta())',
    properties: {
      page: { type: 'integer', example: 1 },
      pageSize: { type: 'integer', example: 20 },
      totalItems: { type: 'integer', example: 6 },
      totalPages: { type: 'integer', example: 1 },
    },
  },
}

const userSchemas = {
  UserRole: {
    type: 'string',
    enum: ['ADMIN', 'IT_STAFF', 'EMPLOYEE'],
    description: 'ADMIN = สิทธิ์เต็ม, IT_STAFF = จัดการ asset/ticket ได้แต่จัดการผู้ใช้ไม่ได้, EMPLOYEE = เห็นเฉพาะของตัวเอง',
  },
  User: {
    type: 'object',
    description: 'ไม่ส่ง password กลับมาเด็ดขาด (routes/users.js: select ระบุฟิลด์ตรง ๆ)',
    properties: {
      id: { type: 'string', format: 'uuid', example: 'e5f768ea-be2a-41a3-a75a-fb83d6bcd43f' },
      email: { type: 'string', format: 'email', example: 'admin@example.com' },
      name: { type: 'string', nullable: true, example: 'Admin User' },
      role: { $ref: '#/components/schemas/UserRole' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  RegisterRequest: {
    type: 'object',
    description: 'ไม่รับ role จาก client โดยเจตนา — สมัครใหม่เป็น EMPLOYEE เสมอ กันการยกระดับสิทธิ์ตัวเอง',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', example: 'newuser@example.com' },
      password: { type: 'string', format: 'password', minLength: 6, example: 'password123' },
      name: { type: 'string', example: 'New Employee' },
    },
  },
  LoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', example: 'admin@example.com' },
      password: { type: 'string', format: 'password', example: 'password123' },
    },
  },
  AuthResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'JWT — ใช้แนบเป็น "Authorization: Bearer <token>" ทุก request ที่ต้องล็อกอิน' },
          user: { $ref: '#/components/schemas/User' },
        },
      },
    },
  },
}

const masterDataSchemas = {
  MasterDataItem: {
    type: 'object',
    description: 'โครงสร้างร่วมของ Category/Location/Department (Vendor มีฟิลด์เพิ่มเติม — ดู Vendor schema)',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string', example: 'Notebook' },
      description: { type: 'string', nullable: true },
      isActive: { type: 'boolean', example: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      deletedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
  Vendor: {
    allOf: [
      { $ref: '#/components/schemas/MasterDataItem' },
      {
        type: 'object',
        properties: {
          contactName: { type: 'string', nullable: true },
          phone: { type: 'string', nullable: true },
          email: { type: 'string', nullable: true },
          website: { type: 'string', nullable: true, example: 'https://www.dell.com' },
          address: { type: 'string', nullable: true },
        },
      },
    ],
  },
  MasterDataCreateRequest: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', example: 'Notebook' },
      description: { type: 'string', nullable: true },
      isActive: { type: 'boolean', default: true },
    },
  },
  VendorCreateRequest: {
    allOf: [
      { $ref: '#/components/schemas/MasterDataCreateRequest' },
      {
        type: 'object',
        properties: {
          contactName: { type: 'string', nullable: true },
          phone: { type: 'string', nullable: true },
          email: { type: 'string', nullable: true },
          website: { type: 'string', nullable: true },
          address: { type: 'string', nullable: true },
        },
      },
    ],
  },
}

const assetSchemas = {
  AssetStatus: { type: 'string', enum: ['AVAILABLE', 'IN_USE', 'REPAIR', 'DISPOSED'] },
  AssetCondition: { type: 'string', enum: ['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'] },
  Asset: {
    type: 'object',
    description: 'แนบ category/location/department/vendor, currentAssignment (ผู้ถือครองปัจจุบัน), และสรุปใบแจ้งซ่อมมาด้วยเสมอ',
    properties: {
      id: { type: 'string', format: 'uuid' },
      assetTag: { type: 'string', example: 'IT-0001' },
      name: { type: 'string', example: 'โน้ตบุ๊ค Dell Latitude 5440' },
      brand: { type: 'string', example: 'Dell' },
      model: { type: 'string', example: 'Latitude 5440' },
      serialNumber: { type: 'string', nullable: true, example: 'SN-DELL-5440-001' },
      status: { $ref: '#/components/schemas/AssetStatus' },
      categoryId: { type: 'string', format: 'uuid' },
      locationId: { type: 'string', format: 'uuid', nullable: true },
      departmentId: { type: 'string', format: 'uuid', nullable: true },
      vendorId: { type: 'string', format: 'uuid', nullable: true },
      category: { $ref: '#/components/schemas/MasterDataItem' },
      location: { allOf: [{ $ref: '#/components/schemas/MasterDataItem' }], nullable: true },
      department: { allOf: [{ $ref: '#/components/schemas/MasterDataItem' }], nullable: true },
      vendor: { allOf: [{ $ref: '#/components/schemas/Vendor' }], nullable: true },
      description: { type: 'string', nullable: true },
      assetCondition: { allOf: [{ $ref: '#/components/schemas/AssetCondition' }], nullable: true },
      purchaseDate: { type: 'string', format: 'date-time', nullable: true },
      purchasePrice: { type: 'number', nullable: true, example: 32900 },
      currency: { type: 'string', nullable: true, example: 'THB' },
      supplierReference: { type: 'string', nullable: true },
      invoiceNumber: { type: 'string', nullable: true },
      warrantyExpiry: { type: 'string', format: 'date-time', nullable: true },
      remark: { type: 'string', nullable: true },
      hostname: { type: 'string', nullable: true, example: 'IT-NB-0001' },
      ipAddress: { type: 'string', nullable: true, example: '192.168.1.101' },
      macAddress: { type: 'string', nullable: true, example: '00:1A:2B:3C:4D:5E' },
      operatingSystem: { type: 'string', nullable: true, example: 'Windows 11 Pro' },
      osVersion: { type: 'string', nullable: true },
      cpu: { type: 'string', nullable: true },
      ram: { type: 'string', nullable: true },
      storage: { type: 'string', nullable: true },
      graphics: { type: 'string', nullable: true },
      monitorSize: { type: 'string', nullable: true },
      domainName: { type: 'string', nullable: true },
      lastSeenAt: { type: 'string', format: 'date-time', nullable: true },
      receivedDate: { type: 'string', format: 'date-time', nullable: true },
      installedDate: { type: 'string', format: 'date-time', nullable: true },
      retiredDate: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      currentAssignment: { allOf: [{ $ref: '#/components/schemas/Assignment' }], nullable: true, description: 'null ถ้ายังไม่มีใครถือครองอยู่' },
      assignmentHistoryCount: { type: 'integer', example: 1 },
      openTicketsCount: { type: 'integer', example: 0 },
      closedTicketsCount: { type: 'integer', example: 1 },
      ticketHistoryCount: { type: 'integer', example: 1 },
      recentTickets: {
        type: 'array',
        description: 'ใบแจ้งซ่อมล่าสุด 5 รายการของ asset นี้ (Recent Maintenance)',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            ticketNumber: { type: 'string', example: 'HD-000001' },
            title: { type: 'string' },
            status: { $ref: '#/components/schemas/TicketStatus' },
            priority: { $ref: '#/components/schemas/TicketPriority' },
            category: { $ref: '#/components/schemas/TicketCategory' },
            openedAt: { type: 'string', format: 'date-time' },
            resolvedAt: { type: 'string', format: 'date-time', nullable: true },
            closedAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
      },
    },
  },
  AssetCreateRequest: {
    type: 'object',
    required: ['assetTag', 'name', 'brand', 'model', 'categoryId'],
    properties: {
      assetTag: { type: 'string', example: 'IT-0007' },
      name: { type: 'string', example: 'โน้ตบุ๊ค Asus VivoBook' },
      brand: { type: 'string', example: 'ASUS' },
      model: { type: 'string', example: 'VivoBook 15' },
      serialNumber: { type: 'string', nullable: true },
      status: { $ref: '#/components/schemas/AssetStatus' },
      categoryId: { type: 'string', format: 'uuid' },
      locationId: { type: 'string', format: 'uuid', nullable: true },
      departmentId: { type: 'string', format: 'uuid', nullable: true },
      vendorId: { type: 'string', format: 'uuid', nullable: true },
      description: { type: 'string', nullable: true },
      assetCondition: { $ref: '#/components/schemas/AssetCondition' },
      purchaseDate: { type: 'string', format: 'date', nullable: true },
      purchasePrice: { type: 'number', nullable: true },
      currency: { type: 'string', nullable: true, example: 'THB' },
      warrantyExpiry: { type: 'string', format: 'date', nullable: true },
      hostname: { type: 'string', nullable: true },
      ipAddress: { type: 'string', nullable: true, description: 'ต้องเป็นรูปแบบ IPv4 ที่ถูกต้อง' },
      macAddress: { type: 'string', nullable: true, description: 'รูปแบบ XX:XX:XX:XX:XX:XX' },
    },
  },
  AssetUpdateRequest: {
    description: 'ทุกฟิลด์ optional — ส่งเฉพาะฟิลด์ที่ต้องการแก้ (partial update)',
    allOf: [{ $ref: '#/components/schemas/AssetCreateRequest' }],
  },
}

const assignmentSchemas = {
  AssignmentStatus: { type: 'string', enum: ['ASSIGNED', 'RETURNED', 'LOST', 'DAMAGED'] },
  Assignment: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      assetId: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      assignedById: { type: 'string', format: 'uuid' },
      assignedAt: { type: 'string', format: 'date-time' },
      expectedReturnDate: { type: 'string', format: 'date-time', nullable: true },
      returnedAt: { type: 'string', format: 'date-time', nullable: true },
      status: { $ref: '#/components/schemas/AssignmentStatus' },
      conditionBefore: { allOf: [{ $ref: '#/components/schemas/AssetCondition' }], nullable: true },
      conditionAfter: { allOf: [{ $ref: '#/components/schemas/AssetCondition' }], nullable: true },
      remark: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      asset: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          assetTag: { type: 'string', example: 'IT-0001' },
          name: { type: 'string', example: 'โน้ตบุ๊ค Dell Latitude 5440' },
          hostname: { type: 'string', nullable: true },
          serialNumber: { type: 'string', nullable: true },
        },
      },
      user: {
        type: 'object',
        description: 'ผู้ถือครอง (พนักงานที่ได้รับมอบหมาย)',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', nullable: true, example: 'Admin User' },
          email: { type: 'string', example: 'admin@example.com' },
        },
      },
      assignedBy: {
        type: 'object',
        description: 'ผู้ทำรายการมอบหมาย (ADMIN/IT_STAFF)',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', nullable: true, example: 'IT Staff' },
          email: { type: 'string', example: 'itstaff@example.com' },
        },
      },
    },
  },
  AssignmentCreateRequest: {
    type: 'object',
    required: ['assetId', 'userId'],
    properties: {
      assetId: { type: 'string', format: 'uuid', description: 'ต้องเป็นครุภัณฑ์ที่ยังไม่มีผู้ถือครองอยู่' },
      userId: { type: 'string', format: 'uuid', description: 'พนักงานที่จะรับมอบหมาย' },
      assignedAt: { type: 'string', format: 'date', description: 'ไม่ส่งมา = ใช้วันที่ปัจจุบัน' },
      expectedReturnDate: { type: 'string', format: 'date', nullable: true },
      conditionBefore: { $ref: '#/components/schemas/AssetCondition' },
      remark: { type: 'string', nullable: true },
    },
  },
  AssignmentUpdateRequest: {
    type: 'object',
    description: 'แก้ได้เฉพาะตอนยัง active (returnedAt ยังเป็น null) — แก้ asset/ผู้ถือครอง/วันที่มอบหมายไม่ได้',
    properties: {
      expectedReturnDate: { type: 'string', format: 'date', nullable: true },
      conditionBefore: { $ref: '#/components/schemas/AssetCondition' },
      remark: { type: 'string', nullable: true },
    },
  },
  AssignmentReturnRequest: {
    type: 'object',
    description: 'ทางเดียวที่จะปิดรายการมอบหมาย (ตั้ง returnedAt) — ผลลัพธ์เป็น RETURNED/LOST/DAMAGED',
    properties: {
      status: { type: 'string', enum: ['RETURNED', 'LOST', 'DAMAGED'], default: 'RETURNED' },
      conditionAfter: { $ref: '#/components/schemas/AssetCondition' },
      returnedAt: { type: 'string', format: 'date', description: 'ไม่ส่งมา = ใช้วันที่ปัจจุบัน' },
      remark: { type: 'string', nullable: true },
    },
  },
}

const ticketSchemas = {
  TicketPriority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
  TicketStatus: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED'] },
  TicketCategory: { type: 'string', enum: ['HARDWARE', 'SOFTWARE', 'NETWORK', 'PRINTER', 'ACCOUNT', 'OTHER'] },
  Ticket: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      ticketNumber: { type: 'string', example: 'HD-000001', description: 'สร้างอัตโนมัติจาก DB sequence — ไม่ซ้ำกันแน่นอน' },
      title: { type: 'string', example: 'จอฟ้า (Blue Screen) ขึ้นบ่อยขณะใช้งาน' },
      description: { type: 'string' },
      assetId: { type: 'string', format: 'uuid' },
      reportedById: { type: 'string', format: 'uuid' },
      assignedToId: { type: 'string', format: 'uuid', nullable: true },
      priority: { $ref: '#/components/schemas/TicketPriority' },
      status: { $ref: '#/components/schemas/TicketStatus' },
      category: { $ref: '#/components/schemas/TicketCategory' },
      resolution: { type: 'string', nullable: true, description: 'มีค่าหลังผ่าน POST /:id/resolve เท่านั้น' },
      openedAt: { type: 'string', format: 'date-time' },
      resolvedAt: { type: 'string', format: 'date-time', nullable: true },
      closedAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      asset: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          assetTag: { type: 'string', example: 'IT-0001' },
          name: { type: 'string', example: 'โน้ตบุ๊ค Dell Latitude 5440' },
          hostname: { type: 'string', nullable: true },
          serialNumber: { type: 'string', nullable: true },
        },
      },
      reportedBy: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', nullable: true, example: 'Admin User' },
          email: { type: 'string', example: 'admin@example.com' },
        },
      },
      assignedTo: {
        type: 'object',
        nullable: true,
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', nullable: true, example: 'IT Staff' },
          email: { type: 'string', example: 'itstaff@example.com' },
        },
      },
    },
  },
  TicketCreateRequest: {
    type: 'object',
    required: ['assetId', 'title', 'description', 'category'],
    properties: {
      assetId: { type: 'string', format: 'uuid', description: 'EMPLOYEE แจ้งได้เฉพาะครุภัณฑ์ที่ตัวเองถือครองอยู่เท่านั้น' },
      title: { type: 'string', example: 'จอฟ้า (Blue Screen) ขึ้นบ่อยขณะใช้งาน' },
      description: { type: 'string', example: 'เครื่องขึ้นจอฟ้าแล้วรีสตาร์ทเองประมาณ 2-3 ครั้งต่อวัน' },
      priority: { allOf: [{ $ref: '#/components/schemas/TicketPriority' }], default: 'MEDIUM' },
      category: { $ref: '#/components/schemas/TicketCategory' },
    },
  },
  TicketUpdateRequest: {
    type: 'object',
    description: 'แก้ได้เฉพาะตอนยัง OPEN/IN_PROGRESS/ON_HOLD — มอบหมายผู้ดูแลครั้งแรกจะขยับสถานะเป็น IN_PROGRESS อัตโนมัติ',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      priority: { $ref: '#/components/schemas/TicketPriority' },
      category: { $ref: '#/components/schemas/TicketCategory' },
      assignedToId: { type: 'string', format: 'uuid', nullable: true, description: 'ต้องเป็นผู้ใช้ role ADMIN หรือ IT_STAFF เท่านั้น' },
      status: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'ON_HOLD'], description: 'เปลี่ยนได้เฉพาะ 3 สถานะนี้ — RESOLVED/CLOSED ต้องผ่าน endpoint เฉพาะ' },
    },
  },
  TicketResolveRequest: {
    type: 'object',
    required: ['resolution'],
    description: 'ใช้ได้เฉพาะตั๋วที่สถานะ IN_PROGRESS เท่านั้น',
    properties: {
      resolution: { type: 'string', example: 'เปลี่ยนสาย HDMI ใหม่และอัปเดตไดรเวอร์การ์ดจอ แก้ปัญหาได้สำเร็จ' },
      resolvedAt: { type: 'string', format: 'date', description: 'ไม่ส่งมา = ใช้วันที่ปัจจุบัน' },
    },
  },
  TicketCloseRequest: {
    type: 'object',
    description: 'ใช้ได้เฉพาะตั๋วที่สถานะ RESOLVED เท่านั้น',
    properties: {
      closedAt: { type: 'string', format: 'date', description: 'ไม่ส่งมา = ใช้วันที่ปัจจุบัน' },
    },
  },
}

// ---- Dashboard (Milestone 6/7) ----
const chartItemSchema = {
  type: 'object',
  properties: { label: { type: 'string' }, value: { type: 'number' } },
}
const dashboardSchemas = {
  ActivityItem: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['ASSIGNMENT', 'RETURN', 'NEW_ASSET'] },
      message: { type: 'string', example: 'มอบหมาย IT-0001 — โน้ตบุ๊ค Dell Latitude 5440 ให้ Admin User' },
      at: { type: 'string', format: 'date-time' },
    },
  },
  RecentTicketItem: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      ticketNumber: { type: 'string', example: 'HD-000001' },
      title: { type: 'string' },
      status: { $ref: '#/components/schemas/TicketStatus' },
      priority: { $ref: '#/components/schemas/TicketPriority' },
      openedAt: { type: 'string', format: 'date-time' },
      asset: { type: 'object', properties: { assetTag: { type: 'string' }, name: { type: 'string' } } },
      reportedBy: { type: 'object', properties: { name: { type: 'string', nullable: true }, email: { type: 'string' } } },
    },
  },
  DashboardResponse: {
    type: 'object',
    description: 'ผลลัพธ์ต่างกันตาม role — ADMIN/IT_STAFF เห็นภาพรวมองค์กร, EMPLOYEE เห็นเฉพาะของตัวเอง (ฟิลด์ org-wide เป็น null/array ว่าง)',
    properties: {
      summary: {
        type: 'object',
        properties: {
          totalAssets: { type: 'integer' },
          assignedAssets: { type: 'integer' },
          availableAssets: { type: 'integer', nullable: true, description: 'null สำหรับ EMPLOYEE' },
          underRepairAssets: { type: 'integer', nullable: true },
          disposedAssets: { type: 'integer', nullable: true },
          expiredWarranty: { type: 'integer' },
          warrantyExpiringSoon: { type: 'integer' },
          totalUsers: { type: 'integer', nullable: true },
          totalCategories: { type: 'integer', nullable: true },
          totalLocations: { type: 'integer', nullable: true },
          totalDepartments: { type: 'integer', nullable: true },
          totalVendors: { type: 'integer', nullable: true },
        },
      },
      assets: {
        type: 'object',
        properties: {
          utilization: {
            nullable: true,
            type: 'object',
            properties: {
              assignedPct: { type: 'number' }, availablePct: { type: 'number' },
              repairPct: { type: 'number' }, disposedPct: { type: 'number' },
            },
          },
        },
      },
      assignments: {
        type: 'object',
        properties: {
          total: { type: 'integer' }, active: { type: 'integer' },
          returned: { type: 'integer' }, lost: { type: 'integer' }, damaged: { type: 'integer' },
        },
      },
      warranty: {
        type: 'object',
        properties: { expired: { type: 'integer' }, expiringSoon: { type: 'integer' }, normal: { type: 'integer' } },
      },
      tickets: {
        type: 'object',
        description: 'สถิติส่วนตัว (ตั๋วของตัวเอง สำหรับ EMPLOYEE) หรือภาพรวมองค์กร (ADMIN/IT_STAFF)',
        properties: {
          open: { type: 'integer' }, inProgress: { type: 'integer' },
          resolvedToday: { type: 'integer' }, closedToday: { type: 'integer' },
        },
      },
      charts: {
        type: 'object',
        description: 'array ว่างทั้งหมดสำหรับ EMPLOYEE (เป็นข้อมูลภาพรวมองค์กรล้วน ๆ)',
        properties: {
          assetsByCategory: { type: 'array', items: chartItemSchema },
          assetsByDepartment: { type: 'array', items: chartItemSchema },
          assetsByLocation: { type: 'array', items: chartItemSchema },
          assetsByStatus: { type: 'array', items: chartItemSchema },
          assignmentsByStatus: { type: 'array', items: chartItemSchema },
          warrantyStatus: { type: 'array', items: chartItemSchema },
          topVendors: { type: 'array', items: chartItemSchema },
          topAssignedCategories: { type: 'array', items: chartItemSchema },
          ticketsByPriority: { type: 'array', items: chartItemSchema },
          ticketsByStatus: { type: 'array', items: chartItemSchema },
          topTicketCategories: { type: 'array', items: chartItemSchema },
        },
      },
      recentActivities: { type: 'array', items: { $ref: '#/components/schemas/ActivityItem' } },
      recentTickets: { type: 'array', items: { $ref: '#/components/schemas/RecentTicketItem' } },
      recentAuditLogs: {
        type: 'array', items: { $ref: '#/components/schemas/AuditLog' },
        description: 'เหตุการณ์ audit log ล่าสุด 10 รายการทั้งระบบ (Milestone 9) — array ว่างสำหรับ EMPLOYEE (ไม่มีสิทธิ์ดู audit log)',
      },
    },
  },
}

// ---- Reports (Milestone 8) — 1 schema ต่อรายงาน เพราะแต่ละรายงานคอลัมน์ไม่เหมือนกัน ----
const reportSchemas = {
  AssetInventoryReportRow: {
    type: 'object',
    properties: {
      assetTag: { type: 'string', example: 'IT-0001' },
      name: { type: 'string', example: 'โน้ตบุ๊ค Dell Latitude 5440' },
      category: { type: 'string', example: 'Notebook' },
      location: { type: 'string', example: 'Head Office' },
      department: { type: 'string', example: 'IT' },
      vendor: { type: 'string', example: 'Dell' },
      status: { type: 'string', example: 'กำลังใช้งาน' },
      currentHolder: { type: 'string', example: 'Admin User' },
      warrantyExpiry: { type: 'string', example: '2026-08-26' },
      purchaseDate: { type: 'string', example: '2025-03-24' },
      purchasePrice: { type: 'number', example: 32900 },
    },
  },
  AssignmentReportRow: {
    type: 'object',
    properties: {
      asset: { type: 'string', example: 'IT-0001 — โน้ตบุ๊ค Dell Latitude 5440' },
      employee: { type: 'string', example: 'Admin User' },
      assignedDate: { type: 'string', example: '2025-04-03' },
      returnedDate: { type: 'string', example: '' },
      status: { type: 'string', example: 'กำลังถือครอง' },
      conditionBefore: { type: 'string', example: 'สภาพดี' },
      conditionAfter: { type: 'string', example: '-' },
      remark: { type: 'string', example: 'มอบให้ทีมพัฒนาใช้งานประจำ' },
    },
  },
  WarrantyReportRow: {
    type: 'object',
    properties: {
      assetTag: { type: 'string', example: 'IT-0001' },
      name: { type: 'string', example: 'โน้ตบุ๊ค Dell Latitude 5440' },
      category: { type: 'string', example: 'Notebook' },
      department: { type: 'string', example: 'IT' },
      vendor: { type: 'string', example: 'Dell' },
      warrantyExpiry: { type: 'string', example: '2026-08-26' },
      daysRemaining: { type: 'integer', example: 20 },
      bucket: { type: 'string', example: 'ใกล้หมดประกัน (30 วัน)' },
    },
  },
  HelpdeskReportRow: {
    type: 'object',
    properties: {
      ticketNumber: { type: 'string', example: 'HD-000001' },
      asset: { type: 'string', example: 'IT-0001 — โน้ตบุ๊ค Dell Latitude 5440' },
      priority: { type: 'string', example: 'สูง' },
      status: { type: 'string', example: 'กำลังดำเนินการ' },
      assignedStaff: { type: 'string', example: 'IT Staff' },
      opened: { type: 'string', example: '2026-08-03' },
      resolved: { type: 'string', example: '' },
      closed: { type: 'string', example: '' },
      resolutionTimeHours: { type: 'number', example: 11.2 },
    },
  },
  DepartmentSummaryRow: {
    type: 'object',
    properties: {
      department: { type: 'string', example: 'IT' },
      assetsCount: { type: 'integer', example: 3 },
      activeAssignmentsCount: { type: 'integer', example: 1 },
      ticketsCount: { type: 'integer', example: 3 },
    },
  },
  VendorSummaryRow: {
    type: 'object',
    properties: {
      vendor: { type: 'string', example: 'Dell' },
      assetsCount: { type: 'integer', example: 1 },
      expiredWarranty: { type: 'integer', example: 0 },
      expiringSoon: { type: 'integer', example: 1 },
      normalWarranty: { type: 'integer', example: 0 },
      ticketsCount: { type: 'integer', example: 1 },
    },
  },
}

// ---- Audit Log (Milestone 9) — record เดียวใช้ทั้ง GET /api/audit, GET /api/audit/:id และ
// DashboardResponse.recentAuditLogs (โครงสร้างเดียวกันทุกจุด) ----
const auditSchemas = {
  AuditAction: {
    type: 'string',
    enum: ['CREATE', 'UPDATE', 'DELETE', 'ASSIGN', 'RETURN', 'OPEN', 'START_PROGRESS', 'ON_HOLD', 'RESOLVE', 'CLOSE', 'LOGIN', 'EXPORT_REPORT'],
  },
  AuditEntityType: {
    type: 'string',
    enum: ['Asset', 'Assignment', 'Ticket', 'Category', 'Department', 'Location', 'Vendor', 'User', 'Report'],
  },
  AuditLog: {
    type: 'object',
    description: 'บันทึกประวัติหนึ่งรายการ — immutable ไม่มี endpoint แก้ไข/ลบ',
    properties: {
      id: { type: 'string', format: 'uuid' },
      action: { $ref: '#/components/schemas/AuditAction' },
      entityType: { $ref: '#/components/schemas/AuditEntityType' },
      entityId: { type: 'string', nullable: true, description: 'id ของ record ที่ถูกกระทำ — ไม่มีค่าสำหรับ action ที่ไม่มี entity เช่น LOGIN' },
      description: { type: 'string', nullable: true, example: 'แก้ไขครุภัณฑ์ IT-0001 — โน้ตบุ๊ค Dell Latitude 5440' },
      oldValues: { type: 'object', nullable: true, description: 'ค่าก่อนแก้ไข (เฉพาะฟิลด์ที่เปลี่ยน) — มีเฉพาะ UPDATE/DELETE', additionalProperties: true },
      newValues: { type: 'object', nullable: true, description: 'ค่าหลังแก้ไข (เฉพาะฟิลด์ที่เปลี่ยน) — มีเฉพาะ CREATE/UPDATE ไม่มี password hash/JWT ปนอยู่แน่นอน', additionalProperties: true },
      performedById: { type: 'string', format: 'uuid', nullable: true },
      performedBy: {
        type: 'object', nullable: true, description: 'join กับ User ตอนอ่าน (ไม่ใช่ field ที่เก็บจริงในตาราง)',
        properties: { id: { type: 'string', format: 'uuid' }, name: { type: 'string', nullable: true }, email: { type: 'string' } },
      },
      performedAt: { type: 'string', format: 'date-time' },
      ipAddress: { type: 'string', nullable: true, example: '127.0.0.1' },
      userAgent: { type: 'string', nullable: true },
    },
  },
}

const definition = {
  openapi: '3.1.0',
  info: {
    title: 'IT Asset Management API',
    version: '0.9.0',
    description:
      'REST API ของระบบจัดการครุภัณฑ์ IT — Asset CRUD, RBAC (ADMIN/IT_STAFF/EMPLOYEE), มอบหมาย/รับคืนครุภัณฑ์, ' +
      'Helpdesk, แดชบอร์ด, รายงาน/ส่งออกข้อมูล, และ Audit Log\n\n' +
      'เอกสารชุดนี้สร้างจาก JSDoc annotation ที่อ่าน route/validation/response จริงจากซอร์สโค้ด ' +
      '(ดู `src/docs/paths/*.js`) — ไม่มี endpoint ไหนถูกเพิ่ม/เดาขึ้นมาเอง\n\n' +
      '**สิทธิ์การใช้งาน (RBAC)** บังคับที่ backend เสมอในทุก endpoint ที่ต้องล็อกอิน ' +
      '(ดูรายละเอียดสิทธิ์เฉพาะของแต่ละ endpoint ในคำอธิบายของ endpoint นั้น ๆ)',
    contact: { name: 'IT Asset Management' },
    license: { name: 'MIT' },
  },
  servers: [
    { url: '/', description: 'ผ่าน Vite dev server proxy (npm run dev) หรือ nginx (production)' },
    { url: 'http://localhost:4000/', description: 'เรียก backend ตรง ๆ (ไม่ผ่าน proxy)' },
  ],
  tags: [
    { name: 'Authentication', description: 'สมัครสมาชิก / เข้าสู่ระบบ / ข้อมูลตัวเอง' },
    { name: 'Users', description: 'รายชื่อผู้ใช้ (ดูอย่างเดียว) — ใช้เลือกพนักงานตอนมอบหมาย/มอบหมายตั๋ว' },
    { name: 'Assets', description: 'ครุภัณฑ์ IT — CRUD เต็มรูปแบบ' },
    { name: 'Assignments', description: 'มอบหมาย/รับคืนครุภัณฑ์ (ประวัติการถือครอง)' },
    { name: 'Dashboard', description: 'ข้อมูลรวมสำหรับแดชบอร์ด (การ์ดสรุป/กราฟ/กิจกรรมล่าสุด)' },
    { name: 'Master Data', description: 'หมวดหมู่ / สถานที่ตั้ง / แผนก / ผู้ขาย-ผู้ผลิต' },
    { name: 'Tickets', description: 'ใบแจ้งซ่อม/ปัญหาครุภัณฑ์ (Helpdesk & Maintenance)' },
    { name: 'Reports', description: 'รายงานและส่งออกข้อมูล (CSV/Excel/PDF)' },
    { name: 'Audit Log', description: 'ประวัติการทำรายการสำคัญทั้งระบบ (อ่านอย่างเดียว — ADMIN/IT_STAFF เท่านั้น)' },
    { name: 'Health', description: 'Health check สำหรับ infrastructure (AWS ALB)' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'ใส่ JWT ที่ได้จาก POST /api/auth/login หรือ POST /api/auth/register — token ฝัง { id, email, role } ' +
          'ไว้ในตัว ตรวจสอบผ่าน middleware requireAuth ทุก endpoint ที่ต้องล็อกอิน',
      },
    },
    schemas: {
      ...errorResponse,
      ...userSchemas,
      ...masterDataSchemas,
      ...assetSchemas,
      ...assignmentSchemas,
      ...ticketSchemas,
      ...dashboardSchemas,
      ...reportSchemas,
      ...auditSchemas,
    },
    parameters: {
      AuditLogId: {
        name: 'id', in: 'path', required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'Audit Log ID (UUID)',
      },
      AssetId: {
        name: 'id', in: 'path', required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'Asset ID (UUID)',
      },
      AssignmentId: {
        name: 'id', in: 'path', required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'Assignment ID (UUID)',
      },
      TicketId: {
        name: 'id', in: 'path', required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'Ticket ID (UUID)',
      },
      MasterDataId: {
        name: 'id', in: 'path', required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'ID ของรายการ master data (UUID)',
      },
      PageParam: { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      PageSizeParam: { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
      SearchParam: { name: 'search', in: 'query', schema: { type: 'string' } },
    },
    responses: {
      Unauthorized: {
        description: 'ไม่ได้แนบ JWT หรือ JWT ไม่ถูกต้อง/หมดอายุ',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      Forbidden: {
        description: 'ล็อกอินแล้วแต่ role ไม่มีสิทธิ์ทำรายการนี้',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: { success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้', errors: null },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
}

// swagger-jsdoc ใช้ glob ภายใน ซึ่งไม่รองรับ backslash ของ Windows path — ต้องแปลงเป็น forward slash เสมอ
const options = {
  definition,
  apis: [path.join(__dirname, 'paths', '*.js').split(path.sep).join('/')],
}

export const swaggerSpec = swaggerJsdoc(options)

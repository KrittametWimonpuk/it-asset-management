import { prisma } from '../db.js'
import { EMPLOYEE_SUMMARY_SELECT } from './assignmentHelpers.js'

export const BORROW_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED']

export const BORROW_REQUEST_RELATIONS = {
  include: {
    employee: { select: EMPLOYEE_SUMMARY_SELECT },
    asset: { select: { id: true, assetTag: true, name: true, status: true, hostname: true } },
    approvedByUser: { select: { id: true, name: true, email: true } },
    approvalHistory: {
      orderBy: { createdAt: 'asc' },
      include: { actorUser: { select: { id: true, name: true, email: true, role: true } } },
    },
  },
}

export async function nextBorrowRequestNumber(client = prisma) {
  const [row] = await client.$queryRaw`SELECT nextval('"BorrowRequest_requestNumber_seq"') AS value`
  return `BR-${String(row.value).padStart(6, '0')}`
}

export function borrowRequestScopeForAccount(user) {
  if (user.role !== 'EMPLOYEE') return {}
  return user.employeeId
    ? { employeeId: user.employeeId }
    : { id: '__unlinked_employee_account__' }
}

export async function activeEmployeeForAccount(user, client = prisma) {
  return client.employee.findFirst({
    where: {
      id: user.employeeId || '__unlinked_employee_account__',
      status: 'ACTIVE', isActive: true, deletedAt: null,
    },
    select: { id: true, employeeCode: true, fullName: true },
  })
}

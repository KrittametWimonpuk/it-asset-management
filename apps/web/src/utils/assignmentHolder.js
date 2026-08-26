export const UNKNOWN_EMPLOYEE = 'Unknown Employee'

export function assignmentHolderName(assignment) {
  return assignment?.employee?.fullName
    || assignment?.user?.name
    || assignment?.user?.email
    || UNKNOWN_EMPLOYEE
}

export function assignmentHolderCode(assignment) {
  return assignment?.employee?.employeeCode || '-'
}

export function assignmentHolderDepartment(assignment) {
  return assignment?.employee?.department?.name || '-'
}

export function assignmentHolderPosition(assignment) {
  return assignment?.employee?.position || '-'
}

/**
 * Helper to deterministically derive fixed seat number from student information.
 * Business Rule:
 * The number at the end of the Student ID is the student's FIXED seat (01 to 50).
 * Examples:
 * - "LSL-01" -> "01"
 * - "LSL-02" -> "02"
 * - "LSL-22" -> "22"
 * - "LSL-25" -> "25"
 * - "LSL-50" -> "50"
 */
export const deriveFixedSeatNumber = (student: {
  studentIdNumber?: string;
  assignedSeatNumber?: string;
}): string | null => {
  // 1. Primary rule: extract trailing digits from studentIdNumber
  if (student.studentIdNumber && typeof student.studentIdNumber === 'string') {
    const trimmed = student.studentIdNumber.trim();
    const match = trimmed.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0) {
        const seatVal = num <= 50 ? num : ((num - 1) % 50) + 1;
        return seatVal < 10 ? `0${seatVal}` : `${seatVal}`;
      }
    }
  }

  // 2. Secondary fallback: check explicitly assigned seat number
  if (student.assignedSeatNumber && typeof student.assignedSeatNumber === 'string') {
    const trimmed = student.assignedSeatNumber.trim();
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num > 0) {
      const seatVal = num <= 50 ? num : ((num - 1) % 50) + 1;
      return seatVal < 10 ? `0${seatVal}` : `${seatVal}`;
    }
  }

  return null;
};

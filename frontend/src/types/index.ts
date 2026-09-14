export type UserRole = 'ADMIN' | 'STUDENT';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  studentIdNumber?: string;
  course?: string;
  avatar?: string;
  status: UserStatus;
  isCurrentlyInside?: boolean;
  currentSeatNumber?: string;
  assignedSeatNumber?: string;
  lastEntryTime?: string;
  lastExitTime?: string;
  createdAt?: string;
}

export interface LibrarySettings {
  _id?: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  openingTime: string;
  closingTime: string;
  totalSeats: number;
  qrExpirySeconds: number;
  updatedAt?: string;
}

export type SeatStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';

export interface Seat {
  _id: string;
  seatNumber: string;
  status: SeatStatus;
  currentStudentId?: any;
  currentStudentName?: string;
  currentAttendanceId?: any;
  notes?: string;
}

export interface Attendance {
  _id: string;
  studentId: any;
  studentName: string;
  studentIdNumber?: string;
  seatId?: any;
  seatNumber?: string;
  entryTime: string;
  exitTime?: string;
  durationMinutes?: number;
  attendanceDate: string;
  entryMethod?: 'QR' | 'MANUAL';
  exitMethod?: 'QR' | 'MANUAL';
  status: 'ACTIVE' | 'COMPLETED';
  createdAt?: string;
}

export type TicketCategory =
  | 'Wi-Fi'
  | 'AC'
  | 'Light'
  | 'Fan'
  | 'Charging Point'
  | 'Chair/Seat'
  | 'Cleanliness'
  | 'Water'
  | 'Other';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface TicketComment {
  _id?: string;
  userName: string;
  userRole: string;
  comment: string;
  createdAt: string;
}

export interface Ticket {
  _id: string;
  ticketNumber: string;
  studentId: any;
  studentName?: string;
  studentIdNumber?: string;
  category: TicketCategory;
  title: string;
  description: string;
  seatNumber?: string;
  status: TicketStatus;
  attachmentUrl?: string;
  comments: TicketComment[];
  resolvedAt?: string;
  resolutionNote?: string;
  createdAt: string;
}

export interface Notice {
  _id: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface QRPayload {
  qrType: 'ENTRY' | 'EXIT';
  token: string;
  expiresAt: number;
  signature: string;
  libraryName?: string;
}

export interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  isRead: boolean;
}

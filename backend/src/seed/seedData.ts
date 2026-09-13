import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../config/db';
import { User } from '../models/User';
import { Library } from '../models/Library';
import { Seat } from '../models/Seat';
import { Attendance } from '../models/Attendance';
import { Ticket } from '../models/Ticket';
import { Notice } from '../models/Notice';

export const seedDatabase = async () => {
  console.log('[Seed] Starting personal library database seeding...');
  await connectDB();

  // Clear existing collections
  await Promise.all([
    User.deleteMany({}),
    Library.deleteMany({}),
    Seat.deleteMany({}),
    Attendance.deleteMany({}),
    Ticket.deleteMany({}),
    Notice.deleteMany({}),
  ]);

  console.log('[Seed] Collections cleared.');

  // 1. Single Library Settings
  const library = await Library.create({
    name: 'Smart Personal Library',
    address: 'Plot 42, Connaught Place, New Delhi',
    phone: '+91 9876543210',
    email: 'admin@smartlibrary.com',
    openingTime: '08:00 AM',
    closingTime: '10:00 PM',
    totalSeats: 50,
    qrExpirySeconds: 45,
  });

  // 2. Single Admin Account
  const admin = await User.create({
    name: 'Library Admin',
    email: 'admin@example.com',
    password: 'Password@123',
    role: 'ADMIN',
    phone: '+91 9876543210',
    status: 'ACTIVE',
  });

  // 3. Exactly 50 Seats: 01 to 50
  const seatDocs = [];
  for (let i = 1; i <= 50; i++) {
    const numStr = i < 10 ? `0${i}` : `${i}`;
    seatDocs.push({
      seatNumber: numStr,
      status: 'AVAILABLE',
    });
  }
  const seats = await Seat.insertMany(seatDocs);

  // 4. Sample Students
  const sampleStudents = [
    { name: 'Rahul Kumar', email: 'student@example.com', idNum: 'ST001', phone: '9876543210', course: 'B.Tech' },
    { name: 'Ananya Roy', email: 'ananya@example.com', idNum: 'ST002', phone: '9876543211', course: 'B.Sc' },
    { name: 'Rohan Verma', email: 'rohan@example.com', idNum: 'ST003', phone: '9876543212', course: 'MBBS' },
    { name: 'Priya Singh', email: 'priya@example.com', idNum: 'ST004', phone: '9876543213', course: 'LLB' },
    { name: 'Amit Patel', email: 'amit@example.com', idNum: 'ST005', phone: '9876543214', course: 'M.Tech' },
    { name: 'Sneha Deshmukh', email: 'sneha@example.com', idNum: 'ST006', phone: '9876543215', course: 'BA' },
    { name: 'Kavita Menon', email: 'kavita@example.com', idNum: 'ST007', phone: '9876543216', course: 'B.Sc' },
    { name: 'Siddharth Rao', email: 'siddharth@example.com', idNum: 'ST008', phone: '9876543217', course: 'B.Com' },
    { name: 'Neha Gupta', email: 'neha@example.com', idNum: 'ST009', phone: '9876543218', course: 'MBA' },
    { name: 'Arjun Das', email: 'arjun@example.com', idNum: 'ST010', phone: '9876543219', course: 'B.Arch' },
  ];

  const studentUsers = [];
  for (const s of sampleStudents) {
    const user = await User.create({
      name: s.name,
      email: s.email,
      password: 'Password@123',
      role: 'STUDENT',
      studentIdNumber: s.idNum,
      phone: s.phone,
      course: s.course,
      status: 'ACTIVE',
      isCurrentlyInside: false,
    });
    studentUsers.push(user);
  }

  // 5. Set 2 Students Currently Inside: Rahul Kumar (Seat 05) and Ananya Roy (Seat 12)
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Rahul Kumar
  const seat05 = seats.find((s) => s.seatNumber === '05')!;
  const rahulEntry = new Date(Date.now() - 135 * 60000); // 2h 15m ago
  const rahulAtt = await Attendance.create({
    studentId: studentUsers[0]._id,
    studentName: studentUsers[0].name,
    studentIdNumber: studentUsers[0].studentIdNumber,
    seatNumber: seat05.seatNumber,
    seatId: seat05._id,
    entryTime: rahulEntry,
    attendanceDate: todayStr,
    entryMethod: 'QR',
    status: 'ACTIVE',
  });
  seat05.status = 'OCCUPIED';
  seat05.currentStudentId = studentUsers[0]._id as any;
  seat05.currentStudentName = studentUsers[0].name;
  seat05.currentAttendanceId = rahulAtt._id as any;
  await seat05.save();

  studentUsers[0].isCurrentlyInside = true;
  studentUsers[0].currentSeatNumber = seat05.seatNumber;
  studentUsers[0].lastEntryTime = rahulEntry;
  await studentUsers[0].save();

  // Ananya Roy
  const seat12 = seats.find((s) => s.seatNumber === '12')!;
  const ananyaEntry = new Date(Date.now() - 75 * 60000); // 1h 15m ago
  const ananyaAtt = await Attendance.create({
    studentId: studentUsers[1]._id,
    studentName: studentUsers[1].name,
    studentIdNumber: studentUsers[1].studentIdNumber,
    seatNumber: seat12.seatNumber,
    seatId: seat12._id,
    entryTime: ananyaEntry,
    attendanceDate: todayStr,
    entryMethod: 'QR',
    status: 'ACTIVE',
  });
  seat12.status = 'OCCUPIED';
  seat12.currentStudentId = studentUsers[1]._id as any;
  seat12.currentStudentName = studentUsers[1].name;
  seat12.currentAttendanceId = ananyaAtt._id as any;
  await seat12.save();

  studentUsers[1].isCurrentlyInside = true;
  studentUsers[1].currentSeatNumber = seat12.seatNumber;
  studentUsers[1].lastEntryTime = ananyaEntry;
  await studentUsers[1].save();

  // 6. Set Seat 18 as MAINTENANCE
  const seat18 = seats.find((s) => s.seatNumber === '18')!;
  seat18.status = 'MAINTENANCE';
  seat18.notes = 'Socket loose; technician coming tomorrow.';
  await seat18.save();

  // 7. Completed Attendance Records for History and Excel
  for (let i = 2; i < studentUsers.length; i++) {
    const student = studentUsers[i];
    const daysAgo = i % 4;
    const entryDate = new Date();
    entryDate.setDate(entryDate.getDate() - daysAgo);
    entryDate.setHours(9 + (i % 3), (i * 12) % 60, 0);

    const durationMins = 120 + (i * 15);
    const exitDate = new Date(entryDate.getTime() + durationMins * 60000);
    const dateStr = entryDate.toISOString().split('T')[0];

    await Attendance.create({
      studentId: student._id,
      studentName: student.name,
      studentIdNumber: student.studentIdNumber,
      seatNumber: `${(i + 15) < 10 ? '0' : ''}${i + 15}`,
      entryTime: entryDate,
      exitTime: exitDate,
      durationMinutes: durationMins,
      attendanceDate: dateStr,
      entryMethod: 'QR',
      exitMethod: 'QR',
      status: 'COMPLETED',
    });
  }

  // 8. Complaints / Tickets
  await Ticket.create([
    {
      ticketNumber: 'LIB-1001',
      studentId: studentUsers[0]._id,
      studentName: studentUsers[0].name,
      studentIdNumber: studentUsers[0].studentIdNumber,
      category: 'AC',
      title: 'AC unit near Seat 05 whistling and warm',
      description: 'The AC split unit is making a whistling noise and cooling is weak.',
      seatNumber: '05',
      status: 'IN_PROGRESS',
      comments: [
        {
          userName: 'Library Admin',
          userRole: 'ADMIN',
          comment: 'Technician notified. Scheduled for maintenance at 3:00 PM.',
          createdAt: new Date(Date.now() - 3600000),
        },
      ],
    },
    {
      ticketNumber: 'LIB-1002',
      studentId: studentUsers[1]._id,
      studentName: studentUsers[1].name,
      studentIdNumber: studentUsers[1].studentIdNumber,
      category: 'Wi-Fi',
      title: 'Wi-Fi disconnecting intermittently',
      description: 'The 5GHz Wi-Fi drops connection every 20 minutes.',
      seatNumber: '12',
      status: 'OPEN',
      comments: [],
    },
    {
      ticketNumber: 'LIB-1003',
      studentId: studentUsers[2]._id,
      studentName: studentUsers[2].name,
      studentIdNumber: studentUsers[2].studentIdNumber,
      category: 'Cleanliness',
      title: 'Water cooler drip tray full',
      description: 'The drinking water station drip tray needs emptying.',
      status: 'RESOLVED',
      resolvedAt: new Date(Date.now() - 7200000),
      resolutionNote: 'Housekeeping team cleared and sanitized the water station.',
      comments: [],
    },
    {
      ticketNumber: 'LIB-1004',
      studentId: studentUsers[3]._id,
      studentName: studentUsers[3].name,
      studentIdNumber: studentUsers[3].studentIdNumber,
      category: 'Charging Point',
      title: 'Plug point loose on Seat 18',
      description: 'Charger does not fit securely in the socket.',
      seatNumber: '18',
      status: 'IN_PROGRESS',
      comments: [],
    },
  ]);

  // 9. Notices
  await Notice.create([
    {
      title: 'Maintain Complete Silence',
      description: 'All members are kindly requested to put mobile phones on silent mode while in the library study hall.',
    },
    {
      title: 'Wi-Fi Scheduled Maintenance',
      description: 'High-speed broadband router will undergo a brief 10-minute firmware update at 02:00 PM today.',
    },
    {
      title: 'Library Open on Sunday',
      description: 'The library will remain open regular hours (08:00 AM - 10:00 PM) this Sunday for exam preparation.',
    },
  ]);

  console.log('[Seed] Database seeded successfully!');
  console.log('----------------------------------------------------');
  console.log('ADMIN:   admin@example.com   / Password@123');
  console.log('STUDENT: student@example.com / Password@123 (ST001 - Rahul Kumar)');
  console.log('----------------------------------------------------');
};

if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('[Seed] Completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Error:', err);
      process.exit(1);
    });
}

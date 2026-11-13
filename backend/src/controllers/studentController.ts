import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Attendance } from '../models/Attendance';
import { Ticket } from '../models/Ticket';
import { Seat } from '../models/Seat';
import { Session } from '../models/Session';
import { StudentPersonalQr } from '../models/StudentPersonalQr';
import { sendSuccess, sendError } from '../utils/response';
import { sendStudentWelcomeEmail } from '../services/emailService';
import { deriveFixedSeatNumber } from '../utils/seatHelper';
import { generateSecureQrToken } from './personalQrController';
import { logAdminAction } from '../services/auditService';

export const getStudents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || '';

    const query: any = { role: 'STUDENT' };
    if (status) query.status = status;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { studentIdNumber: { $regex: search, $options: 'i' } },
        { assignedSeatNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await User.countDocuments(query);
    const students = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Single Source of Truth: Derive isCurrentlyInside & currentSeatNumber from active Attendance
    const studentIds = students.map((s) => s._id);
    const activeAttendances = await Attendance.find({
      studentId: { $in: studentIds },
      status: 'ACTIVE',
    }).lean();

    const activeMap = new Map<string, any>();
    activeAttendances.forEach((att) => {
      activeMap.set(att.studentId.toString(), att);
    });

    const sanitizedStudents = students.map((studentDoc: any) => {
      const activeRecord = activeMap.get(studentDoc._id.toString());
      const realIsInside = !!activeRecord;
      const realSeatNumber = activeRecord ? activeRecord.seatNumber : undefined;

      // Check if User document had drifted from active attendance
      const drifted =
        Boolean(studentDoc.isCurrentlyInside) !== realIsInside ||
        (studentDoc.currentSeatNumber || undefined) !== realSeatNumber;

      if (drifted) {
        User.findByIdAndUpdate(studentDoc._id, {
          $set: {
            isCurrentlyInside: realIsInside,
            currentSeatNumber: realSeatNumber,
          },
        }).catch((err) =>
          console.warn(`[Student Sync] Background sync error for ${studentDoc.name}:`, err?.message)
        );
      }

      studentDoc.isCurrentlyInside = realIsInside;
      studentDoc.currentSeatNumber = realSeatNumber;
      return studentDoc;
    });

    return sendSuccess(res, {
      students: sanitizedStudents,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createStudent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, phone, studentIdNumber, course, assignedSeatNumber } = req.body;
    const adminId = req.user?.id;
    const adminEmail = req.user?.email || 'admin@lakshyalibrary.com';
    const adminName = req.user?.name || 'Library Admin';

    const initialPassword = (password && String(password).trim()) || (phone && String(phone).trim());

    if (!name || !email || !studentIdNumber || !initialPassword) {
      return sendError(res, 'Name, email, Student ID, and registered Mobile Number (as initial Password) are required', 400);
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanStudentId = studentIdNumber.trim();

    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      return sendError(res, 'A student with this email address already exists', 409);
    }

    const totalStudents = await User.countDocuments({ role: 'STUDENT', status: 'ACTIVE' });
    if (totalStudents >= 50) {
      return sendError(
        res,
        'Maximum limit of 50 active students reached for Lakshya Smart Library.',
        400,
        'STUDENT_LIMIT_REACHED'
      );
    }

    const existingStudentId = await User.findOne({ studentIdNumber: cleanStudentId });
    if (existingStudentId) {
      return sendError(res, 'A student with this Student ID already exists', 409);
    }

    let cleanSeat = '';
    if (assignedSeatNumber && String(assignedSeatNumber).trim() !== '') {
      const parsedNum = parseInt(String(assignedSeatNumber).trim(), 10);
      if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 50) {
        cleanSeat = parsedNum < 10 ? `0${parsedNum}` : `${parsedNum}`;

        // Verify target seat is not occupied by another active student
        const seatOccupied = await User.findOne({
          role: 'STUDENT',
          status: 'ACTIVE',
          assignedSeatNumber: cleanSeat,
        });
        if (seatOccupied) {
          return sendError(res, `Seat ${cleanSeat} is already assigned to active student ${seatOccupied.name}`, 409);
        }
      } else {
        return sendError(res, 'Allotted Seat Number must be between 01 and 50', 400);
      }
    } else {
      cleanSeat = deriveFixedSeatNumber({ studentIdNumber: cleanStudentId }) || '';
    }

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password: initialPassword,
      role: 'STUDENT',
      studentIdNumber: cleanStudentId,
      phone: phone?.trim(),
      course: course?.trim(),
      assignedSeatNumber: cleanSeat || undefined,
      status: 'ACTIVE',
    });

    // Send welcome email via Brevo — non-blocking
    const emailResult = await sendStudentWelcomeEmail({
      name: user.name,
      email: user.email,
      studentIdNumber: user.studentIdNumber || cleanStudentId,
      course: user.course,
      assignedSeatNumber: user.assignedSeatNumber || cleanSeat || undefined,
    });

    // Audit log
    await logAdminAction({
      adminId,
      adminEmail,
      adminName,
      action: 'STUDENT_CREATED',
      targetId: user._id,
      targetName: user.name,
      targetType: 'STUDENT',
      details: {
        studentIdNumber: cleanStudentId,
        email: cleanEmail,
        assignedSeatNumber: cleanSeat,
      },
    });

    return sendSuccess(
      res,
      {
        student: user,
        emailSent: emailResult.sent,
        emailMessage: emailResult.message,
      },
      emailResult.sent
        ? 'Student registered successfully. Welcome email sent.'
        : `Student registered successfully. ${emailResult.message}.`,
      201
    );
  } catch (error) {
    next(error);
  }
};

export const getStudentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (req.user?.role === 'STUDENT' && req.user.id !== id) {
      return sendError(res, 'Access denied', 403, 'FORBIDDEN');
    }

    const student = await User.findById(id).select('-password').lean();
    if (!student || student.role !== 'STUDENT') {
      return sendError(res, 'Student not found', 404);
    }

    const recentAttendance = await Attendance.find({ studentId: student._id })
      .sort({ entryTime: -1 })
      .limit(10)
      .lean();

    const recentTickets = await Ticket.find({ studentId: student._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const activeQr = await StudentPersonalQr.findOne({
      studentId: student._id,
      status: 'ACTIVE',
    }).lean();

    return sendSuccess(res, {
      student,
      recentAttendance,
      recentTickets,
      activeQr,
    });
  } catch (error) {
    next(error);
  }
};

export const updateStudent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, phone, course, studentIdNumber, assignedSeatNumber } = req.body;
    const adminId = req.user?.id;
    const adminEmail = req.user?.email || 'admin@lakshyalibrary.com';
    const adminName = req.user?.name || 'Library Admin';

    const existingStudent = await User.findById(id);
    if (!existingStudent || existingStudent.role !== 'STUDENT') {
      return sendError(res, 'Student not found', 404);
    }

    if (studentIdNumber) {
      const cleanStudentId = studentIdNumber.trim();
      const duplicateStudentId = await User.findOne({
        _id: { $ne: id },
        studentIdNumber: cleanStudentId,
      });
      if (duplicateStudentId) {
        return sendError(res, 'A student with this Student ID already exists', 409);
      }
    }

    let cleanSeat: string | undefined = undefined;
    if (assignedSeatNumber !== undefined) {
      if (String(assignedSeatNumber).trim() === '') {
        cleanSeat = '';
      } else {
        const parsedNum = parseInt(String(assignedSeatNumber).trim(), 10);
        if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 50) {
          cleanSeat = parsedNum < 10 ? `0${parsedNum}` : `${parsedNum}`;

          // Check if another active student is already assigned this seat
          const conflict = await User.findOne({
            _id: { $ne: id },
            role: 'STUDENT',
            status: 'ACTIVE',
            assignedSeatNumber: cleanSeat,
          });
          if (conflict) {
            return sendError(res, `Seat ${cleanSeat} is already assigned to active student ${conflict.name}`, 409);
          }
        } else {
          return sendError(res, 'Allotted Seat Number must be between 01 and 50', 400);
        }
      }
    }

    const updateFields: any = {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(phone !== undefined ? { phone: phone.trim() } : {}),
      ...(course !== undefined ? { course: course.trim() } : {}),
      ...(studentIdNumber !== undefined ? { studentIdNumber: studentIdNumber.trim() } : {}),
      ...(cleanSeat !== undefined ? { assignedSeatNumber: cleanSeat } : {}),
    };

    // Synchronize active attendance session if student is currently inside
    const activeSession = await Attendance.findOne({
      studentId: existingStudent._id,
      status: 'ACTIVE',
    });

    if (activeSession) {
      const studentDisplayName = name ? name.trim() : existingStudent.name;

      if (cleanSeat !== undefined && cleanSeat !== '' && cleanSeat !== activeSession.seatNumber) {
        const targetSeat = await Seat.findOne({ seatNumber: cleanSeat });
        if (!targetSeat) {
          return sendError(res, `Seat ${cleanSeat} does not exist in library`, 404);
        }
        if (targetSeat.status === 'MAINTENANCE') {
          return sendError(res, `Seat ${cleanSeat} is currently under maintenance`, 409, 'SEAT_MAINTENANCE');
        }
        if (
          targetSeat.status === 'OCCUPIED' &&
          targetSeat.currentStudentId &&
          String(targetSeat.currentStudentId) !== String(existingStudent._id)
        ) {
          return sendError(
            res,
            `Seat ${cleanSeat} is currently occupied by ${targetSeat.currentStudentName || 'another student'}`,
            409,
            'SEAT_OCCUPIED'
          );
        }

        if (activeSession.seatId) {
          await Seat.findByIdAndUpdate(activeSession.seatId, {
            status: 'AVAILABLE',
            currentStudentId: null,
            currentStudentName: '',
            currentAttendanceId: null,
          });
        }

        targetSeat.status = 'OCCUPIED';
        targetSeat.currentStudentId = existingStudent._id as any;
        targetSeat.currentStudentName = studentDisplayName;
        targetSeat.currentAttendanceId = activeSession._id as any;
        await targetSeat.save();

        activeSession.seatNumber = cleanSeat;
        activeSession.seatId = targetSeat._id as any;
        if (name) activeSession.studentName = studentDisplayName;
        if (studentIdNumber) activeSession.studentIdNumber = studentIdNumber.trim();
        await activeSession.save();

        updateFields.currentSeatNumber = cleanSeat;
      } else {
        let sessionNeedsSave = false;
        if (name && activeSession.studentName !== studentDisplayName) {
          activeSession.studentName = studentDisplayName;
          sessionNeedsSave = true;
          if (activeSession.seatId) {
            await Seat.findByIdAndUpdate(activeSession.seatId, {
              currentStudentName: studentDisplayName,
            });
          }
        }
        if (studentIdNumber && activeSession.studentIdNumber !== studentIdNumber.trim()) {
          activeSession.studentIdNumber = studentIdNumber.trim();
          sessionNeedsSave = true;
        }
        if (sessionNeedsSave) {
          await activeSession.save();
        }
      }
    }

    const student = await User.findByIdAndUpdate(
      id,
      updateFields,
      { new: true }
    ).select('-password');

    // Synchronize StudentPersonalQr: Keep QR valid, update metadata (seat, studentIdNumber, name)
    const qrUpdates: any = {};
    if (name) qrUpdates.studentName = name.trim();
    if (studentIdNumber) qrUpdates.studentIdNumber = studentIdNumber.trim();
    if (cleanSeat !== undefined) qrUpdates.assignedSeatNumber = cleanSeat;

    if (Object.keys(qrUpdates).length > 0) {
      await StudentPersonalQr.updateMany(
        { studentId: existingStudent._id, status: 'ACTIVE' },
        { $set: qrUpdates }
      );
    }

    // Audit log
    await logAdminAction({
      adminId,
      adminEmail,
      adminName,
      action: 'STUDENT_UPDATED',
      targetId: existingStudent._id,
      targetName: existingStudent.name,
      targetType: 'STUDENT',
      details: {
        updatedFields: Object.keys(updateFields),
      },
    });

    return sendSuccess(res, student, 'Student updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Deactivate Student, release seat, revoke personal QR, and close sessions
 * POST /api/students/:id/deactivate
 */
export const deactivateStudent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user?.id;
    const adminEmail = req.user?.email || 'admin@lakshyalibrary.com';
    const adminName = req.user?.name || 'Library Admin';

    const student = await User.findById(id);
    if (!student || student.role !== 'STUDENT') {
      return sendError(res, 'Student account not found', 404);
    }

    if (student.status === 'INACTIVE') {
      return sendSuccess(res, student, 'Student is already inactive');
    }

    const previousAssignedSeat = student.assignedSeatNumber;
    const previousCurrentSeat = student.currentSeatNumber;
    const seatsToRelease = new Set<string>();
    if (previousAssignedSeat) seatsToRelease.add(previousAssignedSeat);
    if (previousCurrentSeat) seatsToRelease.add(previousCurrentSeat);

    // 1. Mark student INACTIVE and clear seats
    student.status = 'INACTIVE';
    student.assignedSeatNumber = undefined;
    student.currentSeatNumber = undefined;
    student.isCurrentlyInside = false;
    await student.save();

    // 2. Release physical seats in Seat collection
    for (const seatNum of seatsToRelease) {
      await Seat.findOneAndUpdate(
        { seatNumber: seatNum },
        {
          $set: {
            status: 'AVAILABLE',
            currentStudentId: null,
            currentStudentName: '',
            currentAttendanceId: null,
          },
        }
      );
    }

    // 3. Revoke all active personal QR codes for this student immediately
    const revokedQrResult = await StudentPersonalQr.updateMany(
      { studentId: student._id, status: 'ACTIVE' },
      {
        $set: {
          status: 'REVOKED',
          revokedAt: new Date(),
          revokedBy: adminId ? new mongoose.Types.ObjectId(String(adminId)) : undefined,
        },
      }
    );

    // 4. Safely close any active attendance session according to library policy
    const activeAttendance = await Attendance.findOne({ studentId: student._id, status: 'ACTIVE' });
    if (activeAttendance) {
      const exitTime = new Date();
      const durationMinutes = Math.max(1, Math.round((exitTime.getTime() - activeAttendance.entryTime.getTime()) / 60000));
      activeAttendance.exitTime = exitTime;
      activeAttendance.durationMinutes = durationMinutes;
      activeAttendance.exitMethod = 'MANUAL';
      activeAttendance.status = 'COMPLETED';
      await activeAttendance.save();
    }

    // 5. Revoke JWT login sessions immediately so student cannot access student portal
    await Session.updateMany({ userId: student._id }, { $set: { isRevoked: true } });

    // 6. Record Audit Log
    await logAdminAction({
      adminId,
      adminEmail,
      adminName,
      action: 'STUDENT_DEACTIVATED',
      targetId: student._id,
      targetName: student.name,
      targetType: 'STUDENT',
      details: {
        reason: reason || 'Not specified',
        releasedSeats: Array.from(seatsToRelease),
        revokedQrsCount: revokedQrResult.modifiedCount,
        closedActiveAttendance: Boolean(activeAttendance),
      },
    });

    return sendSuccess(
      res,
      student,
      `Student ${student.name} deactivated successfully. Seat released and QR revoked.`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Reactivate Student and optionally assign a vacant seat
 * POST /api/students/:id/reactivate
 */
export const reactivateStudent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { assignedSeatNumber } = req.body;
    const adminId = req.user?.id;
    const adminEmail = req.user?.email || 'admin@lakshyalibrary.com';
    const adminName = req.user?.name || 'Library Admin';

    const student = await User.findById(id);
    if (!student || student.role !== 'STUDENT') {
      return sendError(res, 'Student account not found', 404);
    }

    let cleanSeat = '';
    if (assignedSeatNumber && String(assignedSeatNumber).trim() !== '') {
      const parsedNum = parseInt(String(assignedSeatNumber).trim(), 10);
      if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 50) {
        cleanSeat = parsedNum < 10 ? `0${parsedNum}` : `${parsedNum}`;

        const targetSeat = await Seat.findOne({ seatNumber: cleanSeat });
        if (targetSeat && targetSeat.status === 'MAINTENANCE') {
          return sendError(res, `Seat ${cleanSeat} is currently under maintenance`, 409);
        }
        const occupiedStudent = await User.findOne({
          _id: { $ne: student._id },
          role: 'STUDENT',
          status: 'ACTIVE',
          assignedSeatNumber: cleanSeat,
        });
        if (occupiedStudent) {
          return sendError(res, `Seat ${cleanSeat} is already assigned to active student ${occupiedStudent.name}`, 409);
        }
      } else {
        return sendError(res, 'Assigned Seat Number must be between 01 and 50', 400);
      }
    }

    student.status = 'ACTIVE';
    if (cleanSeat) {
      student.assignedSeatNumber = cleanSeat;
    }
    await student.save();

    await logAdminAction({
      adminId,
      adminEmail,
      adminName,
      action: 'STUDENT_REACTIVATED',
      targetId: student._id,
      targetName: student.name,
      targetType: 'STUDENT',
      details: { assignedSeatNumber: cleanSeat || undefined },
    });

    return sendSuccess(res, student, `Student ${student.name} reactivated successfully.`);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Replace Student (Student A departs, Student B replaces on same seat)
 * POST /api/students/:id/replace
 */
export const replaceStudent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { newStudent } = req.body;
    const adminId = req.user?.id;
    const adminEmail = req.user?.email || 'admin@lakshyalibrary.com';
    const adminName = req.user?.name || 'Library Admin';

    if (!newStudent || !newStudent.name || !newStudent.email || !newStudent.studentIdNumber || !newStudent.phone) {
      return sendError(res, 'New student full details (Name, Email, Student ID, Mobile Number) are required', 400);
    }

    const oldStudent = await User.findById(id);
    if (!oldStudent || oldStudent.role !== 'STUDENT') {
      return sendError(res, 'Departing student account not found', 404);
    }

    const seatToTransfer = oldStudent.assignedSeatNumber || oldStudent.currentSeatNumber || '';

    // Validate new student uniqueness
    const cleanEmail = newStudent.email.toLowerCase().trim();
    const cleanStudentId = newStudent.studentIdNumber.trim();

    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      return sendError(res, `A student with email ${cleanEmail} already exists`, 409);
    }

    const existingStudentId = await User.findOne({ studentIdNumber: cleanStudentId });
    if (existingStudentId) {
      return sendError(res, `A student with Student ID ${cleanStudentId} already exists`, 409);
    }

    // 1. Deactivate old Student A (preserves all attendance, payments, refund history)
    oldStudent.status = 'INACTIVE';
    oldStudent.assignedSeatNumber = undefined;
    oldStudent.currentSeatNumber = undefined;
    oldStudent.isCurrentlyInside = false;
    await oldStudent.save();

    // Revoke old Student A's active QR tokens permanently
    await StudentPersonalQr.updateMany(
      { studentId: oldStudent._id, status: 'ACTIVE' },
      {
        $set: {
          status: 'REVOKED',
          revokedAt: new Date(),
          revokedBy: adminId ? new mongoose.Types.ObjectId(String(adminId)) : undefined,
        },
      }
    );

    // Close any active attendance for old Student A
    const activeAttendance = await Attendance.findOne({ studentId: oldStudent._id, status: 'ACTIVE' });
    if (activeAttendance) {
      const exitTime = new Date();
      activeAttendance.exitTime = exitTime;
      activeAttendance.durationMinutes = Math.max(1, Math.round((exitTime.getTime() - activeAttendance.entryTime.getTime()) / 60000));
      activeAttendance.exitMethod = 'MANUAL';
      activeAttendance.status = 'COMPLETED';
      await activeAttendance.save();
    }
    await Session.updateMany({ userId: oldStudent._id }, { $set: { isRevoked: true } });

    // 2. Clear physical seat occupancy
    if (seatToTransfer) {
      await Seat.findOneAndUpdate(
        { seatNumber: seatToTransfer },
        {
          $set: {
            status: 'AVAILABLE',
            currentStudentId: null,
            currentStudentName: '',
            currentAttendanceId: null,
          },
        }
      );
    }

    // 3. Create independent new Student B
    const initialPassword = (newStudent.password && String(newStudent.password).trim()) || newStudent.phone.trim();
    const studentB = await User.create({
      name: newStudent.name.trim(),
      email: cleanEmail,
      password: initialPassword,
      role: 'STUDENT',
      studentIdNumber: cleanStudentId,
      phone: newStudent.phone.trim(),
      course: newStudent.course?.trim(),
      assignedSeatNumber: seatToTransfer || undefined,
      status: 'ACTIVE',
    });

    // 4. Generate fresh, independent personal attendance QR token for Student B
    const newQrToken = generateSecureQrToken();
    const newQr = await StudentPersonalQr.create({
      studentId: studentB._id,
      studentName: studentB.name,
      studentIdNumber: studentB.studentIdNumber || cleanStudentId,
      assignedSeatNumber: seatToTransfer || '',
      qrToken: newQrToken,
      status: 'ACTIVE',
      generationCount: 1,
    });

    // 5. Audit Log
    await logAdminAction({
      adminId,
      adminEmail,
      adminName,
      action: 'STUDENT_REPLACED',
      targetId: studentB._id,
      targetName: studentB.name,
      targetType: 'STUDENT',
      details: {
        departingStudentId: oldStudent._id,
        departingStudentName: oldStudent.name,
        newStudentId: studentB._id,
        newStudentName: studentB.name,
        seatTransferred: seatToTransfer,
        newQrId: newQr._id,
      },
    });

    return sendSuccess(
      res,
      {
        oldStudent: {
          _id: oldStudent._id,
          name: oldStudent.name,
          status: oldStudent.status,
        },
        newStudent: studentB,
        qr: newQr,
      },
      `Student replacement successful. ${oldStudent.name} deactivated and seat ${seatToTransfer || 'none'} assigned to ${studentB.name} with fresh Personal QR.`,
      201
    );
  } catch (error) {
    next(error);
  }
};

export const updateStudentStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.user?.id;
    const adminEmail = req.user?.email || 'admin@lakshyalibrary.com';
    const adminName = req.user?.name || 'Library Admin';

    if (!['ACTIVE', 'INACTIVE', 'BLOCKED'].includes(status)) {
      return sendError(res, 'Invalid status value', 400);
    }

    if (status === 'INACTIVE') {
      return deactivateStudent(req, res, next);
    }

    const student = await User.findById(id);
    if (!student || student.role !== 'STUDENT') {
      return sendError(res, 'Student not found', 404);
    }

    student.status = status;
    await student.save();

    if (status === 'BLOCKED') {
      await Session.updateMany({ userId: student._id }, { $set: { isRevoked: true } });
    }

    await logAdminAction({
      adminId,
      adminEmail,
      adminName,
      action: status === 'ACTIVE' ? 'STUDENT_REACTIVATED' : 'STUDENT_UPDATED',
      targetId: student._id,
      targetName: student.name,
      targetType: 'STUDENT',
      details: { status },
    });

    return sendSuccess(res, student, `Student marked as ${status}`);
  } catch (error) {
    next(error);
  }
};

export const resetStudentPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const adminId = req.user?.id;
    const adminEmail = req.user?.email || 'admin@lakshyalibrary.com';
    const adminName = req.user?.name || 'Library Admin';

    if (!newPassword || newPassword.trim().length < 6) {
      return sendError(res, 'New password is required and must be at least 6 characters', 400);
    }

    const student = await User.findById(id);
    if (!student || student.role !== 'STUDENT') {
      return sendError(res, 'Student not found', 404);
    }

    student.password = newPassword.trim();
    await student.save();

    await Session.updateMany({ userId: student._id }, { $set: { isRevoked: true } });

    await logAdminAction({
      adminId,
      adminEmail,
      adminName,
      action: 'PASSWORD_RESET',
      targetId: student._id,
      targetName: student.name,
      targetType: 'STUDENT',
    });

    return sendSuccess(res, null, 'Student password reset successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteStudent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;
    const adminEmail = req.user?.email || 'admin@lakshyalibrary.com';
    const adminName = req.user?.name || 'Library Admin';

    const student = await User.findById(id);
    if (!student || student.role !== 'STUDENT') {
      return sendError(res, 'Student not found', 404);
    }

    // Release seat
    if (student.currentSeatNumber || student.assignedSeatNumber) {
      const seatToRelease = student.assignedSeatNumber || student.currentSeatNumber;
      await Seat.findOneAndUpdate(
        { seatNumber: seatToRelease },
        {
          status: 'AVAILABLE',
          $unset: { currentStudentId: 1, currentStudentName: 1, currentAttendanceId: 1 },
        }
      );
    }

    // Revoke QRs
    await StudentPersonalQr.updateMany({ studentId: student._id }, { $set: { status: 'REVOKED' } });
    await Session.updateMany({ userId: student._id }, { $set: { isRevoked: true } });

    await User.findByIdAndDelete(id);

    await logAdminAction({
      adminId,
      adminEmail,
      adminName,
      action: 'STUDENT_DEACTIVATED',
      targetId: student._id,
      targetName: student.name,
      targetType: 'STUDENT',
      details: { deleted: true },
    });

    return sendSuccess(res, null, 'Student deleted successfully');
  } catch (error) {
    next(error);
  }
};

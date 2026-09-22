import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { Attendance } from '../models/Attendance';
import { Ticket } from '../models/Ticket';
import { Seat } from '../models/Seat';
import { Session } from '../models/Session';
import { sendSuccess, sendError } from '../utils/response';
import { sendStudentWelcomeEmail } from '../services/emailService';
import { deriveFixedSeatNumber } from '../utils/seatHelper';

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
      ];
    }

    const total = await User.countDocuments(query);
    const students = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Single Source of Truth: Derive isCurrentlyInside & currentSeatNumber from active Attendance
    const studentIds = students.map((s) => s._id);
    const activeAttendances = await Attendance.find({
      studentId: { $in: studentIds },
      status: 'ACTIVE',
    });

    const activeMap = new Map<string, any>();
    activeAttendances.forEach((att) => {
      activeMap.set(att.studentId.toString(), att);
    });

    const sanitizedStudents = students.map((studentDoc) => {
      const sObj = studentDoc.toObject ? studentDoc.toObject() : { ...studentDoc };
      const activeRecord = activeMap.get(studentDoc._id.toString());

      const realIsInside = !!activeRecord;
      const realSeatNumber = activeRecord ? activeRecord.seatNumber : undefined;

      // Check if User document had drifted from active attendance
      const drifted =
        Boolean(studentDoc.isCurrentlyInside) !== realIsInside ||
        (studentDoc.currentSeatNumber || undefined) !== realSeatNumber;

      if (drifted) {
        // Self-healing: Asynchronously sync User document to prevent database rot
        User.findByIdAndUpdate(studentDoc._id, {
          $set: {
            isCurrentlyInside: realIsInside,
            currentSeatNumber: realSeatNumber,
          },
        }).catch((err) =>
          console.warn(`[Student Sync] Background sync error for ${studentDoc.name}:`, err?.message)
        );
      }

      sObj.isCurrentlyInside = realIsInside;
      sObj.currentSeatNumber = realSeatNumber;
      return sObj;
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

    // Initial password is student's registered mobile number (or explicit password if provided)
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

    const totalStudents = await User.countDocuments({ role: 'STUDENT' });
    if (totalStudents >= 50) {
      return sendError(
        res,
        'Maximum limit of 50 students reached for Lakshya Smart Library.',
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
      } else {
        return sendError(res, 'Allotted Seat Number must be between 01 and 50', 400);
      }
    } else {
      // Auto derive from Student ID (e.g. LSL-22 -> 22)
      cleanSeat = deriveFixedSeatNumber({ studentIdNumber: cleanStudentId }) || '';
    }

    // 1. Save student to MongoDB first — bcrypt hash is handled by UserSchema pre('save') hook. Raw password is NEVER stored.
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

    // Send welcome email via Brevo — non-blocking, never rolls back student creation
    const emailResult = await sendStudentWelcomeEmail({
      name: user.name,
      email: user.email,
      studentIdNumber: user.studentIdNumber || cleanStudentId,
      course: user.course,
      assignedSeatNumber: user.assignedSeatNumber || cleanSeat || undefined,
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

    // Cross-user data security: student can ONLY access their own details
    if (req.user?.role === 'STUDENT' && req.user.id !== id) {
      return sendError(res, 'Access denied', 403, 'FORBIDDEN');
    }

    const student = await User.findById(id).select('-password');
    if (!student || student.role !== 'STUDENT') {
      return sendError(res, 'Student not found', 404);
    }

    const recentAttendance = await Attendance.find({ studentId: student._id })
      .sort({ entryTime: -1 })
      .limit(10);

    const recentTickets = await Ticket.find({ studentId: student._id })
      .sort({ createdAt: -1 })
      .limit(5);

    return sendSuccess(res, {
      student,
      recentAttendance,
      recentTickets,
    });
  } catch (error) {
    next(error);
  }
};

export const updateStudent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, phone, course, studentIdNumber, assignedSeatNumber } = req.body;

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

    // Check if student is currently inside library with an active attendance session
    const activeSession = await Attendance.findOne({
      studentId: existingStudent._id,
      status: 'ACTIVE',
    });

    if (activeSession) {
      const studentDisplayName = name ? name.trim() : existingStudent.name;

      // Scenario: Admin changed assigned seat while student is currently inside
      if (cleanSeat !== undefined && cleanSeat !== '' && cleanSeat !== activeSession.seatNumber) {
        // Validate new target seat
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

        // Release old physical seat
        if (activeSession.seatId) {
          await Seat.findByIdAndUpdate(activeSession.seatId, {
            status: 'AVAILABLE',
            currentStudentId: null,
            currentStudentName: '',
            currentAttendanceId: null,
          });
        }

        // Atomically claim new target seat
        targetSeat.status = 'OCCUPIED';
        targetSeat.currentStudentId = existingStudent._id as any;
        targetSeat.currentStudentName = studentDisplayName;
        targetSeat.currentAttendanceId = activeSession._id as any;
        await targetSeat.save();

        // Update active session to reflect new seat and student name
        activeSession.seatNumber = cleanSeat;
        activeSession.seatId = targetSeat._id as any;
        if (name) activeSession.studentName = studentDisplayName;
        if (studentIdNumber) activeSession.studentIdNumber = studentIdNumber.trim();
        await activeSession.save();

        updateFields.currentSeatNumber = cleanSeat;
      } else {
        // Seat was not changed, but check if name or studentIdNumber changed
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
    } else {
      // Student is NOT currently inside: ensure isCurrentlyInside is false and currentSeatNumber is clear
      updateFields.isCurrentlyInside = false;
      updateFields.currentSeatNumber = null;
    }

    const student = await User.findByIdAndUpdate(
      id,
      updateFields,
      { new: true }
    ).select('-password');

    return sendSuccess(res, student, 'Student updated successfully');
  } catch (error) {
    next(error);
  }
};

export const updateStudentStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'INACTIVE', 'BLOCKED'].includes(status)) {
      return sendError(res, 'Invalid status value', 400);
    }

    const student = await User.findById(id);
    if (!student || student.role !== 'STUDENT') {
      return sendError(res, 'Student not found', 404);
    }

    student.status = status;
    await student.save();

    if (status === 'BLOCKED' || status === 'INACTIVE') {
      // Revoke all active sessions immediately
      await Session.updateMany({ userId: student._id }, { $set: { isRevoked: true } });
    }

    return sendSuccess(res, student, `Student marked as ${status}`);
  } catch (error) {
    next(error);
  }
};

export const resetStudentPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.trim().length < 6) {
      return sendError(res, 'New password is required and must be at least 6 characters', 400);
    }

    const student = await User.findById(id);
    if (!student || student.role !== 'STUDENT') {
      return sendError(res, 'Student not found', 404);
    }

    student.password = newPassword.trim();
    await student.save();

    // Revoke all active sessions so the student is forced to login with the new password
    await Session.updateMany({ userId: student._id }, { $set: { isRevoked: true } });

    return sendSuccess(res, null, 'Student password reset successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteStudent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const student = await User.findById(id);
    if (!student || student.role !== 'STUDENT') {
      return sendError(res, 'Student not found', 404);
    }

    // If currently occupying a seat, release it
    if (student.currentSeatNumber) {
      await Seat.findOneAndUpdate(
        { seatNumber: student.currentSeatNumber },
        {
          status: 'AVAILABLE',
          $unset: { currentStudentId: 1, currentStudentName: 1, currentAttendanceId: 1 },
        }
      );
    }

    // Revoke all sessions
    await Session.updateMany({ userId: student._id }, { $set: { isRevoked: true } });

    await User.findByIdAndDelete(id);
    return sendSuccess(res, null, 'Student deleted successfully');
  } catch (error) {
    next(error);
  }
};

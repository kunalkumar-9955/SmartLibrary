import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { Attendance } from '../models/Attendance';
import { Ticket } from '../models/Ticket';
import { Seat } from '../models/Seat';
import { sendSuccess, sendError } from '../utils/response';
import { sendStudentWelcomeEmail } from '../services/emailService';

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

    return sendSuccess(res, {
      students,
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

    if (!name || !email || !studentIdNumber || !password) {
      return sendError(res, 'Name, email, Student ID, and initial Password are required', 400);
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanStudentId = studentIdNumber.trim();

    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      return sendError(res, 'A student with this email address already exists', 409);
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
    }

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password: password.trim(),
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

    if (studentIdNumber) {
      const cleanStudentId = studentIdNumber.trim();
      const existingStudentId = await User.findOne({
        _id: { $ne: id },
        studentIdNumber: cleanStudentId,
      });
      if (existingStudentId) {
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
      name: name?.trim(),
      phone: phone?.trim(),
      course: course?.trim(),
      ...(studentIdNumber ? { studentIdNumber: studentIdNumber.trim() } : {}),
      ...(cleanSeat !== undefined ? { assignedSeatNumber: cleanSeat } : {}),
    };

    const student = await User.findByIdAndUpdate(
      id,
      updateFields,
      { new: true }
    ).select('-password');

    if (!student) {
      return sendError(res, 'Student not found', 404);
    }

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

    await User.findByIdAndDelete(id);
    return sendSuccess(res, null, 'Student deleted successfully');
  } catch (error) {
    next(error);
  }
};

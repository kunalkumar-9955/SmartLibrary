import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { Attendance } from '../models/Attendance';
import { Ticket } from '../models/Ticket';
import { sendSuccess, sendError } from '../utils/response';

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
    const { name, email, password, phone, studentIdNumber, course } = req.body;

    if (!name || !email || !studentIdNumber) {
      return sendError(res, 'Name, email, and Student ID are required', 400);
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return sendError(res, 'A student with this email address already exists', 409);
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password || 'Password@123',
      role: 'STUDENT',
      studentIdNumber: studentIdNumber.trim(),
      phone: phone?.trim(),
      course: course?.trim(),
      status: 'ACTIVE',
    });

    return sendSuccess(res, user, 'Student registered successfully', 201);
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
    const { name, phone, course, studentIdNumber } = req.body;

    const student = await User.findByIdAndUpdate(
      id,
      { name, phone, course, studentIdNumber },
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

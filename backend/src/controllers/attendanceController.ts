import { Request, Response, NextFunction } from 'express';
import { Attendance } from '../models/Attendance';
import { Seat } from '../models/Seat';
import { User } from '../models/User';
import { validateDynamicQR } from '../utils/qrCrypto';
import { sendSuccess, sendError } from '../utils/response';

export const markEntryAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentUserId = req.user?.id;
    const { qrPayload, preferredSeatNumber } = req.body;

    if (!studentUserId) {
      return sendError(res, 'Unauthorized student request', 401);
    }

    if (!qrPayload) {
      return sendError(res, 'QR Code payload is required', 400);
    }

    // Validate QR structure, signature, expiry, and type
    const qrValidation = validateDynamicQR(qrPayload, 'ENTRY');
    if (!qrValidation.isValid) {
      return sendError(res, qrValidation.error || 'Invalid attendance QR.', 400, 'INVALID_QR');
    }

    const student = await User.findById(studentUserId);
    if (!student) {
      return sendError(res, 'Student account not found', 404);
    }

    if (student.status !== 'ACTIVE') {
      return sendError(res, 'Your student account is inactive or blocked. Please contact admin.', 403, 'ACCOUNT_INACTIVE');
    }

    // Rule 1 & Rule 5: Check if student is already inside
    const existingActive = await Attendance.findOne({
      studentId: student._id,
      status: 'ACTIVE',
    });

    if (existingActive || student.isCurrentlyInside) {
      return sendError(
        res,
        'You are already marked inside the library.',
        409,
        'ALREADY_INSIDE'
      );
    }

    // Seat Assignment
    let assignedSeat = null;

    if (preferredSeatNumber) {
      const formattedNum = preferredSeatNumber.toString().padStart(2, '0');
      assignedSeat = await Seat.findOne({
        seatNumber: formattedNum,
        status: 'AVAILABLE',
      });
    }

    if (!assignedSeat) {
      // Find the first available seat from 01 to 50
      assignedSeat = await Seat.findOne({ status: 'AVAILABLE' }).sort({ seatNumber: 1 });
    }

    if (!assignedSeat) {
      return sendError(res, 'All 50 seats are currently occupied. Please wait for an available seat.', 409, 'NO_SEATS_AVAILABLE');
    }

    const now = new Date();
    const attendanceDate = now.toISOString().split('T')[0];

    // Create attendance record
    const attendance = new Attendance({
      studentId: student._id,
      studentName: student.name,
      studentIdNumber: student.studentIdNumber || '',
      seatNumber: assignedSeat.seatNumber,
      seatId: assignedSeat._id,
      entryTime: now,
      attendanceDate,
      entryMethod: 'QR',
      status: 'ACTIVE',
    });
    await attendance.save();

    // Mark seat occupied
    assignedSeat.status = 'OCCUPIED';
    assignedSeat.currentStudentId = student._id as any;
    assignedSeat.currentStudentName = student.name;
    assignedSeat.currentAttendanceId = attendance._id as any;
    await assignedSeat.save();

    // Update student state
    student.isCurrentlyInside = true;
    student.currentSeatNumber = assignedSeat.seatNumber;
    student.lastEntryTime = now;
    await student.save();

    return sendSuccess(
      res,
      {
        attendanceId: attendance._id,
        studentName: student.name,
        date: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }),
        entryTime: now,
        seatNumber: assignedSeat.seatNumber,
      },
      'Entry Attendance Marked Successfully',
      201
    );
  } catch (error) {
    next(error);
  }
};

export const markExitAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentUserId = req.user?.id;
    const { qrPayload } = req.body;

    if (!studentUserId) {
      return sendError(res, 'Unauthorized student request', 401);
    }

    if (!qrPayload) {
      return sendError(res, 'QR Code payload is required', 400);
    }

    // Validate EXIT QR
    const qrValidation = validateDynamicQR(qrPayload, 'EXIT');
    if (!qrValidation.isValid) {
      return sendError(res, qrValidation.error || 'Invalid attendance QR.', 400, 'INVALID_QR');
    }

    const student = await User.findById(studentUserId);
    if (!student) {
      return sendError(res, 'Student account not found', 404);
    }

    // Rule 2: Cannot mark exit without an active entry
    const activeSession = await Attendance.findOne({
      studentId: student._id,
      status: 'ACTIVE',
    });

    if (!activeSession) {
      return sendError(res, 'No active attendance found.', 404, 'NO_ACTIVE_ATTENDANCE');
    }

    const exitTime = new Date();
    const entryTime = activeSession.entryTime;
    const durationMinutes = Math.max(1, Math.round((exitTime.getTime() - entryTime.getTime()) / 60000));
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const durationString = `${hours}h ${mins < 10 ? '0' : ''}${mins}m`;

    // Complete attendance record
    activeSession.exitTime = exitTime;
    activeSession.durationMinutes = durationMinutes;
    activeSession.exitMethod = 'QR';
    activeSession.status = 'COMPLETED';
    await activeSession.save();

    // Release seat
    if (activeSession.seatId) {
      await Seat.findByIdAndUpdate(activeSession.seatId, {
        status: 'AVAILABLE',
        currentStudentId: null,
        currentStudentName: null,
        currentAttendanceId: null,
      });
    }

    // Update student state
    student.isCurrentlyInside = false;
    student.currentSeatNumber = undefined;
    student.lastExitTime = exitTime;
    await student.save();

    return sendSuccess(
      res,
      {
        entryTime,
        exitTime,
        durationMinutes,
        durationString,
      },
      'Exit Attendance Marked Successfully'
    );
  } catch (error) {
    next(error);
  }
};

export const getCurrentlyInside = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = (req.query.search as string) || '';

    const activeSessions = await Attendance.find({ status: 'ACTIVE' })
      .populate('studentId', 'name email phone studentIdNumber avatar')
      .sort({ entryTime: -1 });

    let list = activeSessions.map((s: any) => {
      const entryTimeMs = new Date(s.entryTime).getTime();
      const elapsedMinutes = Math.floor((Date.now() - entryTimeMs) / 60000);
      const hours = Math.floor(elapsedMinutes / 60);
      const mins = elapsedMinutes % 60;
      return {
        _id: s._id,
        studentId: s.studentId?._id,
        studentName: s.studentId?.name || s.studentName,
        studentIdNumber: s.studentId?.studentIdNumber || s.studentIdNumber || 'N/A',
        studentPhone: s.studentId?.phone || 'N/A',
        studentEmail: s.studentId?.email,
        avatar: s.studentId?.avatar,
        seatNumber: s.seatNumber || 'N/A',
        entryTime: s.entryTime,
        durationString: `${hours}h ${mins < 10 ? '0' : ''}${mins}m`,
        durationMinutes: elapsedMinutes,
      };
    });

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (item) =>
          item.studentName.toLowerCase().includes(q) ||
          item.seatNumber.toLowerCase().includes(q) ||
          item.studentIdNumber.toLowerCase().includes(q)
      );
    }

    return sendSuccess(res, list);
  } catch (error) {
    next(error);
  }
};

export const forceCheckout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const session = await Attendance.findOne({ _id: id, status: 'ACTIVE' });
    if (!session) {
      return sendError(res, 'Active attendance session not found', 404);
    }

    const exitTime = new Date();
    const durationMinutes = Math.max(1, Math.round((exitTime.getTime() - session.entryTime.getTime()) / 60000));

    session.exitTime = exitTime;
    session.durationMinutes = durationMinutes;
    session.exitMethod = 'MANUAL';
    session.status = 'COMPLETED';
    await session.save();

    if (session.seatId) {
      await Seat.findByIdAndUpdate(session.seatId, {
        status: 'AVAILABLE',
        currentStudentId: null,
        currentStudentName: null,
        currentAttendanceId: null,
      });
    }

    await User.findByIdAndUpdate(session.studentId, {
      isCurrentlyInside: false,
      currentSeatNumber: undefined,
      lastExitTime: exitTime,
    });

    return sendSuccess(res, session, 'Student checked out successfully');
  } catch (error) {
    next(error);
  }
};

export const getMyAttendanceHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentUserId = req.user?.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;

    const query: any = { studentId: studentUserId };

    const total = await Attendance.countDocuments(query);
    const records = await Attendance.find(query)
      .sort({ entryTime: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return sendSuccess(res, {
      records,
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

export const getAllAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || '';
    const date = (req.query.date as string) || '';
    const status = (req.query.status as string) || '';

    const query: any = {};
    if (status) query.status = status;
    if (date) query.attendanceDate = date;

    if (search) {
      query.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { studentIdNumber: { $regex: search, $options: 'i' } },
        { seatNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Attendance.countDocuments(query);
    const records = await Attendance.find(query)
      .populate('studentId', 'name studentIdNumber phone email avatar')
      .sort({ entryTime: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return sendSuccess(res, {
      records,
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

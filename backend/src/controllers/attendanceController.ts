import { Request, Response, NextFunction } from 'express';
import { Attendance } from '../models/Attendance';
import { Seat } from '../models/Seat';
import { User } from '../models/User';
import { QrSession } from '../models/QrSession';
import { rotateQRSession } from './qrController';
import { validateDynamicQR } from '../utils/qrCrypto';
import { sendSuccess, sendError } from '../utils/response';
import { deriveFixedSeatNumber } from '../utils/seatHelper';

export const markEntryAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentUserId = req.user?.id;
    const { qrPayload } = req.body;

    if (!studentUserId) {
      return sendError(res, 'Unauthorized student request', 401);
    }

    if (!qrPayload) {
      return sendError(res, 'QR Code payload is required', 400);
    }

    // 1. Validate QR structure, signature, expiry, and type
    const qrValidation = validateDynamicQR(qrPayload, 'ENTRY');
    if (!qrValidation.isValid) {
      return sendError(res, qrValidation.error || 'Invalid attendance QR.', 400, 'INVALID_QR');
    }

    // 2. Validate against QrSession in database (checking ACTIVE status or in-flight grace window)
    const now = new Date();
    const qrSession = await QrSession.findOne({ token: qrPayload.token, qrType: 'ENTRY' });

    if (qrSession) {
      const isCurrentActive = qrSession.status === 'ACTIVE';
      const isWithinGrace = qrSession.status === 'ROTATED' && qrSession.graceExpiresAt && qrSession.graceExpiresAt > now;

      if (!isCurrentActive && !isWithinGrace) {
        return sendError(res, 'QR code has expired. Please scan the currently displayed QR.', 400, 'QR_EXPIRED');
      }
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
        'Already Checked In: You are already inside the library. Please use the Exit Scanner to check out.',
        409,
        'ALREADY_INSIDE'
      );
    }

    // Rule 3: Fixed Seat Rule - Derive fixed seat deterministically from Student ID
    const fixedSeatNumber = deriveFixedSeatNumber(student);
    if (!fixedSeatNumber) {
      return sendError(
        res,
        'No valid fixed seat (Seat 01 to 50) is associated with your Student ID. Please contact library admin.',
        400,
        'NO_FIXED_SEAT'
      );
    }

    // Atomically allocate ONLY the student's fixed seat
    const assignedSeat = await Seat.findOneAndUpdate(
      { seatNumber: fixedSeatNumber, status: 'AVAILABLE' },
      {
        $set: {
          status: 'OCCUPIED',
          currentStudentId: student._id,
          currentStudentName: student.name,
        },
      },
      { new: true }
    );

    if (!assignedSeat) {
      const targetSeat = await Seat.findOne({ seatNumber: fixedSeatNumber });
      if (targetSeat?.status === 'MAINTENANCE') {
        return sendError(
          res,
          `Your assigned Seat ${fixedSeatNumber} is currently undergoing maintenance. Please contact library admin.`,
          409,
          'SEAT_MAINTENANCE'
        );
      }
      return sendError(
        res,
        `Your assigned Seat ${fixedSeatNumber} is currently marked as occupied. Please contact library admin if this is unexpected.`,
        409,
        'SEAT_UNAVAILABLE'
      );
    }

    const attendanceDate = now.toISOString().split('T')[0];

    try {
      // Create attendance record
      const attendance = await Attendance.create({
        studentId: student._id,
        studentName: student.name,
        studentIdNumber: student.studentIdNumber || '',
        seatNumber: assignedSeat.seatNumber,
        seatId: assignedSeat._id,
        entryTime: now,
        attendanceDate,
        entryMethod: 'QR',
        attendanceSource: 'LIVE_QR',
        status: 'ACTIVE',
      });

      // Link attendance ID to seat
      await Seat.findByIdAndUpdate(assignedSeat._id, {
        currentAttendanceId: attendance._id,
      });

      // Update student state
      await User.findByIdAndUpdate(student._id, {
        isCurrentlyInside: true,
        currentSeatNumber: assignedSeat.seatNumber,
        lastEntryTime: now,
      });

      // Trigger automatic QR rotation in the background (non-blocking)
      rotateQRSession('ENTRY', qrPayload.token, 'SUCCESSFUL_ENTRY').catch((rotErr) => {
        console.warn('[QR Rotation] Non-blocking entry rotation error:', rotErr);
      });

      return sendSuccess(
        res,
        {
          attendanceId: attendance._id,
          studentName: student.name,
          date: now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
          entryTime: now,
          seatNumber: assignedSeat.seatNumber,
        },
        'Entry Attendance Marked Successfully',
        201
      );
    } catch (createErr: any) {
      // Rollback seat allocation immediately if attendance creation fails (e.g. concurrent duplicate entry)
      await Seat.findByIdAndUpdate(assignedSeat._id, {
        status: 'AVAILABLE',
        currentStudentId: null,
        currentStudentName: '',
        currentAttendanceId: null,
      });

      if (createErr.code === 11000) {
        return sendError(
          res,
          'You are already marked inside the library.',
          409,
          'ALREADY_INSIDE'
        );
      }
      throw createErr;
    }
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

    // 1. Validate EXIT QR payload
    const qrValidation = validateDynamicQR(qrPayload, 'EXIT');
    if (!qrValidation.isValid) {
      return sendError(res, qrValidation.error || 'Invalid attendance QR.', 400, 'INVALID_QR');
    }

    // 2. Validate against QrSession in database (checking ACTIVE status or in-flight grace window)
    const now = new Date();
    const qrSession = await QrSession.findOne({ token: qrPayload.token, qrType: 'EXIT' });

    if (qrSession) {
      const isCurrentActive = qrSession.status === 'ACTIVE';
      const isWithinGrace = qrSession.status === 'ROTATED' && qrSession.graceExpiresAt && qrSession.graceExpiresAt > now;

      if (!isCurrentActive && !isWithinGrace) {
        return sendError(res, 'QR code has expired. Please scan the currently displayed QR.', 400, 'QR_EXPIRED');
      }
    }

    const student = await User.findById(studentUserId);
    if (!student) {
      return sendError(res, 'Student account not found', 404);
    }

    const exitTime = new Date();

    // Concurrency-safe atomic checkout: find and mark COMPLETED in a single atomic database operation
    const activeSession = await Attendance.findOneAndUpdate(
      {
        studentId: student._id,
        status: 'ACTIVE',
      },
      {
        $set: {
          exitTime,
          exitMethod: 'QR',
          status: 'COMPLETED',
        },
      },
      { new: false } // returns pre-update document containing entryTime and seatId
    );

    if (!activeSession) {
      return sendError(res, 'No active library session found.', 404, 'NO_ACTIVE_ATTENDANCE');
    }

    const entryTime = activeSession.entryTime;
    const durationMinutes = Math.max(1, Math.round((exitTime.getTime() - entryTime.getTime()) / 60000));
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const durationString = `${hours}h ${mins < 10 ? '0' : ''}${mins}m`;

    // Persist final duration
    await Attendance.findByIdAndUpdate(activeSession._id, { durationMinutes });

    // Atomically release seat
    if (activeSession.seatId) {
      await Seat.findByIdAndUpdate(activeSession.seatId, {
        status: 'AVAILABLE',
        currentStudentId: null,
        currentStudentName: '',
        currentAttendanceId: null,
      });
    }

    // Atomically update student state
    await User.findByIdAndUpdate(student._id, {
      isCurrentlyInside: false,
      currentSeatNumber: undefined,
      lastExitTime: exitTime,
    });

    // Trigger automatic EXIT QR rotation in the background (non-blocking)
    rotateQRSession('EXIT', qrPayload.token, 'SUCCESSFUL_EXIT').catch((rotErr) => {
      console.warn('[QR Rotation] Non-blocking exit rotation error:', rotErr);
    });

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

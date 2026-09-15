import { Request, Response, NextFunction } from 'express';
import { DailyQrSession } from '../models/DailyQrSession';
import { Attendance } from '../models/Attendance';
import { Seat } from '../models/Seat';
import { User } from '../models/User';
import { generateDailyQRPayload, validateDailyQRPayload } from '../utils/dailyQrCrypto';
import { sendSuccess, sendError } from '../utils/response';

// Helper: Get today's authoritative server date in YYYY-MM-DD
export const getServerDateString = (d: Date = new Date()): string => {
  return d.toISOString().split('T')[0];
};

// Helper: Get end-of-day timestamp for a given date (23:59:59.999)
export const getEndOfDayTimestamp = (d: Date = new Date()): number => {
  const endOfDay = new Date(d);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay.getTime();
};

/**
 * Admin: Get active Daily QR for today (if exists)
 * GET /api/daily-qr/today
 */
export const getTodayDailyQR = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const todayStr = getServerDateString();
    const now = new Date();

    const activeDaily = await DailyQrSession.findOne({
      date: todayStr,
      status: 'ACTIVE',
      expiresAt: { $gt: now },
    });

    if (!activeDaily) {
      return sendSuccess(res, { exists: false }, 'No active Daily QR found for today');
    }

    const payload = generateDailyQRPayload(
      activeDaily.date,
      activeDaily.expiresAt.getTime(),
      activeDaily.dailyQrId,
      activeDaily.token
    );

    return sendSuccess(
      res,
      {
        exists: true,
        qrPayload: payload,
        date: activeDaily.date,
        expiresAt: activeDaily.expiresAt,
        status: activeDaily.status,
        scanCount: activeDaily.scanCount,
        createdAt: activeDaily.createdAt,
      },
      'Active Daily QR retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Generate Daily QR for today
 * POST /api/daily-qr/generate
 * If an active Daily QR already exists for today, returns it without creating a duplicate.
 * If forceRegenerate=true, marks previous ones REVOKED and issues a fresh one.
 */
export const generateDailyQR = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.user?.id;
    const { forceRegenerate } = req.body;
    const todayStr = getServerDateString();
    const now = new Date();
    const endOfDayMs = getEndOfDayTimestamp(now);
    const expiresAt = new Date(endOfDayMs);

    if (!forceRegenerate) {
      // Check if an active Daily QR already exists for today
      const existingDaily = await DailyQrSession.findOne({
        date: todayStr,
        status: 'ACTIVE',
        expiresAt: { $gt: now },
      });

      if (existingDaily) {
        const payload = generateDailyQRPayload(
          existingDaily.date,
          existingDaily.expiresAt.getTime(),
          existingDaily.dailyQrId,
          existingDaily.token
        );

        return sendSuccess(
          res,
          {
            qrPayload: payload,
            date: existingDaily.date,
            expiresAt: existingDaily.expiresAt,
            status: existingDaily.status,
            scanCount: existingDaily.scanCount,
            createdAt: existingDaily.createdAt,
            isExisting: true,
          },
          'Existing active Daily QR for today retrieved',
          200
        );
      }
    }

    // If forceRegenerate is requested, revoke all previous sessions for today
    if (forceRegenerate) {
      await DailyQrSession.updateMany(
        { date: todayStr, status: 'ACTIVE' },
        { $set: { status: 'REVOKED' } }
      );
    }

    // Generate new secure Daily QR payload
    const newPayload = generateDailyQRPayload(todayStr, endOfDayMs);

    const newDaily = await DailyQrSession.create({
      dailyQrId: newPayload.dailyQrId,
      date: todayStr,
      token: newPayload.token,
      signature: newPayload.signature,
      status: 'ACTIVE',
      expiresAt,
      scanCount: 0,
      createdBy: adminId,
    });

    console.log(`[Daily QR] Created new Daily QR for date ${todayStr}, id: ${newDaily.dailyQrId}`);

    return sendSuccess(
      res,
      {
        qrPayload: newPayload,
        date: newDaily.date,
        expiresAt: newDaily.expiresAt,
        status: newDaily.status,
        scanCount: 0,
        createdAt: newDaily.createdAt,
        isExisting: false,
      },
      'Daily QR generated successfully for today',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Student: Scan Daily QR (Auto Entry / Exit determination)
 * POST /api/daily-qr/scan
 */
export const scanDailyQR = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentUserId = req.user?.id;
    const { qrPayload, preferredSeatNumber } = req.body;

    if (!studentUserId) {
      return sendError(res, 'Unauthorized student request', 401);
    }

    if (!qrPayload) {
      return sendError(res, 'Daily QR Code payload is required', 400);
    }

    const now = new Date();
    const todayStr = getServerDateString(now);

    // 1. Cryptographic and expiration validation
    const qrValidation = validateDailyQRPayload(qrPayload, todayStr);
    if (!qrValidation.isValid) {
      return sendError(res, qrValidation.error || 'Invalid Daily QR.', 400, 'INVALID_DAILY_QR');
    }

    // 2. Validate against DailyQrSession record in database
    const dailySession = await DailyQrSession.findOne({
      token: qrPayload.token,
      status: 'ACTIVE',
      expiresAt: { $gt: now },
    });

    if (!dailySession) {
      return sendError(res, 'Daily QR code is no longer active or has been revoked.', 400, 'DAILY_QR_INACTIVE');
    }

    // 3. Verify student status
    const student = await User.findById(studentUserId);
    if (!student) {
      return sendError(res, 'Student account not found', 404);
    }

    if (student.status !== 'ACTIVE') {
      return sendError(
        res,
        'Your student account is inactive or blocked. Please contact admin.',
        403,
        'ACCOUNT_INACTIVE'
      );
    }

    // 4. Determine student's current attendance state independently
    const existingActive = await Attendance.findOne({
      studentId: student._id,
      status: 'ACTIVE',
    });

    if (!existingActive) {
      // -------------------------------------------------------------
      // STATE: NO ACTIVE ATTENDANCE -> MARK ENTRY
      // -------------------------------------------------------------
      const requestedSeat = preferredSeatNumber || student.assignedSeatNumber;
      let assignedSeat: import('../models/Seat').ISeat | null = null;

      if (requestedSeat) {
        const formattedNum = requestedSeat.toString().padStart(2, '0');
        assignedSeat = await Seat.findOneAndUpdate(
          { seatNumber: formattedNum, status: 'AVAILABLE' },
          {
            $set: {
              status: 'OCCUPIED',
              currentStudentId: student._id,
              currentStudentName: student.name,
            },
          },
          { new: true }
        );

        if (!assignedSeat && preferredSeatNumber) {
          return sendError(res, 'Seat is no longer available.', 409, 'SEAT_UNAVAILABLE');
        }
      }

      if (!assignedSeat) {
        // Atomically occupy lowest numbered available seat from 01 to 50
        assignedSeat = await Seat.findOneAndUpdate(
          { status: 'AVAILABLE' },
          {
            $set: {
              status: 'OCCUPIED',
              currentStudentId: student._id,
              currentStudentName: student.name,
            },
          },
          { sort: { seatNumber: 1 }, new: true }
        );
      }

      if (!assignedSeat) {
        return sendError(
          res,
          'All library seats are currently occupied.',
          409,
          'NO_SEATS_AVAILABLE'
        );
      }

      try {
        const attendance = await Attendance.create({
          studentId: student._id,
          studentName: student.name,
          studentIdNumber: student.studentIdNumber || '',
          seatNumber: assignedSeat.seatNumber,
          seatId: assignedSeat._id,
          entryTime: now,
          attendanceDate: todayStr,
          entryMethod: 'QR',
          status: 'ACTIVE',
          attendanceSource: 'DAILY_QR',
        });

        await Seat.findByIdAndUpdate(assignedSeat._id, {
          currentAttendanceId: attendance._id,
        });

        await User.findByIdAndUpdate(student._id, {
          isCurrentlyInside: true,
          currentSeatNumber: assignedSeat.seatNumber,
          lastEntryTime: now,
        });

        // Increment scan count on DailyQrSession (Daily QR DOES NOT rotate)
        await DailyQrSession.findByIdAndUpdate(dailySession._id, {
          $inc: { scanCount: 1 },
        });

        return sendSuccess(
          res,
          {
            type: 'ENTRY',
            attendanceId: attendance._id,
            studentName: student.name,
            seatNumber: assignedSeat.seatNumber,
            date: now.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            }),
            entryTime: now,
          },
          'Entry Attendance Marked Successfully (Daily QR)',
          201
        );
      } catch (createErr: any) {
        // Rollback seat on race condition
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
    } else {
      // -------------------------------------------------------------
      // STATE: ACTIVE ATTENDANCE EXISTS -> MARK EXIT
      // -------------------------------------------------------------
      // Prevent rapid duplicate scan callback from toggling Entry to Exit within 3 seconds
      if (now.getTime() - existingActive.entryTime.getTime() < 3000) {
        return sendError(
          res,
          'Entry attendance already recorded. Please wait a moment before scanning to exit.',
          429,
          'RAPID_SCAN_DEBOUNCE'
        );
      }

      const activeSession = await Attendance.findOneAndUpdate(
        {
          studentId: student._id,
          status: 'ACTIVE',
        },
        {
          $set: {
            exitTime: now,
            exitMethod: 'QR',
            status: 'COMPLETED',
          },
        },
        { new: false }
      );

      if (!activeSession) {
        return sendError(res, 'No active library session found.', 404, 'NO_ACTIVE_ATTENDANCE');
      }

      const entryTime = activeSession.entryTime;
      const durationMinutes = Math.max(1, Math.round((now.getTime() - entryTime.getTime()) / 60000));
      const hours = Math.floor(durationMinutes / 60);
      const mins = durationMinutes % 60;
      const durationString = `${hours}h ${mins < 10 ? '0' : ''}${mins}m`;

      await Attendance.findByIdAndUpdate(activeSession._id, { durationMinutes });

      if (activeSession.seatId) {
        await Seat.findByIdAndUpdate(activeSession.seatId, {
          status: 'AVAILABLE',
          currentStudentId: null,
          currentStudentName: '',
          currentAttendanceId: null,
        });
      }

      await User.findByIdAndUpdate(student._id, {
        isCurrentlyInside: false,
        currentSeatNumber: undefined,
        lastExitTime: now,
      });

      // Increment scan count on DailyQrSession (Daily QR DOES NOT rotate)
      await DailyQrSession.findByIdAndUpdate(dailySession._id, {
        $inc: { scanCount: 1 },
      });

      return sendSuccess(
        res,
        {
          type: 'EXIT',
          attendanceId: activeSession._id,
          studentName: student.name,
          seatNumber: activeSession.seatNumber,
          date: now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
          entryTime,
          exitTime: now,
          durationMinutes,
          durationString,
        },
        'Exit Attendance Marked Successfully (Daily QR)',
        200
      );
    }
  } catch (error) {
    next(error);
  }
};

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { StudentPersonalQr } from '../models/StudentPersonalQr';
import { User } from '../models/User';
import { Attendance } from '../models/Attendance';
import { Seat } from '../models/Seat';
import { sendSuccess, sendError } from '../utils/response';
import { deriveFixedSeatNumber } from '../utils/seatHelper';
import { getISTDateString, formatISTDateDisplay } from '../utils/timeHelper';
import { logAdminAction } from '../services/auditService';

/**
 * Generate a cryptographically secure 64-character hex token
 */
export const generateSecureQrToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Format the standard QR payload stored inside the personal QR code
 */
export const buildPersonalQrPayloadString = (token: string): string => {
  return JSON.stringify({
    qrType: 'DAILY',
    type: 'PERSONAL_QR',
    token,
    signature: 'PERMANENT_TABLE_QR',
    lib: 'LAKSHYA_SMART_LIBRARY',
  });
};

/**
 * Admin: List all students with their personal QR status and seat assignment
 * GET /api/personal-qr/students
 */
export const listStudentsWithQr = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = ((req.query.search as string) || '').trim();
    const filter = (req.query.filter as string) || 'all'; // 'all' | 'active' | 'missing' | 'revoked'

    const query: any = { role: 'STUDENT' };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { studentIdNumber: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { assignedSeatNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const students = await User.find(query)
      .select('name email phone studentIdNumber course avatar status isCurrentlyInside currentSeatNumber assignedSeatNumber createdAt')
      .sort({ studentIdNumber: 1, name: 1 });

    const studentIds = students.map((s) => s._id);

    // Fetch active QRs for these students
    const activeQrs = await StudentPersonalQr.find({
      studentId: { $in: studentIds },
      status: 'ACTIVE',
    });

    const qrMap = new Map<string, any>();
    activeQrs.forEach((qr) => {
      qrMap.set(qr.studentId.toString(), qr);
    });

    let result = students.map((s) => {
      const activeQr = qrMap.get(s._id.toString()) || null;
      const derivedSeat = deriveFixedSeatNumber(s);
      return {
        _id: s._id,
        name: s.name,
        email: s.email,
        phone: s.phone || 'N/A',
        studentIdNumber: s.studentIdNumber || 'N/A',
        course: s.course || '',
        avatar: s.avatar || '',
        status: s.status,
        isCurrentlyInside: s.isCurrentlyInside,
        currentSeatNumber: s.currentSeatNumber,
        assignedSeatNumber: s.assignedSeatNumber || derivedSeat || 'N/A',
        hasActiveQr: Boolean(activeQr),
        qr: activeQr
          ? {
              _id: activeQr._id,
              qrToken: activeQr.qrToken,
              qrPayloadString: buildPersonalQrPayloadString(activeQr.qrToken),
              status: activeQr.status,
              generationCount: activeQr.generationCount,
              createdAt: activeQr.createdAt,
              updatedAt: activeQr.updatedAt,
            }
          : null,
      };
    });

    if (filter === 'active') {
      result = result.filter((item) => item.hasActiveQr);
    } else if (filter === 'missing') {
      result = result.filter((item) => !item.hasActiveQr);
    }

    const summary = {
      totalStudents: students.length,
      activeQrsCount: activeQrs.length,
      missingQrsCount: students.length - activeQrs.length,
    };

    return sendSuccess(res, { students: result, summary });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Generate Personal QR for an individual student
 * POST /api/personal-qr/generate/:studentId
 */
export const generatePersonalQr = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;

    const student = await User.findById(studentId);
    if (!student || student.role !== 'STUDENT') {
      return sendError(res, 'Student account not found', 404);
    }

    // Check if student already has an active QR
    const existingQr = await StudentPersonalQr.findOne({
      studentId: student._id,
      status: 'ACTIVE',
    });

    if (existingQr) {
      return sendSuccess(
        res,
        {
          qr: existingQr,
          qrPayloadString: buildPersonalQrPayloadString(existingQr.qrToken),
          isExisting: true,
        },
        'Active Personal QR already exists for this student',
        200
      );
    }

    const assignedSeat = student.assignedSeatNumber || deriveFixedSeatNumber(student) || '';
    const newQrToken = generateSecureQrToken();

    const newQr = await StudentPersonalQr.create({
      studentId: student._id,
      studentName: student.name,
      studentIdNumber: student.studentIdNumber || '',
      assignedSeatNumber: assignedSeat,
      qrToken: newQrToken,
      status: 'ACTIVE',
      generationCount: 1,
    });

    await logAdminAction({
      adminId: req.user?.id,
      adminEmail: req.user?.email,
      adminName: req.user?.name,
      action: 'QR_GENERATED',
      targetId: student._id,
      targetName: student.name,
      targetType: 'QR',
      details: {
        studentIdNumber: student.studentIdNumber,
        assignedSeat,
        generationCount: 1,
      },
    });

    return sendSuccess(
      res,
      {
        qr: newQr,
        qrPayloadString: buildPersonalQrPayloadString(newQr.qrToken),
        isExisting: false,
      },
      'Personal QR code generated successfully',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Bulk generate missing Personal QRs for all registered students
 * POST /api/personal-qr/generate-bulk
 */
export const generateBulkPersonalQrs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const students = await User.find({ role: 'STUDENT', status: 'ACTIVE' });
    const existingActiveQrs = await StudentPersonalQr.find({ status: 'ACTIVE' });
    const existingStudentIds = new Set(existingActiveQrs.map((q) => q.studentId.toString()));

    const studentsNeedingQr = students.filter((s) => !existingStudentIds.has(s._id.toString()));

    if (studentsNeedingQr.length === 0) {
      return sendSuccess(
        res,
        { generatedCount: 0, totalActive: existingActiveQrs.length },
        'All registered active students already possess active Personal QR codes'
      );
    }

    const docsToInsert = studentsNeedingQr.map((s) => ({
      studentId: s._id,
      studentName: s.name,
      studentIdNumber: s.studentIdNumber || '',
      assignedSeatNumber: s.assignedSeatNumber || deriveFixedSeatNumber(s) || '',
      qrToken: generateSecureQrToken(),
      status: 'ACTIVE' as const,
      generationCount: 1,
    }));

    await StudentPersonalQr.insertMany(docsToInsert);

    const totalActive = existingActiveQrs.length + docsToInsert.length;

    await logAdminAction({
      adminId: req.user?.id,
      adminEmail: req.user?.email,
      adminName: req.user?.name,
      action: 'BULK_QR_GENERATED',
      targetType: 'QR',
      details: {
        generatedCount: docsToInsert.length,
        totalActive,
      },
    });

    return sendSuccess(
      res,
      {
        generatedCount: docsToInsert.length,
        totalActive,
      },
      `Successfully generated Personal QR codes for ${docsToInsert.length} students`,
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Bulk activate Personal QRs for all eligible active students
 * POST /api/personal-qr/activate-bulk
 */
export const activateBulkPersonalQrs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Calls bulk generator to ensure all students have an active QR
    const students = await User.find({ role: 'STUDENT', status: 'ACTIVE' });
    const existingActiveQrs = await StudentPersonalQr.find({ status: 'ACTIVE' });
    const existingStudentIds = new Set(existingActiveQrs.map((q) => q.studentId.toString()));

    const studentsNeedingQr = students.filter((s) => !existingStudentIds.has(s._id.toString()));

    let generatedCount = 0;
    if (studentsNeedingQr.length > 0) {
      const docsToInsert = studentsNeedingQr.map((s) => ({
        studentId: s._id,
        studentName: s.name,
        studentIdNumber: s.studentIdNumber || '',
        assignedSeatNumber: s.assignedSeatNumber || deriveFixedSeatNumber(s) || '',
        qrToken: generateSecureQrToken(),
        status: 'ACTIVE' as const,
        generationCount: 1,
      }));
      await StudentPersonalQr.insertMany(docsToInsert);
      generatedCount = docsToInsert.length;
    }

    const totalActive = existingActiveQrs.length + generatedCount;

    await logAdminAction({
      adminId: req.user?.id,
      adminEmail: req.user?.email,
      adminName: req.user?.name,
      action: 'BULK_QR_ACTIVATED',
      targetType: 'QR',
      details: {
        newlyGenerated: generatedCount,
        alreadyActive: existingActiveQrs.length,
        totalActive,
      },
    });

    return sendSuccess(
      res,
      {
        totalActive,
        newlyActivatedCount: generatedCount,
        alreadyActiveCount: existingActiveQrs.length,
      },
      `All ${totalActive} active students now have active Personal QR codes.`,
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Regenerate / Revoke Personal QR for a student (e.g. lost card, desk change)
 * POST /api/personal-qr/regenerate/:studentId
 */
export const regeneratePersonalQr = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const adminId = req.user?.id;

    const student = await User.findById(studentId);
    if (!student || student.role !== 'STUDENT') {
      return sendError(res, 'Student account not found', 404);
    }

    // 1. Revoke existing active QR tokens for this student
    const previousActive = await StudentPersonalQr.findOne({
      studentId: student._id,
      status: 'ACTIVE',
    });

    let nextGenerationCount = 1;

    if (previousActive) {
      nextGenerationCount = (previousActive.generationCount || 1) + 1;
      previousActive.status = 'REVOKED';
      previousActive.revokedAt = new Date();
      if (adminId) previousActive.revokedBy = adminId as any;
      await previousActive.save();
    }

    // 2. Generate a fresh cryptographically secure token
    const newQrToken = generateSecureQrToken();
    const assignedSeat = student.assignedSeatNumber || deriveFixedSeatNumber(student) || '';

    const newQr = await StudentPersonalQr.create({
      studentId: student._id,
      studentName: student.name,
      studentIdNumber: student.studentIdNumber || '',
      assignedSeatNumber: assignedSeat,
      qrToken: newQrToken,
      status: 'ACTIVE',
      generationCount: nextGenerationCount,
    });

    console.log(`[Personal QR] Regenerated QR for student ${student.name} (${student.studentIdNumber}). Generation: ${nextGenerationCount}`);

    await logAdminAction({
      adminId,
      adminEmail: req.user?.email,
      adminName: req.user?.name,
      action: 'QR_GENERATED',
      targetId: student._id,
      targetName: student.name,
      targetType: 'QR',
      details: {
        previousActiveId: previousActive?._id,
        nextGenerationCount,
        assignedSeat,
      },
    });

    return sendSuccess(
      res,
      {
        qr: newQr,
        qrPayloadString: buildPersonalQrPayloadString(newQr.qrToken),
        generationCount: nextGenerationCount,
      },
      'Personal QR regenerated successfully. Previous QR has been permanently revoked.',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Admin & Student: Get single student's active personal QR details
 * GET /api/personal-qr/student/:studentId
 */
export const getStudentPersonalQr = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const requestingUserId = req.user?.id;
    const requestingRole = req.user?.role;

    // Students can only view their own QR; Admins can view any student's QR
    if (requestingRole !== 'ADMIN' && requestingUserId !== studentId) {
      return sendError(res, 'Access denied', 403);
    }

    const student = await User.findById(studentId);
    if (!student) {
      return sendError(res, 'Student account not found', 404);
    }

    const qr = await StudentPersonalQr.findOne({
      studentId: student._id,
      status: 'ACTIVE',
    });

    if (!qr) {
      return sendError(res, 'No active Personal QR found for this student', 404);
    }

    const assignedSeat = student.assignedSeatNumber || deriveFixedSeatNumber(student) || 'N/A';

    return sendSuccess(res, {
      student: {
        _id: student._id,
        name: student.name,
        studentIdNumber: student.studentIdNumber,
        assignedSeatNumber: assignedSeat,
      },
      qr: {
        _id: qr._id,
        qrToken: qr.qrToken,
        qrPayloadString: buildPersonalQrPayloadString(qr.qrToken),
        status: qr.status,
        generationCount: qr.generationCount,
        createdAt: qr.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Student: Scan Personal Table QR Code
 * POST /api/personal-qr/scan
 * Automatically determines whether to mark ENTRY or EXIT based on the student's active attendance session.
 */
export const scanPersonalQr = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentUserId = req.user?.id;
    const { token, qrPayload } = req.body;

    if (!studentUserId) {
      return sendError(res, 'Unauthorized student request', 401);
    }

    // Extract token from either raw string or structured payload
    let rawToken = token;
    if (!rawToken && qrPayload) {
      if (typeof qrPayload === 'string') {
        try {
          const parsed = JSON.parse(qrPayload);
          rawToken = parsed.token;
        } catch {
          rawToken = qrPayload;
        }
      } else if (qrPayload.token) {
        rawToken = qrPayload.token;
      }
    }

    if (!rawToken || typeof rawToken !== 'string') {
      return sendError(res, 'Valid Personal QR token is required', 400, 'INVALID_QR_TOKEN');
    }

    const cleanToken = rawToken.trim();

    // 1. Validate QR token existence in database
    const qrRecord = await StudentPersonalQr.findOne({ qrToken: cleanToken });

    if (!qrRecord) {
      return sendError(res, 'Invalid QR code. This QR is not registered with Lakshya Smart Library.', 400, 'QR_NOT_FOUND');
    }

    // 2. Check if QR code has been revoked
    if (qrRecord.status === 'REVOKED') {
      return sendError(
        res,
        'This QR code has been revoked or replaced. Please contact library admin for a replacement.',
        400,
        'QR_REVOKED'
      );
    }

    // 3. MANDATORY CRITICAL SECURITY: Verify QR Ownership
    // If Student A scans Student B's QR, REJECT!
    if (qrRecord.studentId.toString() !== studentUserId.toString()) {
      return sendError(
        res,
        'This QR code does not belong to your account. Please scan your own library table QR.',
        403,
        'QR_OWNERSHIP_MISMATCH'
      );
    }

    // 4. Verify student account state
    const student = await User.findById(studentUserId);
    if (!student) {
      return sendError(res, 'Student account not found', 404);
    }

    if (student.status !== 'ACTIVE') {
      return sendError(
        res,
        'Your student account is inactive or blocked. Please contact library admin.',
        403,
        'ACCOUNT_INACTIVE'
      );
    }

    const now = new Date();
    const todayStr = getISTDateString(now);

    // 5. Query student's current active attendance session
    const existingActive = await Attendance.findOne({
      studentId: student._id,
      status: 'ACTIVE',
    });

    // =========================================================================
    // CASE A: NO ACTIVE ATTENDANCE -> AUTOMATICALLY MARK ENTRY
    // =========================================================================
    if (!existingActive) {
      // Rule 3: Fixed Seat Rule - Derive fixed seat deterministically from Student ID or assignment
      const fixedSeatNumber = deriveFixedSeatNumber(student);
      if (!fixedSeatNumber) {
        return sendError(
          res,
          'No valid seat (Seat 01 to 50) is associated with your Student ID. Please contact library admin.',
          400,
          'NO_FIXED_SEAT'
        );
      }

      // Atomically allocate ONLY the student's assigned fixed seat
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
          `Your assigned Seat ${fixedSeatNumber} is currently occupied. Please contact library admin if this is unexpected.`,
          409,
          'SEAT_UNAVAILABLE'
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
          attendanceSource: 'PERSONAL_QR',
        });

        await Seat.findByIdAndUpdate(assignedSeat._id, {
          currentAttendanceId: attendance._id,
        });

        await User.findByIdAndUpdate(student._id, {
          isCurrentlyInside: true,
          currentSeatNumber: assignedSeat.seatNumber,
          lastEntryTime: now,
        });

        return sendSuccess(
          res,
          {
            type: 'ENTRY',
            attendanceId: attendance._id,
            studentName: student.name,
            studentIdNumber: student.studentIdNumber || 'N/A',
            seatNumber: assignedSeat.seatNumber,
            date: formatISTDateDisplay(now, true),
            entryTime: now,
            status: 'ACTIVE',
          },
          'Entry Marked Successfully',
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
            'You already have an active entry session.',
            400,
            'ALREADY_CHECKED_IN'
          );
        }
        throw createErr;
      }
    }

    // =========================================================================
    // CASE B: ACTIVE ATTENDANCE EXISTS -> AUTOMATICALLY MARK EXIT
    // =========================================================================
    // Debounce check: prevent rapid accidental double-scan within 3 seconds
    if (now.getTime() - existingActive.entryTime.getTime() < 3000) {
      return sendError(
        res,
        'Entry attendance was just recorded. Please wait a moment before scanning to exit.',
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
      return sendError(
        res,
        'No active library session found.',
        404,
        'NO_ACTIVE_ATTENDANCE'
      );
    }

    const entryTime = activeSession.entryTime;
    const durationMinutes = Math.max(1, Math.round((now.getTime() - entryTime.getTime()) / 60000));
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const durationString = `${hours}h ${mins < 10 ? '0' : ''}${mins}m`;

    await Attendance.findByIdAndUpdate(activeSession._id, { durationMinutes });

    // Release seat to AVAILABLE
    if (activeSession.seatId) {
      await Seat.findByIdAndUpdate(activeSession.seatId, {
        status: 'AVAILABLE',
        currentStudentId: null,
        currentStudentName: '',
        currentAttendanceId: null,
      });
    }

    // Update student state
    await User.findByIdAndUpdate(student._id, {
      $set: {
        isCurrentlyInside: false,
        lastExitTime: now,
      },
      $unset: {
        currentSeatNumber: 1,
      },
    });

    return sendSuccess(
      res,
      {
        type: 'EXIT',
        attendanceId: activeSession._id,
        studentName: student.name,
        studentIdNumber: student.studentIdNumber || 'N/A',
        seatNumber: activeSession.seatNumber,
        date: formatISTDateDisplay(now, true),
        entryTime,
        exitTime: now,
        durationMinutes,
        durationString,
      },
      'Exit Marked Successfully',
      200
    );
  } catch (error) {
    next(error);
  }
};

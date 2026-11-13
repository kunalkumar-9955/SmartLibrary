import { Request, Response, NextFunction } from 'express';
import { Seat, SeatStatus } from '../models/Seat';
import { User } from '../models/User';
import { StudentPersonalQr } from '../models/StudentPersonalQr';
import { sendSuccess, sendError } from '../utils/response';
import { logAdminAction } from '../services/auditService';

export const getSeats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let seats = await Seat.find().sort({ seatNumber: 1 });

    // Auto-initialize 50 seats if not yet populated
    if (seats.length === 0) {
      const docs = [];
      for (let i = 1; i <= 50; i++) {
        const numStr = i < 10 ? `0${i}` : `${i}`;
        docs.push({
          seatNumber: numStr,
          status: 'AVAILABLE' as SeatStatus,
        });
      }
      seats = await Seat.insertMany(docs);
    }

    // Fetch assigned students for all seats
    const assignedStudents = await User.find({
      role: 'STUDENT',
      assignedSeatNumber: { $exists: true, $ne: '' },
    })
      .select('name email phone studentIdNumber assignedSeatNumber status isCurrentlyInside')
      .lean();

    const assignedMap = new Map<string, any>();
    assignedStudents.forEach((st) => {
      if (st.assignedSeatNumber) {
        assignedMap.set(st.assignedSeatNumber, st);
      }
    });

    const enrichedSeats = seats.map((s) => {
      const sObj = s.toObject ? s.toObject() : s;
      const assigned = assignedMap.get(sObj.seatNumber);
      return {
        ...sObj,
        assignedStudent: assigned
          ? {
              _id: assigned._id,
              name: assigned.name,
              email: assigned.email,
              phone: assigned.phone,
              studentIdNumber: assigned.studentIdNumber,
              status: assigned.status,
              isCurrentlyInside: assigned.isCurrentlyInside,
            }
          : null,
      };
    });

    const summary = {
      total: enrichedSeats.length,
      available: enrichedSeats.filter((s) => s.status === 'AVAILABLE').length,
      occupied: enrichedSeats.filter((s) => s.status === 'OCCUPIED').length,
      maintenance: enrichedSeats.filter((s) => s.status === 'MAINTENANCE').length,
      assignedCount: assignedStudents.length,
      vacantCount: enrichedSeats.length - assignedStudents.length,
    };

    return sendSuccess(res, { seats: enrichedSeats, summary });
  } catch (error) {
    next(error);
  }
};

export const updateSeatStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'].includes(status)) {
      return sendError(res, 'Status must be AVAILABLE, OCCUPIED, or MAINTENANCE', 400);
    }

    // Atomically ensure we do not overwrite an actively OCCUPIED seat unless keeping it occupied
    const filter: any = { _id: id };
    if (status !== 'OCCUPIED') {
      filter.status = { $ne: 'OCCUPIED' };
    }

    const updateDoc: any = { status };
    if (notes !== undefined) updateDoc.notes = notes;

    const seat = await Seat.findOneAndUpdate(filter, { $set: updateDoc }, { new: true });

    if (!seat) {
      const exists = await Seat.findById(id);
      if (!exists) {
        return sendError(res, 'Seat not found', 404);
      }
      return sendError(
        res,
        'Cannot change status of currently occupied seat. Please check out the student first.',
        400
      );
    }

    return sendSuccess(res, seat, 'Seat status updated');
  } catch (error) {
    next(error);
  }
};

export const assignSeat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId, seatNumber } = req.body;
    const adminId = req.user?.id;
    const adminEmail = req.user?.email || 'admin@lakshyalibrary.com';
    const adminName = req.user?.name || 'Library Admin';

    if (!studentId || !seatNumber) {
      return sendError(res, 'Student ID and Seat Number are required', 400);
    }

    const parsedNum = parseInt(String(seatNumber).trim(), 10);
    if (isNaN(parsedNum) || parsedNum < 1 || parsedNum > 50) {
      return sendError(res, 'Seat Number must be between 01 and 50', 400);
    }
    const cleanSeat = parsedNum < 10 ? `0${parsedNum}` : `${parsedNum}`;

    const student = await User.findById(studentId);
    if (!student || student.role !== 'STUDENT') {
      return sendError(res, 'Student not found', 404);
    }
    if (student.status !== 'ACTIVE') {
      return sendError(res, 'Cannot assign seat to an inactive student', 400);
    }

    // Check if target seat is under maintenance
    const targetSeat = await Seat.findOne({ seatNumber: cleanSeat });
    if (targetSeat && targetSeat.status === 'MAINTENANCE') {
      return sendError(res, `Seat ${cleanSeat} is currently under maintenance`, 409);
    }

    // Check if another active student is already assigned this seat
    const alreadyAssigned = await User.findOne({
      _id: { $ne: student._id },
      role: 'STUDENT',
      status: 'ACTIVE',
      assignedSeatNumber: cleanSeat,
    });
    if (alreadyAssigned) {
      return sendError(res, `Seat ${cleanSeat} is already assigned to ${alreadyAssigned.name}`, 409);
    }

    const oldSeatNumber = student.assignedSeatNumber;

    // Atomically release old physical seat if occupied by this student
    if (oldSeatNumber && oldSeatNumber !== cleanSeat) {
      await Seat.findOneAndUpdate(
        { seatNumber: oldSeatNumber, currentStudentId: student._id },
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

    // Update student assigned seat
    student.assignedSeatNumber = cleanSeat;
    await student.save();

    // Synchronize StudentPersonalQr card
    await StudentPersonalQr.updateMany(
      { studentId: student._id, status: 'ACTIVE' },
      { $set: { assignedSeatNumber: cleanSeat } }
    );

    // Audit log
    await logAdminAction({
      adminId,
      adminEmail,
      adminName,
      action: oldSeatNumber ? 'SEAT_CHANGED' : 'SEAT_ASSIGNED',
      targetId: student._id,
      targetName: student.name,
      targetType: 'SEAT',
      details: {
        studentId: student._id,
        studentName: student.name,
        oldSeatNumber,
        newSeatNumber: cleanSeat,
      },
    });

    return sendSuccess(res, { student, seatNumber: cleanSeat }, `Seat ${cleanSeat} assigned to ${student.name}`);
  } catch (error) {
    next(error);
  }
};

export const releaseSeat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { seatNumber } = req.body;
    const adminId = req.user?.id;
    const adminEmail = req.user?.email || 'admin@lakshyalibrary.com';
    const adminName = req.user?.name || 'Library Admin';

    if (!seatNumber) {
      return sendError(res, 'Seat Number is required', 400);
    }
    const cleanSeat = String(seatNumber).trim();

    // 1. Release physical seat
    await Seat.findOneAndUpdate(
      { seatNumber: cleanSeat },
      {
        $set: {
          status: 'AVAILABLE',
          currentStudentId: null,
          currentStudentName: '',
          currentAttendanceId: null,
        },
      }
    );

    // 2. Clear assignment from student if any
    const student = await User.findOne({ assignedSeatNumber: cleanSeat });
    if (student) {
      student.assignedSeatNumber = undefined;
      await student.save();

      await StudentPersonalQr.updateMany(
        { studentId: student._id, status: 'ACTIVE' },
        { $set: { assignedSeatNumber: '' } }
      );
    }

    // Audit log
    await logAdminAction({
      adminId,
      adminEmail,
      adminName,
      action: 'SEAT_RELEASED',
      targetType: 'SEAT',
      details: {
        seatNumber: cleanSeat,
        releasedFromStudentId: student?._id,
        releasedFromStudentName: student?.name,
      },
    });

    return sendSuccess(res, { seatNumber: cleanSeat }, `Seat ${cleanSeat} released and marked vacant`);
  } catch (error) {
    next(error);
  }
};

import mongoose from 'mongoose';
import { Attendance } from '../models/Attendance';
import { Seat } from '../models/Seat';
import { User } from '../models/User';
import { deriveFixedSeatNumber } from '../utils/seatHelper';

export interface ReconciliationReport {
  timestamp: string;
  totalActiveBefore: number;
  duplicateSessionsClosed: number;
  seatsReconciledToFixed: number;
  conflictsReported: string[];
  totalActiveAfter: number;
  occupiedSeatsCount: number;
}

/**
 * Safely reconciles active attendance records and physical seat allocations.
 * Preserves historical data completely — NEVER deletes completed attendance.
 * Fixes duplicate active sessions and maps active students to their fixed seat (01-50).
 */
export const reconcileActiveAttendanceAndSeats = async (): Promise<ReconciliationReport> => {
  const report: ReconciliationReport = {
    timestamp: new Date().toISOString(),
    totalActiveBefore: 0,
    duplicateSessionsClosed: 0,
    seatsReconciledToFixed: 0,
    conflictsReported: [],
    totalActiveAfter: 0,
    occupiedSeatsCount: 0,
  };

  try {
    // 1. Ensure exactly 50 seats exist in DB
    const existingSeatCount = await Seat.countDocuments();
    if (existingSeatCount < 50) {
      for (let i = 1; i <= 50; i++) {
        const numStr = i < 10 ? `0${i}` : `${i}`;
        const exists = await Seat.exists({ seatNumber: numStr });
        if (!exists) {
          await Seat.create({ seatNumber: numStr, status: 'AVAILABLE' });
        }
      }
    }

    // 2. Fetch all currently ACTIVE attendance sessions
    const activeRecords = await Attendance.find({ status: 'ACTIVE' })
      .populate('studentId', 'name studentIdNumber assignedSeatNumber isCurrentlyInside')
      .sort({ entryTime: -1 });

    report.totalActiveBefore = activeRecords.length;

    // 3. Detect and close duplicate active sessions per student
    const studentSessionsMap = new Map<string, typeof activeRecords>();
    for (const record of activeRecords) {
      const studentIdStr = (record.studentId as any)?._id?.toString() || record.studentId?.toString();
      if (!studentIdStr) continue;

      if (!studentSessionsMap.has(studentIdStr)) {
        studentSessionsMap.set(studentIdStr, []);
      }
      studentSessionsMap.get(studentIdStr)!.push(record);
    }

    const validActiveSessions: typeof activeRecords = [];

    for (const [studentIdStr, sessions] of studentSessionsMap.entries()) {
      if (sessions.length === 1) {
        validActiveSessions.push(sessions[0]);
      } else {
        // Student has multiple active sessions (invalid state)
        const student = sessions[0].studentId as any;
        const fixedSeat = deriveFixedSeatNumber(student || {});

        // Pick primary session: prefer one matching fixed seat, or newest
        let primaryIndex = sessions.findIndex((s) => s.seatNumber === fixedSeat);
        if (primaryIndex === -1) {
          primaryIndex = 0; // newest entryTime
        }

        const primarySession = sessions[primaryIndex];
        validActiveSessions.push(primarySession);

        // Close redundant active sessions safely without deletion
        const now = new Date();
        for (let i = 0; i < sessions.length; i++) {
          if (i === primaryIndex) continue;
          const dup = sessions[i];
          const duration = Math.max(1, Math.round((now.getTime() - dup.entryTime.getTime()) / 60000));

          await Attendance.findByIdAndUpdate(dup._id, {
            status: 'COMPLETED',
            exitTime: now,
            exitMethod: 'MANUAL',
            durationMinutes: duration,
          });

          // If this duplicate claimed a seat different from primary, free it
          if (dup.seatId && String(dup.seatId) !== String(primarySession.seatId)) {
            await Seat.findByIdAndUpdate(dup.seatId, {
              status: 'AVAILABLE',
              currentStudentId: null,
              currentStudentName: '',
              currentAttendanceId: null,
            });
          }

          report.duplicateSessionsClosed++;
          console.log(
            `[Reconcile] Safely completed duplicate active session ${dup._id} for student ${student?.name || studentIdStr}`
          );
        }
      }
    }

    // 4. Reconcile valid active sessions to student's FIXED seat
    for (const session of validActiveSessions) {
      const student = session.studentId as any;
      if (!student) continue;

      const fixedSeatNumber = deriveFixedSeatNumber(student);
      if (!fixedSeatNumber) {
        report.conflictsReported.push(`Student ${student.name} (${student.studentIdNumber}) has no determinable fixed seat.`);
        continue;
      }

      if (session.seatNumber !== fixedSeatNumber) {
        // Active session is in wrong seat (e.g. LSL-22 in Seat 02 instead of Seat 22)
        const targetSeat = await Seat.findOne({ seatNumber: fixedSeatNumber });
        if (
          targetSeat &&
          (targetSeat.status === 'AVAILABLE' ||
            !targetSeat.currentStudentId ||
            String(targetSeat.currentStudentId) === String(student._id))
        ) {
          // Free old mismatched seat
          if (session.seatId) {
            await Seat.findByIdAndUpdate(session.seatId, {
              status: 'AVAILABLE',
              currentStudentId: null,
              currentStudentName: '',
              currentAttendanceId: null,
            });
          }

          // Occupy student's true fixed seat
          targetSeat.status = 'OCCUPIED';
          targetSeat.currentStudentId = student._id;
          targetSeat.currentStudentName = student.name;
          targetSeat.currentAttendanceId = session._id as any;
          await targetSeat.save();

          session.seatNumber = fixedSeatNumber;
          session.seatId = targetSeat._id as any;
          await session.save();

          await User.findByIdAndUpdate(student._id, {
            currentSeatNumber: fixedSeatNumber,
            isCurrentlyInside: true,
          });

          report.seatsReconciledToFixed++;
          console.log(
            `[Reconcile] Reassigned active session for ${student.name} (${student.studentIdNumber}) from wrong seat to fixed Seat ${fixedSeatNumber}`
          );
        } else {
          const conflictMsg = `Conflict for student ${student.name} (${student.studentIdNumber}): Fixed seat ${fixedSeatNumber} is currently occupied by another active student. Preserved existing allocation without overwriting.`;
          report.conflictsReported.push(conflictMsg);
          console.warn(`[Reconcile Warning] ${conflictMsg}`);
        }
      } else {
        // Seat number matches fixed seat. Ensure Seat document is synchronized.
        await Seat.findOneAndUpdate(
          { seatNumber: fixedSeatNumber },
          {
            $set: {
              status: 'OCCUPIED',
              currentStudentId: student._id,
              currentStudentName: student.name,
              currentAttendanceId: session._id,
            },
          }
        );
      }
    }

    // 5. Clean up any phantom occupied seats whose active attendance no longer exists
    const activeAttendanceIds = validActiveSessions.map((s) => s._id.toString());
    const occupiedSeats = await Seat.find({ status: 'OCCUPIED' });

    for (const seat of occupiedSeats) {
      const attIdStr = seat.currentAttendanceId ? seat.currentAttendanceId.toString() : '';
      if (!attIdStr || !activeAttendanceIds.includes(attIdStr)) {
        await Seat.findByIdAndUpdate(seat._id, {
          status: 'AVAILABLE',
          currentStudentId: null,
          currentStudentName: '',
          currentAttendanceId: null,
        });
        console.log(`[Reconcile] Released orphan occupied seat: ${seat.seatNumber}`);
      }
    }

    // 6. Synchronize User.isCurrentlyInside flags and currentSeatNumber with single source of truth
    const activeStudentIds = validActiveSessions.map((s) =>
      (s.studentId as any)?._id?.toString() || s.studentId?.toString()
    );

    // Synchronize each active student's seatNumber from their active session
    for (const session of validActiveSessions) {
      const sId = (session.studentId as any)?._id || session.studentId;
      if (sId) {
        await User.findByIdAndUpdate(sId, {
          $set: {
            isCurrentlyInside: true,
            currentSeatNumber: session.seatNumber,
          },
        });
      }
    }

    // Reset all other students to outside with no seat
    await User.updateMany(
      { role: 'STUDENT', _id: { $nin: activeStudentIds } },
      { $set: { isCurrentlyInside: false, currentSeatNumber: undefined } }
    );

    // 7. Synchronize unique partial index in MongoDB to guarantee 1 active session per student
    try {
      await Attendance.syncIndexes();
      console.log('[Reconcile] Attendance indexes synchronized successfully.');
    } catch (idxErr: any) {
      console.warn('[Reconcile Index Sync Notice]:', idxErr?.message);
    }

    report.totalActiveAfter = validActiveSessions.length;
    report.occupiedSeatsCount = await Seat.countDocuments({ status: 'OCCUPIED' });

    console.log(
      `[Reconciliation Complete] Active: ${report.totalActiveAfter} | Occupied Seats: ${report.occupiedSeatsCount} | Duplicates Closed: ${report.duplicateSessionsClosed} | Reconciled Seats: ${report.seatsReconciledToFixed}`
    );
  } catch (err: any) {
    console.error('[Reconciliation Error]', err);
    report.conflictsReported.push(`Fatal reconciliation error: ${err.message}`);
  }

  return report;
};

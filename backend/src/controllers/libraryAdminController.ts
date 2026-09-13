import { Request, Response, NextFunction } from 'express';
import { Attendance } from '../models/Attendance';
import { Seat } from '../models/Seat';
import { Ticket } from '../models/Ticket';
import { User } from '../models/User';
import { sendSuccess } from '../utils/response';

export const getLibraryAdminDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      todayAttendance,
      currentlyInside,
      availableSeats,
      occupiedSeats,
      openTickets,
      totalStudents,
    ] = await Promise.all([
      Attendance.countDocuments({ entryTime: { $gte: todayStart } }),
      Attendance.countDocuments({ status: 'ACTIVE' }),
      Seat.countDocuments({ status: 'AVAILABLE' }),
      Seat.countDocuments({ status: 'OCCUPIED' }),
      Ticket.countDocuments({ status: { $in: ['OPEN', 'IN_PROGRESS'] } }),
      User.countDocuments({ role: 'STUDENT' }),
    ]);

    // Live currently inside students (first 10 for quick glance)
    const activeSessions = await Attendance.find({ status: 'ACTIVE' })
      .populate('studentId', 'name email phone studentIdNumber avatar')
      .sort({ entryTime: -1 })
      .limit(10);

    const formattedActive = activeSessions.map((session: any) => {
      const entryTimeMs = new Date(session.entryTime).getTime();
      const elapsedMinutes = Math.floor((Date.now() - entryTimeMs) / 60000);
      const hours = Math.floor(elapsedMinutes / 60);
      const mins = elapsedMinutes % 60;
      return {
        _id: session._id,
        studentName: session.studentId?.name || session.studentName || 'Student',
        studentIdNumber: session.studentId?.studentIdNumber || session.studentIdNumber || 'N/A',
        studentEmail: session.studentId?.email,
        studentPhone: session.studentId?.phone,
        avatar: session.studentId?.avatar,
        seatNumber: session.seatNumber || 'N/A',
        entryTime: session.entryTime,
        durationString: `${hours}h ${mins < 10 ? '0' : ''}${mins}m`,
        durationMinutes: elapsedMinutes,
      };
    });

    // Recent tickets
    const recentTickets = await Ticket.find()
      .populate('studentId', 'name studentIdNumber')
      .sort({ createdAt: -1 })
      .limit(5);

    return sendSuccess(res, {
      metrics: {
        todayAttendance,
        currentlyInside,
        availableSeats,
        occupiedSeats,
        openTickets,
        totalStudents,
      },
      liveOccupancy: formattedActive,
      recentTickets,
    });
  } catch (error) {
    next(error);
  }
};

export const getLiveOccupancy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = (req.query.search as string) || '';

    const sessions = await Attendance.find({ status: 'ACTIVE' })
      .populate('studentId', 'name email phone studentIdNumber avatar')
      .sort({ entryTime: -1 });

    let formatted = sessions.map((session: any) => {
      const entryTimeMs = new Date(session.entryTime).getTime();
      const elapsedMinutes = Math.floor((Date.now() - entryTimeMs) / 60000);
      const hours = Math.floor(elapsedMinutes / 60);
      const mins = elapsedMinutes % 60;
      return {
        attendanceId: session._id,
        studentId: session.studentId?._id,
        studentName: session.studentId?.name || session.studentName || 'Unknown',
        studentIdNumber: session.studentId?.studentIdNumber || session.studentIdNumber || 'N/A',
        studentEmail: session.studentId?.email,
        studentPhone: session.studentId?.phone,
        avatar: session.studentId?.avatar,
        seatNumber: session.seatNumber || 'N/A',
        entryTime: session.entryTime,
        duration: `${hours}h ${mins < 10 ? '0' : ''}${mins}m`,
        durationMinutes: elapsedMinutes,
      };
    });

    if (search) {
      const s = search.toLowerCase();
      formatted = formatted.filter(
        (item) =>
          item.studentName.toLowerCase().includes(s) ||
          item.seatNumber.toLowerCase().includes(s) ||
          item.studentIdNumber.toLowerCase().includes(s) ||
          (item.studentEmail && item.studentEmail.toLowerCase().includes(s))
      );
    }

    return sendSuccess(res, formatted);
  } catch (error) {
    next(error);
  }
};


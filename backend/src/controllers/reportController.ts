import { Request, Response, NextFunction } from 'express';
import { Attendance } from '../models/Attendance';
import { Ticket } from '../models/Ticket';
import { Seat } from '../models/Seat';
import { User } from '../models/User';
import { sendSuccess } from '../utils/response';

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    const [
      totalStudents,
      todayEntries,
      currentlyInside,
      availableSeats,
      occupiedSeats,
      openTickets,
      recentTickets,
      recentAttendance,
    ] = await Promise.all([
      User.countDocuments({ role: 'STUDENT' }),
      Attendance.countDocuments({ attendanceDate: todayStr }),
      Attendance.countDocuments({ status: 'ACTIVE' }),
      Seat.countDocuments({ status: 'AVAILABLE' }),
      Seat.countDocuments({ status: 'OCCUPIED' }),
      Ticket.countDocuments({ status: { $in: ['OPEN', 'IN_PROGRESS'] } }),
      Ticket.find().sort({ createdAt: -1 }).limit(5),
      Attendance.find().sort({ entryTime: -1 }).limit(5),
    ]);

    return sendSuccess(res, {
      metrics: {
        totalStudents,
        todayEntries,
        currentlyInside,
        availableSeats,
        occupiedSeats,
        openTickets,
      },
      recentTickets,
      recentAttendance,
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const [attendanceRecords, tickets, seats] = await Promise.all([
      Attendance.find({ entryTime: { $gte: startDate } }),
      Ticket.find(),
      Seat.find(),
    ]);

    // Group attendance by date
    const dailyMap: Record<string, { date: string; count: number }> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      const display = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyMap[key] = { date: display, count: 0 };
    }

    let totalDurationMinutes = 0;
    let completedCount = 0;

    attendanceRecords.forEach((att) => {
      const key = att.attendanceDate || att.entryTime.toISOString().split('T')[0];
      if (dailyMap[key]) {
        dailyMap[key].count++;
      }
      if (att.durationMinutes) {
        totalDurationMinutes += att.durationMinutes;
        completedCount++;
      }
    });

    const attendanceTrend = Object.values(dailyMap);
    const avgDurationHours =
      completedCount > 0 ? (totalDurationMinutes / (completedCount * 60)).toFixed(1) : '0.0';

    // Complaints breakdown
    const categoryCounts: Record<string, number> = {};
    tickets.forEach((t) => {
      categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
    });
    const categoryData = Object.entries(categoryCounts).map(([name, value]) => ({ name, value }));

    // Seat breakdown
    const seatSummary = {
      available: seats.filter((s) => s.status === 'AVAILABLE').length,
      occupied: seats.filter((s) => s.status === 'OCCUPIED').length,
      maintenance: seats.filter((s) => s.status === 'MAINTENANCE').length,
    };

    return sendSuccess(res, {
      attendanceTrend,
      categoryData,
      seatSummary,
      summary: {
        totalEntries: attendanceRecords.length,
        avgDurationHours,
        totalComplaints: tickets.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

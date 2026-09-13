"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminReports = exports.getDashboardStats = void 0;
const Attendance_1 = require("../models/Attendance");
const Ticket_1 = require("../models/Ticket");
const Seat_1 = require("../models/Seat");
const User_1 = require("../models/User");
const response_1 = require("../utils/response");
const getDashboardStats = async (req, res, next) => {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const [totalStudents, todayEntries, currentlyInside, availableSeats, occupiedSeats, openTickets, recentTickets, recentAttendance,] = await Promise.all([
            User_1.User.countDocuments({ role: 'STUDENT' }),
            Attendance_1.Attendance.countDocuments({ attendanceDate: todayStr }),
            Attendance_1.Attendance.countDocuments({ status: 'ACTIVE' }),
            Seat_1.Seat.countDocuments({ status: 'AVAILABLE' }),
            Seat_1.Seat.countDocuments({ status: 'OCCUPIED' }),
            Ticket_1.Ticket.countDocuments({ status: { $in: ['OPEN', 'IN_PROGRESS'] } }),
            Ticket_1.Ticket.find().sort({ createdAt: -1 }).limit(5),
            Attendance_1.Attendance.find().sort({ entryTime: -1 }).limit(5),
        ]);
        return (0, response_1.sendSuccess)(res, {
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
    }
    catch (error) {
        next(error);
    }
};
exports.getDashboardStats = getDashboardStats;
const getAdminReports = async (req, res, next) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);
        const [attendanceRecords, tickets, seats] = await Promise.all([
            Attendance_1.Attendance.find({ entryTime: { $gte: startDate } }),
            Ticket_1.Ticket.find(),
            Seat_1.Seat.find(),
        ]);
        // Group attendance by date
        const dailyMap = {};
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
        const avgDurationHours = completedCount > 0 ? (totalDurationMinutes / (completedCount * 60)).toFixed(1) : '0.0';
        // Complaints breakdown
        const categoryCounts = {};
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
        return (0, response_1.sendSuccess)(res, {
            attendanceTrend,
            categoryData,
            seatSummary,
            summary: {
                totalEntries: attendanceRecords.length,
                avgDurationHours,
                totalComplaints: tickets.length,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAdminReports = getAdminReports;

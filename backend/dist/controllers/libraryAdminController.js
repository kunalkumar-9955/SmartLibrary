"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLiveOccupancy = exports.getLibraryAdminDashboard = void 0;
const Attendance_1 = require("../models/Attendance");
const Seat_1 = require("../models/Seat");
const Ticket_1 = require("../models/Ticket");
const User_1 = require("../models/User");
const response_1 = require("../utils/response");
const getLibraryAdminDashboard = async (req, res, next) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const [todayAttendance, currentlyInside, availableSeats, occupiedSeats, openTickets, totalStudents,] = await Promise.all([
            Attendance_1.Attendance.countDocuments({ entryTime: { $gte: todayStart } }),
            Attendance_1.Attendance.countDocuments({ status: 'ACTIVE' }),
            Seat_1.Seat.countDocuments({ status: 'AVAILABLE' }),
            Seat_1.Seat.countDocuments({ status: 'OCCUPIED' }),
            Ticket_1.Ticket.countDocuments({ status: { $in: ['OPEN', 'IN_PROGRESS'] } }),
            User_1.User.countDocuments({ role: 'STUDENT' }),
        ]);
        // Live currently inside students (first 10 for quick glance)
        const activeSessions = await Attendance_1.Attendance.find({ status: 'ACTIVE' })
            .populate('studentId', 'name email phone studentIdNumber avatar')
            .sort({ entryTime: -1 })
            .limit(10);
        const formattedActive = activeSessions.map((session) => {
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
        const recentTickets = await Ticket_1.Ticket.find()
            .populate('studentId', 'name studentIdNumber')
            .sort({ createdAt: -1 })
            .limit(5);
        return (0, response_1.sendSuccess)(res, {
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
    }
    catch (error) {
        next(error);
    }
};
exports.getLibraryAdminDashboard = getLibraryAdminDashboard;
const getLiveOccupancy = async (req, res, next) => {
    try {
        const search = req.query.search || '';
        const sessions = await Attendance_1.Attendance.find({ status: 'ACTIVE' })
            .populate('studentId', 'name email phone studentIdNumber avatar')
            .sort({ entryTime: -1 });
        let formatted = sessions.map((session) => {
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
            formatted = formatted.filter((item) => item.studentName.toLowerCase().includes(s) ||
                item.seatNumber.toLowerCase().includes(s) ||
                item.studentIdNumber.toLowerCase().includes(s) ||
                (item.studentEmail && item.studentEmail.toLowerCase().includes(s)));
        }
        return (0, response_1.sendSuccess)(res, formatted);
    }
    catch (error) {
        next(error);
    }
};
exports.getLiveOccupancy = getLiveOccupancy;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllAttendance = exports.getMyAttendanceHistory = exports.forceCheckout = exports.getCurrentlyInside = exports.markExitAttendance = exports.markEntryAttendance = void 0;
const Attendance_1 = require("../models/Attendance");
const Seat_1 = require("../models/Seat");
const User_1 = require("../models/User");
const qrCrypto_1 = require("../utils/qrCrypto");
const response_1 = require("../utils/response");
const markEntryAttendance = async (req, res, next) => {
    try {
        const studentUserId = req.user?.id;
        const { qrPayload, preferredSeatNumber } = req.body;
        if (!studentUserId) {
            return (0, response_1.sendError)(res, 'Unauthorized student request', 401);
        }
        if (!qrPayload) {
            return (0, response_1.sendError)(res, 'QR Code payload is required', 400);
        }
        // Validate QR structure, signature, expiry, and type
        const qrValidation = (0, qrCrypto_1.validateDynamicQR)(qrPayload, 'ENTRY');
        if (!qrValidation.isValid) {
            return (0, response_1.sendError)(res, qrValidation.error || 'Invalid attendance QR.', 400, 'INVALID_QR');
        }
        const student = await User_1.User.findById(studentUserId);
        if (!student) {
            return (0, response_1.sendError)(res, 'Student account not found', 404);
        }
        if (student.status !== 'ACTIVE') {
            return (0, response_1.sendError)(res, 'Your student account is inactive or blocked. Please contact admin.', 403, 'ACCOUNT_INACTIVE');
        }
        // Rule 1 & Rule 5: Check if student is already inside
        const existingActive = await Attendance_1.Attendance.findOne({
            studentId: student._id,
            status: 'ACTIVE',
        });
        if (existingActive || student.isCurrentlyInside) {
            return (0, response_1.sendError)(res, 'You are already marked inside the library.', 409, 'ALREADY_INSIDE');
        }
        // Seat Assignment
        let assignedSeat = null;
        if (preferredSeatNumber) {
            const formattedNum = preferredSeatNumber.toString().padStart(2, '0');
            assignedSeat = await Seat_1.Seat.findOne({
                seatNumber: formattedNum,
                status: 'AVAILABLE',
            });
        }
        if (!assignedSeat) {
            // Find the first available seat from 01 to 50
            assignedSeat = await Seat_1.Seat.findOne({ status: 'AVAILABLE' }).sort({ seatNumber: 1 });
        }
        if (!assignedSeat) {
            return (0, response_1.sendError)(res, 'All 50 seats are currently occupied. Please wait for an available seat.', 409, 'NO_SEATS_AVAILABLE');
        }
        const now = new Date();
        const attendanceDate = now.toISOString().split('T')[0];
        // Create attendance record
        const attendance = new Attendance_1.Attendance({
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
        assignedSeat.currentStudentId = student._id;
        assignedSeat.currentStudentName = student.name;
        assignedSeat.currentAttendanceId = attendance._id;
        await assignedSeat.save();
        // Update student state
        student.isCurrentlyInside = true;
        student.currentSeatNumber = assignedSeat.seatNumber;
        student.lastEntryTime = now;
        await student.save();
        return (0, response_1.sendSuccess)(res, {
            attendanceId: attendance._id,
            studentName: student.name,
            date: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }),
            entryTime: now,
            seatNumber: assignedSeat.seatNumber,
        }, 'Entry Attendance Marked Successfully', 201);
    }
    catch (error) {
        next(error);
    }
};
exports.markEntryAttendance = markEntryAttendance;
const markExitAttendance = async (req, res, next) => {
    try {
        const studentUserId = req.user?.id;
        const { qrPayload } = req.body;
        if (!studentUserId) {
            return (0, response_1.sendError)(res, 'Unauthorized student request', 401);
        }
        if (!qrPayload) {
            return (0, response_1.sendError)(res, 'QR Code payload is required', 400);
        }
        // Validate EXIT QR
        const qrValidation = (0, qrCrypto_1.validateDynamicQR)(qrPayload, 'EXIT');
        if (!qrValidation.isValid) {
            return (0, response_1.sendError)(res, qrValidation.error || 'Invalid attendance QR.', 400, 'INVALID_QR');
        }
        const student = await User_1.User.findById(studentUserId);
        if (!student) {
            return (0, response_1.sendError)(res, 'Student account not found', 404);
        }
        // Rule 2: Cannot mark exit without an active entry
        const activeSession = await Attendance_1.Attendance.findOne({
            studentId: student._id,
            status: 'ACTIVE',
        });
        if (!activeSession) {
            return (0, response_1.sendError)(res, 'No active attendance found.', 404, 'NO_ACTIVE_ATTENDANCE');
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
            await Seat_1.Seat.findByIdAndUpdate(activeSession.seatId, {
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
        return (0, response_1.sendSuccess)(res, {
            entryTime,
            exitTime,
            durationMinutes,
            durationString,
        }, 'Exit Attendance Marked Successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.markExitAttendance = markExitAttendance;
const getCurrentlyInside = async (req, res, next) => {
    try {
        const search = req.query.search || '';
        const activeSessions = await Attendance_1.Attendance.find({ status: 'ACTIVE' })
            .populate('studentId', 'name email phone studentIdNumber avatar')
            .sort({ entryTime: -1 });
        let list = activeSessions.map((s) => {
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
            list = list.filter((item) => item.studentName.toLowerCase().includes(q) ||
                item.seatNumber.toLowerCase().includes(q) ||
                item.studentIdNumber.toLowerCase().includes(q));
        }
        return (0, response_1.sendSuccess)(res, list);
    }
    catch (error) {
        next(error);
    }
};
exports.getCurrentlyInside = getCurrentlyInside;
const forceCheckout = async (req, res, next) => {
    try {
        const { id } = req.params;
        const session = await Attendance_1.Attendance.findOne({ _id: id, status: 'ACTIVE' });
        if (!session) {
            return (0, response_1.sendError)(res, 'Active attendance session not found', 404);
        }
        const exitTime = new Date();
        const durationMinutes = Math.max(1, Math.round((exitTime.getTime() - session.entryTime.getTime()) / 60000));
        session.exitTime = exitTime;
        session.durationMinutes = durationMinutes;
        session.exitMethod = 'MANUAL';
        session.status = 'COMPLETED';
        await session.save();
        if (session.seatId) {
            await Seat_1.Seat.findByIdAndUpdate(session.seatId, {
                status: 'AVAILABLE',
                currentStudentId: null,
                currentStudentName: null,
                currentAttendanceId: null,
            });
        }
        await User_1.User.findByIdAndUpdate(session.studentId, {
            isCurrentlyInside: false,
            currentSeatNumber: undefined,
            lastExitTime: exitTime,
        });
        return (0, response_1.sendSuccess)(res, session, 'Student checked out successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.forceCheckout = forceCheckout;
const getMyAttendanceHistory = async (req, res, next) => {
    try {
        const studentUserId = req.user?.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const query = { studentId: studentUserId };
        const total = await Attendance_1.Attendance.countDocuments(query);
        const records = await Attendance_1.Attendance.find(query)
            .sort({ entryTime: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
        return (0, response_1.sendSuccess)(res, {
            records,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getMyAttendanceHistory = getMyAttendanceHistory;
const getAllAttendance = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const date = req.query.date || '';
        const status = req.query.status || '';
        const query = {};
        if (status)
            query.status = status;
        if (date)
            query.attendanceDate = date;
        if (search) {
            query.$or = [
                { studentName: { $regex: search, $options: 'i' } },
                { studentIdNumber: { $regex: search, $options: 'i' } },
                { seatNumber: { $regex: search, $options: 'i' } },
            ];
        }
        const total = await Attendance_1.Attendance.countDocuments(query);
        const records = await Attendance_1.Attendance.find(query)
            .populate('studentId', 'name studentIdNumber phone email avatar')
            .sort({ entryTime: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
        return (0, response_1.sendSuccess)(res, {
            records,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAllAttendance = getAllAttendance;

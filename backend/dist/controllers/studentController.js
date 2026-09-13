"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateStudentStatus = exports.updateStudent = exports.getStudentById = exports.createStudent = exports.getStudents = void 0;
const User_1 = require("../models/User");
const Attendance_1 = require("../models/Attendance");
const Ticket_1 = require("../models/Ticket");
const response_1 = require("../utils/response");
const getStudents = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const query = { role: 'STUDENT' };
        if (status)
            query.status = status;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { studentIdNumber: { $regex: search, $options: 'i' } },
            ];
        }
        const total = await User_1.User.countDocuments(query);
        const students = await User_1.User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
        return (0, response_1.sendSuccess)(res, {
            students,
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
exports.getStudents = getStudents;
const createStudent = async (req, res, next) => {
    try {
        const { name, email, password, phone, studentIdNumber, course } = req.body;
        if (!name || !email || !studentIdNumber) {
            return (0, response_1.sendError)(res, 'Name, email, and Student ID are required', 400);
        }
        const existingUser = await User_1.User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            return (0, response_1.sendError)(res, 'A student with this email address already exists', 409);
        }
        const user = await User_1.User.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password: password || 'Password@123',
            role: 'STUDENT',
            studentIdNumber: studentIdNumber.trim(),
            phone: phone?.trim(),
            course: course?.trim(),
            status: 'ACTIVE',
        });
        return (0, response_1.sendSuccess)(res, user, 'Student registered successfully', 201);
    }
    catch (error) {
        next(error);
    }
};
exports.createStudent = createStudent;
const getStudentById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const student = await User_1.User.findById(id).select('-password');
        if (!student || student.role !== 'STUDENT') {
            return (0, response_1.sendError)(res, 'Student not found', 404);
        }
        const recentAttendance = await Attendance_1.Attendance.find({ studentId: student._id })
            .sort({ entryTime: -1 })
            .limit(10);
        const recentTickets = await Ticket_1.Ticket.find({ studentId: student._id })
            .sort({ createdAt: -1 })
            .limit(5);
        return (0, response_1.sendSuccess)(res, {
            student,
            recentAttendance,
            recentTickets,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getStudentById = getStudentById;
const updateStudent = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, phone, course, studentIdNumber } = req.body;
        const student = await User_1.User.findByIdAndUpdate(id, { name, phone, course, studentIdNumber }, { new: true }).select('-password');
        if (!student) {
            return (0, response_1.sendError)(res, 'Student not found', 404);
        }
        return (0, response_1.sendSuccess)(res, student, 'Student updated successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.updateStudent = updateStudent;
const updateStudentStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['ACTIVE', 'INACTIVE', 'BLOCKED'].includes(status)) {
            return (0, response_1.sendError)(res, 'Invalid status value', 400);
        }
        const student = await User_1.User.findById(id);
        if (!student || student.role !== 'STUDENT') {
            return (0, response_1.sendError)(res, 'Student not found', 404);
        }
        student.status = status;
        await student.save();
        return (0, response_1.sendSuccess)(res, student, `Student marked as ${status}`);
    }
    catch (error) {
        next(error);
    }
};
exports.updateStudentStatus = updateStudentStatus;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdmins = exports.deleteLibrary = exports.updateLibrary = exports.createLibrary = exports.getLibraries = exports.getSuperAdminDashboard = void 0;
const Library_1 = require("../models/Library");
const User_1 = require("../models/User");
const Attendance_1 = require("../models/Attendance");
const Ticket_1 = require("../models/Ticket");
const Seat_1 = require("../models/Seat");
const AuditLog_1 = require("../models/AuditLog");
const response_1 = require("../utils/response");
const audit_1 = require("../utils/audit");
const getSuperAdminDashboard = async (req, res, next) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const [totalLibraries, activeLibraries, inactiveLibraries, totalAdmins, totalStudents, todayAttendance, currentlyInside, openTickets,] = await Promise.all([
            Library_1.Library.countDocuments(),
            Library_1.Library.countDocuments({ status: 'ACTIVE' }),
            Library_1.Library.countDocuments({ status: { $in: ['INACTIVE', 'SUSPENDED'] } }),
            User_1.User.countDocuments({ role: 'LIBRARY_ADMIN' }),
            User_1.User.countDocuments({ role: 'STUDENT' }),
            Attendance_1.Attendance.countDocuments({ entryTime: { $gte: todayStart } }),
            Attendance_1.Attendance.countDocuments({ status: 'ACTIVE' }),
            Ticket_1.Ticket.countDocuments({ status: { $in: ['OPEN', 'IN_PROGRESS'] } }),
        ]);
        // Recent library registrations
        const recentLibraries = await Library_1.Library.find()
            .populate('adminUserId', 'name email phone')
            .sort({ createdAt: -1 })
            .limit(5);
        // Recent system audit activities
        const recentAudits = await AuditLog_1.AuditLog.find()
            .sort({ createdAt: -1 })
            .limit(8);
        return (0, response_1.sendSuccess)(res, {
            metrics: {
                totalLibraries,
                activeLibraries,
                inactiveLibraries,
                totalAdmins,
                totalStudents,
                todayAttendance,
                currentlyInside,
                openTickets,
            },
            recentLibraries,
            recentAudits,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getSuperAdminDashboard = getSuperAdminDashboard;
const getLibraries = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const query = {};
        if (status)
            query.status = status;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { code: { $regex: search, $options: 'i' } },
                { city: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }
        const total = await Library_1.Library.countDocuments(query);
        const libraries = await Library_1.Library.find(query)
            .populate('adminUserId', 'name email phone status')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
        return (0, response_1.sendSuccess)(res, {
            libraries,
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
exports.getLibraries = getLibraries;
const createLibrary = async (req, res, next) => {
    try {
        const { name, code, email, phone, address, city, state, openingTime, closingTime, totalSeats, adminName, adminEmail, adminPassword, adminPhone, } = req.body;
        if (!name || !code || !email || !phone || !address || !city || !state) {
            return (0, response_1.sendError)(res, 'Required fields missing for library creation', 400);
        }
        const existing = await Library_1.Library.findOne({ code: code.toUpperCase().trim() });
        if (existing) {
            return (0, response_1.sendError)(res, `Library code ${code} is already registered`, 409);
        }
        const library = new Library_1.Library({
            name,
            code: code.toUpperCase().trim(),
            email,
            phone,
            address,
            city,
            state,
            openingTime: openingTime || '08:00 AM',
            closingTime: closingTime || '10:00 PM',
            totalSeats: totalSeats || 40,
            status: 'ACTIVE',
        });
        await library.save();
        // Optionally create Admin user if credentials passed
        if (adminEmail && adminPassword && adminName) {
            const existingUser = await User_1.User.findOne({ email: adminEmail.toLowerCase().trim() });
            let adminUser;
            if (existingUser) {
                adminUser = existingUser;
                adminUser.libraryId = library._id;
                adminUser.role = 'LIBRARY_ADMIN';
                await adminUser.save();
            }
            else {
                adminUser = await User_1.User.create({
                    name: adminName,
                    email: adminEmail.toLowerCase().trim(),
                    password: adminPassword,
                    role: 'LIBRARY_ADMIN',
                    phone: adminPhone || phone,
                    libraryId: library._id,
                    status: 'ACTIVE',
                });
            }
            library.adminUserId = adminUser._id;
            await library.save();
        }
        // Initialize default seats
        const seatCount = totalSeats || 30;
        const seatDocs = [];
        for (let i = 1; i <= seatCount; i++) {
            const section = i <= Math.ceil(seatCount / 2) ? 'A' : 'B';
            const num = i <= Math.ceil(seatCount / 2) ? i : i - Math.ceil(seatCount / 2);
            const formattedNum = num < 10 ? `0${num}` : `${num}`;
            seatDocs.push({
                libraryId: library._id,
                seatNumber: `${section}${formattedNum}`,
                floor: 1,
                section: `Section ${section}`,
                status: 'AVAILABLE',
                hasPowerOutlet: true,
            });
        }
        await Seat_1.Seat.insertMany(seatDocs);
        await (0, audit_1.logAudit)({
            actorUserId: req.user?.id,
            actorName: req.user?.name,
            actorRole: req.user?.role,
            libraryId: library._id,
            action: 'LIBRARY_CREATED',
            entityType: 'Library',
            entityId: library._id.toString(),
            metadata: { code: library.code, seats: seatCount },
        });
        return (0, response_1.sendSuccess)(res, library, 'Library created successfully with initialized seats and admin', 201);
    }
    catch (error) {
        next(error);
    }
};
exports.createLibrary = createLibrary;
const updateLibrary = async (req, res, next) => {
    try {
        const { id } = req.params;
        const library = await Library_1.Library.findByIdAndUpdate(id, req.body, { new: true });
        if (!library) {
            return (0, response_1.sendError)(res, 'Library not found', 404);
        }
        await (0, audit_1.logAudit)({
            actorUserId: req.user?.id,
            actorName: req.user?.name,
            actorRole: req.user?.role,
            libraryId: library._id,
            action: 'LIBRARY_UPDATED',
            entityType: 'Library',
            entityId: library._id.toString(),
        });
        return (0, response_1.sendSuccess)(res, library, 'Library updated successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.updateLibrary = updateLibrary;
const deleteLibrary = async (req, res, next) => {
    try {
        const { id } = req.params;
        const library = await Library_1.Library.findById(id);
        if (!library) {
            return (0, response_1.sendError)(res, 'Library not found', 404);
        }
        // Set suspended or inactive instead of hard deleting records
        library.status = 'SUSPENDED';
        await library.save();
        await (0, audit_1.logAudit)({
            actorUserId: req.user?.id,
            actorName: req.user?.name,
            actorRole: req.user?.role,
            libraryId: library._id,
            action: 'LIBRARY_SUSPENDED',
            entityType: 'Library',
            entityId: library._id.toString(),
        });
        return (0, response_1.sendSuccess)(res, library, 'Library suspended successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.deleteLibrary = deleteLibrary;
const getAdmins = async (req, res, next) => {
    try {
        const admins = await User_1.User.find({ role: 'LIBRARY_ADMIN' })
            .populate('libraryId', 'name code city state')
            .select('-password')
            .sort({ createdAt: -1 });
        return (0, response_1.sendSuccess)(res, admins);
    }
    catch (error) {
        next(error);
    }
};
exports.getAdmins = getAdmins;

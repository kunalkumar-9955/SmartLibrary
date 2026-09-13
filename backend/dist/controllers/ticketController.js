"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addTicketComment = exports.updateTicketStatus = exports.getTicketById = exports.getTickets = exports.createTicket = void 0;
const Ticket_1 = require("../models/Ticket");
const User_1 = require("../models/User");
const response_1 = require("../utils/response");
const createTicket = async (req, res, next) => {
    try {
        const studentUserId = req.user?.id;
        const { category, title, description, seatNumber } = req.body;
        if (!category || !title || !description) {
            return (0, response_1.sendError)(res, 'Category, title, and description are required', 400);
        }
        const student = await User_1.User.findById(studentUserId);
        if (!student) {
            return (0, response_1.sendError)(res, 'Student account not found', 404);
        }
        let attachmentUrl = undefined;
        if (req.file) {
            attachmentUrl = `/uploads/${req.file.filename}`;
        }
        const count = await Ticket_1.Ticket.countDocuments();
        const ticketNumber = `LIB-${1000 + count + 1}`;
        const ticket = new Ticket_1.Ticket({
            ticketNumber,
            studentId: student._id,
            studentName: student.name,
            studentIdNumber: student.studentIdNumber,
            category: category,
            title: title.trim(),
            description: description.trim(),
            seatNumber: seatNumber?.trim() || student.currentSeatNumber,
            status: 'OPEN',
            attachmentUrl,
            comments: [],
        });
        await ticket.save();
        return (0, response_1.sendSuccess)(res, ticket, 'Complaint registered successfully', 201);
    }
    catch (error) {
        next(error);
    }
};
exports.createTicket = createTicket;
const getTickets = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const category = req.query.category || '';
        const query = {};
        // If student, view only their own complaints
        if (req.user?.role === 'STUDENT') {
            query.studentId = req.user.id;
        }
        if (status)
            query.status = status;
        if (category)
            query.category = category;
        if (search) {
            query.$or = [
                { ticketNumber: { $regex: search, $options: 'i' } },
                { title: { $regex: search, $options: 'i' } },
                { studentName: { $regex: search, $options: 'i' } },
                { seatNumber: { $regex: search, $options: 'i' } },
            ];
        }
        const total = await Ticket_1.Ticket.countDocuments(query);
        const tickets = await Ticket_1.Ticket.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
        return (0, response_1.sendSuccess)(res, {
            tickets,
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
exports.getTickets = getTickets;
const getTicketById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const ticket = await Ticket_1.Ticket.findById(id);
        if (!ticket) {
            return (0, response_1.sendError)(res, 'Ticket not found', 404);
        }
        if (req.user?.role === 'STUDENT' && ticket.studentId.toString() !== req.user.id) {
            return (0, response_1.sendError)(res, 'Access denied', 403);
        }
        return (0, response_1.sendSuccess)(res, ticket);
    }
    catch (error) {
        next(error);
    }
};
exports.getTicketById = getTicketById;
const updateTicketStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, resolutionNote, adminComment } = req.body;
        const ticket = await Ticket_1.Ticket.findById(id);
        if (!ticket) {
            return (0, response_1.sendError)(res, 'Ticket not found', 404);
        }
        if (status) {
            ticket.status = status;
            if (status === 'RESOLVED' || status === 'CLOSED') {
                ticket.resolvedAt = new Date();
            }
        }
        if (resolutionNote) {
            ticket.resolutionNote = resolutionNote;
        }
        if (adminComment) {
            ticket.comments.push({
                userName: req.user?.name || 'Admin',
                userRole: req.user?.role || 'ADMIN',
                comment: adminComment,
                createdAt: new Date(),
            });
        }
        await ticket.save();
        return (0, response_1.sendSuccess)(res, ticket, 'Ticket updated successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.updateTicketStatus = updateTicketStatus;
const addTicketComment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { comment } = req.body;
        if (!comment || comment.trim() === '') {
            return (0, response_1.sendError)(res, 'Comment text is required', 400);
        }
        const ticket = await Ticket_1.Ticket.findById(id);
        if (!ticket) {
            return (0, response_1.sendError)(res, 'Ticket not found', 404);
        }
        ticket.comments.push({
            userName: req.user?.name || 'User',
            userRole: req.user?.role || 'USER',
            comment: comment.trim(),
            createdAt: new Date(),
        });
        await ticket.save();
        return (0, response_1.sendSuccess)(res, ticket.comments, 'Comment added');
    }
    catch (error) {
        next(error);
    }
};
exports.addTicketComment = addTicketComment;

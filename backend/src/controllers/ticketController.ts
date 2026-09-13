import { Request, Response, NextFunction } from 'express';
import { Ticket, TicketStatus, TicketCategory } from '../models/Ticket';
import { User } from '../models/User';
import { sendSuccess, sendError } from '../utils/response';

export const createTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentUserId = req.user?.id;
    const { category, title, description, seatNumber } = req.body;

    if (!category || !title || !description) {
      return sendError(res, 'Category, title, and description are required', 400);
    }

    const student = await User.findById(studentUserId);
    if (!student) {
      return sendError(res, 'Student account not found', 404);
    }

    let attachmentUrl = undefined;
    if (req.file) {
      attachmentUrl = `/uploads/${req.file.filename}`;
    }

    const count = await Ticket.countDocuments();
    const ticketNumber = `LIB-${1000 + count + 1}`;

    const ticket = new Ticket({
      ticketNumber,
      studentId: student._id,
      studentName: student.name,
      studentIdNumber: student.studentIdNumber,
      category: category as TicketCategory,
      title: title.trim(),
      description: description.trim(),
      seatNumber: seatNumber?.trim() || student.currentSeatNumber,
      status: 'OPEN',
      attachmentUrl,
      comments: [],
    });

    await ticket.save();

    return sendSuccess(res, ticket, 'Complaint registered successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const getTickets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || '';
    const category = (req.query.category as string) || '';

    const query: any = {};

    // If student, view only their own complaints
    if (req.user?.role === 'STUDENT') {
      query.studentId = req.user.id;
    }

    if (status) query.status = status;
    if (category) query.category = category;

    if (search) {
      query.$or = [
        { ticketNumber: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { studentName: { $regex: search, $options: 'i' } },
        { seatNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Ticket.countDocuments(query);
    const tickets = await Ticket.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return sendSuccess(res, {
      tickets,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getTicketById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const ticket = await Ticket.findById(id);

    if (!ticket) {
      return sendError(res, 'Ticket not found', 404);
    }

    if (req.user?.role === 'STUDENT' && ticket.studentId.toString() !== req.user.id) {
      return sendError(res, 'Access denied', 403);
    }

    return sendSuccess(res, ticket);
  } catch (error) {
    next(error);
  }
};

export const updateTicketStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, resolutionNote, adminComment } = req.body;

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return sendError(res, 'Ticket not found', 404);
    }

    if (status) {
      ticket.status = status as TicketStatus;
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

    return sendSuccess(res, ticket, 'Ticket updated successfully');
  } catch (error) {
    next(error);
  }
};

export const addTicketComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment || comment.trim() === '') {
      return sendError(res, 'Comment text is required', 400);
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return sendError(res, 'Ticket not found', 404);
    }

    ticket.comments.push({
      userName: req.user?.name || 'User',
      userRole: req.user?.role || 'USER',
      comment: comment.trim(),
      createdAt: new Date(),
    });

    await ticket.save();

    return sendSuccess(res, ticket.comments, 'Comment added');
  } catch (error) {
    next(error);
  }
};

import { Request, Response, NextFunction } from 'express';
import { Ticket, TicketStatus, TicketCategory } from '../models/Ticket';
import { User } from '../models/User';
import { AdminNotification } from '../models/AdminNotification';
import { sendPushToUser } from '../services/pushService';
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
    const suffix = Math.floor(100 + Math.random() * 900);
    const ticketNumber = `LIB-${1000 + count + 1}-${suffix}`;
    const effectiveSeat = seatNumber?.trim() || student.currentSeatNumber || student.assignedSeatNumber || '';

    const ticket = new Ticket({
      ticketNumber,
      studentId: student._id,
      studentName: student.name,
      studentIdNumber: student.studentIdNumber,
      category: category as TicketCategory,
      title: title.trim(),
      description: description.trim(),
      seatNumber: effectiveSeat,
      status: 'OPEN',
      attachmentUrl,
      comments: [],
    });

    await ticket.save();

    // Trigger Admin Notification & Web Push (non-blocking)
    try {
      const seatInfo = effectiveSeat ? ` (Seat ${effectiveSeat})` : '';
      const notifTitle = `New Complaint: ${category}`;
      const notifMessage = `${student.name}${seatInfo} submitted ticket #${ticketNumber}: "${title.trim()}"`;

      await AdminNotification.create({
        type: 'NEW_COMPLAINT',
        title: notifTitle,
        message: notifMessage,
        relatedTicketId: ticket._id,
        relatedStudentId: student._id,
        studentName: student.name,
        seatNumber: effectiveSeat,
        isRead: false,
      });

      // Find all active admins and trigger push
      const admins = await User.find({ role: 'ADMIN', status: 'ACTIVE' }).select('_id');
      for (const admin of admins) {
        sendPushToUser(admin._id.toString(), {
          title: notifTitle,
          body: notifMessage,
          url: '/admin/tickets',
          data: {
            ticketId: ticket._id.toString(),
            ticketNumber,
          },
        }).catch((err) => {
          console.warn('[Push Notification] Push to admin skipped:', err?.message || err);
        });
      }
    } catch (notifError) {
      console.warn('[Admin Notification] Non-blocking notification creation error:', notifError);
    }

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

    // Push notification to student regarding ticket status update (non-blocking)
    try {
      if (status || resolutionNote || adminComment) {
        sendPushToUser(ticket.studentId.toString(), {
          title: `Complaint #${ticket.ticketNumber}: ${ticket.status}`,
          body: resolutionNote || adminComment || `Your complaint status has been updated to ${ticket.status}.`,
          url: '/student/tickets',
          data: { ticketId: ticket._id.toString() },
        }).catch((err) => {
          console.warn('[Push Notification] Push to student skipped:', err?.message || err);
        });
      }
    } catch (pushErr) {
      console.warn('[Push Notification] Non-blocking push error:', pushErr);
    }

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

    // Enforce cross-user data authorization: student can only comment on their own ticket
    if (req.user?.role === 'STUDENT' && ticket.studentId.toString() !== req.user.id) {
      return sendError(res, 'Access denied', 403, 'FORBIDDEN');
    }

    const newComment = {
      userName: req.user?.name || 'User',
      userRole: req.user?.role || 'USER',
      comment: comment.trim(),
      createdAt: new Date(),
    };

    // Concurrency-safe atomic $push
    const updated = await Ticket.findByIdAndUpdate(
      id,
      { $push: { comments: newComment } },
      { new: true }
    );

    // Non-blocking push notification
    try {
      if (req.user?.role === 'ADMIN') {
        // Admin commented -> notify student
        sendPushToUser(ticket.studentId.toString(), {
          title: `Update on Ticket #${ticket.ticketNumber}`,
          body: `Admin: ${comment.trim().slice(0, 100)}`,
          url: '/student/tickets',
          data: { ticketId: ticket._id.toString() },
        }).catch((err) => console.warn('Push error:', err));
      } else {
        // Student commented -> notify admin
        const admins = await User.find({ role: 'ADMIN', status: 'ACTIVE' }).select('_id');
        for (const admin of admins) {
          sendPushToUser(admin._id.toString(), {
            title: `Reply on Ticket #${ticket.ticketNumber}`,
            body: `${req.user?.name || 'Student'}: ${comment.trim().slice(0, 100)}`,
            url: '/admin/tickets',
            data: { ticketId: ticket._id.toString() },
          }).catch((err) => console.warn('Push error:', err));
        }
      }
    } catch (notifErr) {
      console.warn('Comment notification error:', notifErr);
    }

    return sendSuccess(res, updated?.comments || [], 'Comment added');
  } catch (error) {
    next(error);
  }
};

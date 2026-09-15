import { Request, Response, NextFunction } from 'express';
import { Ticket, TicketStatus, TicketCategory } from '../models/Ticket';
import { User } from '../models/User';
import { AdminNotification } from '../models/AdminNotification';
import { StudentNotification } from '../models/StudentNotification';
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

    const previousStatus = ticket.status;
    const hasStatusChanged = status && status !== previousStatus;
    const hasNewComment = Boolean(adminComment && adminComment.trim());

    if (hasStatusChanged) {
      ticket.status = status as TicketStatus;
      if (status === 'RESOLVED' || status === 'CLOSED') {
        ticket.resolvedAt = new Date();
      }
    }

    if (resolutionNote !== undefined) {
      ticket.resolutionNote = resolutionNote.trim();
    }

    if (hasNewComment) {
      ticket.comments.push({
        userName: req.user?.name || 'Admin',
        userRole: req.user?.role || 'ADMIN',
        comment: adminComment.trim(),
        createdAt: new Date(),
      });
    }

    await ticket.save();

    // 1. Notify student if status actually changed (Duplicate Protection)
    if (hasStatusChanged) {
      let notifTitle = 'Complaint Update';
      let notifMessage = `Your complaint '${ticket.title}' is now ${ticket.status}.`;

      if (ticket.status === 'IN_PROGRESS') {
        notifTitle = 'Complaint Update';
        notifMessage = 'Your complaint is now being worked on.';
      } else if (ticket.status === 'RESOLVED') {
        notifTitle = 'Complaint Resolved';
        notifMessage = ticket.resolutionNote
          ? `Your complaint '${ticket.title}' has been resolved: ${ticket.resolutionNote}`
          : `Your complaint '${ticket.title}' has been resolved.`;
      } else if (ticket.status === 'CLOSED') {
        notifTitle = 'Complaint Update';
        notifMessage = `Your complaint '${ticket.title}' has been closed.`;
      }

      // Save in-app private notification for complaint owner only
      try {
        await StudentNotification.create({
          studentId: ticket.studentId,
          type: 'COMPLAINT_STATUS',
          title: notifTitle,
          message: notifMessage,
          relatedTicketId: ticket._id,
          isRead: false,
        });
      } catch (notifErr) {
        console.warn('[Student Notification] Error saving status notification:', notifErr);
      }

      // Web Push notification to student (non-blocking, push failure will NOT rollback DB)
      try {
        sendPushToUser(ticket.studentId.toString(), {
          title: notifTitle,
          body: notifMessage,
          url: '/student/tickets',
          data: { ticketId: ticket._id.toString() },
        }).catch((err) => {
          console.warn('[Push Notification] Push to student skipped:', err?.message || err);
        });
      } catch (pushErr) {
        console.warn('[Push Notification] Non-blocking push error:', pushErr);
      }
    }

    // 2. If an admin response comment was added during status update, notify student about the reply
    if (hasNewComment && !hasStatusChanged) {
      const replyTitle = 'Complaint Update';
      const replyMessage = `Admin has replied to your complaint: ${ticket.title}.`;

      try {
        await StudentNotification.create({
          studentId: ticket.studentId,
          type: 'COMPLAINT_REPLY',
          title: replyTitle,
          message: replyMessage,
          relatedTicketId: ticket._id,
          isRead: false,
        });
      } catch (replyErr) {
        console.warn('[Student Notification] Error saving admin comment notification:', replyErr);
      }

      try {
        sendPushToUser(ticket.studentId.toString(), {
          title: replyTitle,
          body: adminComment.trim().slice(0, 120),
          url: '/student/tickets',
          data: { ticketId: ticket._id.toString() },
        }).catch((err) => {
          console.warn('[Push Notification] Push reply skipped:', err?.message || err);
        });
      } catch (pushErr) {
        console.warn('[Push Notification] Non-blocking push error:', pushErr);
      }
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
      userName: req.user?.name || (req.user?.role === 'ADMIN' ? 'Admin' : 'Student'),
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

    // Private Notifications & Push
    try {
      if (req.user?.role === 'ADMIN') {
        // Admin replied -> Notify ONLY the student who owns this ticket
        const replyTitle = 'Complaint Update';
        const replyMessage = `Admin has replied to your complaint: ${ticket.title}.`;

        await StudentNotification.create({
          studentId: ticket.studentId,
          type: 'COMPLAINT_REPLY',
          title: replyTitle,
          message: replyMessage,
          relatedTicketId: ticket._id,
          isRead: false,
        });

        sendPushToUser(ticket.studentId.toString(), {
          title: replyTitle,
          body: `Admin: ${comment.trim().slice(0, 100)}`,
          url: '/student/tickets',
          data: { ticketId: ticket._id.toString() },
        }).catch((err) => console.warn('[Push Notification] Admin reply push skipped:', err?.message || err));
      } else {
        // Student commented -> Notify admins
        const admins = await User.find({ role: 'ADMIN', status: 'ACTIVE' }).select('_id');
        for (const admin of admins) {
          sendPushToUser(admin._id.toString(), {
            title: `Reply on Ticket #${ticket.ticketNumber}`,
            body: `${req.user?.name || 'Student'}: ${comment.trim().slice(0, 100)}`,
            url: '/admin/tickets',
            data: { ticketId: ticket._id.toString() },
          }).catch((err) => console.warn('[Push Notification] Student reply push skipped:', err?.message || err));
        }
      }
    } catch (notifErr) {
      console.warn('[Comment Notification Error]:', notifErr);
    }

    return sendSuccess(res, updated?.comments || [], 'Comment added');
  } catch (error) {
    next(error);
  }
};

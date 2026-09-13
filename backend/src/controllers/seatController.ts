import { Request, Response, NextFunction } from 'express';
import { Seat, SeatStatus } from '../models/Seat';
import { sendSuccess, sendError } from '../utils/response';

export const getSeats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let seats = await Seat.find().sort({ seatNumber: 1 });

    // Auto-initialize 50 seats if not yet populated
    if (seats.length === 0) {
      const docs = [];
      for (let i = 1; i <= 50; i++) {
        const numStr = i < 10 ? `0${i}` : `${i}`;
        docs.push({
          seatNumber: numStr,
          status: 'AVAILABLE' as SeatStatus,
        });
      }
      seats = await Seat.insertMany(docs);
    }

    const summary = {
      total: seats.length,
      available: seats.filter((s) => s.status === 'AVAILABLE').length,
      occupied: seats.filter((s) => s.status === 'OCCUPIED').length,
      maintenance: seats.filter((s) => s.status === 'MAINTENANCE').length,
    };

    return sendSuccess(res, { seats, summary });
  } catch (error) {
    next(error);
  }
};

export const updateSeatStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'].includes(status)) {
      return sendError(res, 'Status must be AVAILABLE, OCCUPIED, or MAINTENANCE', 400);
    }

    const seat = await Seat.findById(id);
    if (!seat) {
      return sendError(res, 'Seat not found', 404);
    }

    if (seat.status === 'OCCUPIED' && status !== 'OCCUPIED') {
      return sendError(res, 'Cannot change status of currently occupied seat. Please check out the student first.', 400);
    }

    seat.status = status as SeatStatus;
    if (notes !== undefined) seat.notes = notes;
    await seat.save();

    return sendSuccess(res, seat, 'Seat status updated');
  } catch (error) {
    next(error);
  }
};

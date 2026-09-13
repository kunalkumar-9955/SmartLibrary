"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSeatStatus = exports.getSeats = void 0;
const Seat_1 = require("../models/Seat");
const response_1 = require("../utils/response");
const getSeats = async (req, res, next) => {
    try {
        let seats = await Seat_1.Seat.find().sort({ seatNumber: 1 });
        // Auto-initialize 50 seats if not yet populated
        if (seats.length === 0) {
            const docs = [];
            for (let i = 1; i <= 50; i++) {
                const numStr = i < 10 ? `0${i}` : `${i}`;
                docs.push({
                    seatNumber: numStr,
                    status: 'AVAILABLE',
                });
            }
            seats = await Seat_1.Seat.insertMany(docs);
        }
        const summary = {
            total: seats.length,
            available: seats.filter((s) => s.status === 'AVAILABLE').length,
            occupied: seats.filter((s) => s.status === 'OCCUPIED').length,
            maintenance: seats.filter((s) => s.status === 'MAINTENANCE').length,
        };
        return (0, response_1.sendSuccess)(res, { seats, summary });
    }
    catch (error) {
        next(error);
    }
};
exports.getSeats = getSeats;
const updateSeatStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        if (!['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'].includes(status)) {
            return (0, response_1.sendError)(res, 'Status must be AVAILABLE, OCCUPIED, or MAINTENANCE', 400);
        }
        const seat = await Seat_1.Seat.findById(id);
        if (!seat) {
            return (0, response_1.sendError)(res, 'Seat not found', 404);
        }
        if (seat.status === 'OCCUPIED' && status !== 'OCCUPIED') {
            return (0, response_1.sendError)(res, 'Cannot change status of currently occupied seat. Please check out the student first.', 400);
        }
        seat.status = status;
        if (notes !== undefined)
            seat.notes = notes;
        await seat.save();
        return (0, response_1.sendSuccess)(res, seat, 'Seat status updated');
    }
    catch (error) {
        next(error);
    }
};
exports.updateSeatStatus = updateSeatStatus;

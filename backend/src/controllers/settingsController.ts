import { Request, Response, NextFunction } from 'express';
import { Library } from '../models/Library';
import { sendSuccess } from '../utils/response';

export const getSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let settings = await Library.findOne();
    if (!settings) {
      settings = await Library.create({
        name: 'Smart Library',
        address: '42 Knowledge Park, New Delhi',
        phone: '+91 9876543210',
        email: 'admin@smartlibrary.com',
        openingTime: '08:00 AM',
        closingTime: '10:00 PM',
        totalSeats: 50,
        qrExpirySeconds: 45,
      });
    }
    return sendSuccess(res, settings);
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, address, phone, email, openingTime, closingTime, qrExpirySeconds } = req.body;

    let settings = await Library.findOne();
    if (!settings) {
      settings = new Library();
    }

    if (name) settings.name = name;
    if (address) settings.address = address;
    if (phone) settings.phone = phone;
    if (email) settings.email = email;
    if (openingTime) settings.openingTime = openingTime;
    if (closingTime) settings.closingTime = closingTime;
    if (qrExpirySeconds) settings.qrExpirySeconds = qrExpirySeconds;
    settings.totalSeats = 50; // Always 50 seats for this library

    await settings.save();
    return sendSuccess(res, settings, 'Library settings updated successfully');
  } catch (error) {
    next(error);
  }
};

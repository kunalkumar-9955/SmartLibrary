import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { sendSuccess, sendError } from '../utils/response';

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 'Email and password are required', 400, 'MISSING_CREDENTIALS');
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return sendError(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return sendError(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (user.status === 'BLOCKED') {
      return sendError(res, 'Your account is blocked. Please contact the library administrator.', 403, 'ACCOUNT_BLOCKED');
    }

    if (user.status === 'INACTIVE') {
      return sendError(res, 'Your account is currently inactive.', 403, 'ACCOUNT_INACTIVE');
    }

    const secret = process.env.JWT_SECRET || 'smart_library_jwt_secret_key_2026';
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      secret,
      { expiresIn: expiresIn as any }
    );

    return sendSuccess(
      res,
      {
        token,
        user: {
          id: user._id,
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          studentIdNumber: user.studentIdNumber,
          phone: user.phone,
          course: user.course,
          status: user.status,
          isCurrentlyInside: user.isCurrentlyInside,
          currentSeatNumber: user.currentSeatNumber,
          lastEntryTime: user.lastEntryTime,
          lastExitTime: user.lastExitTime,
        },
      },
      'Login successful'
    );
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return sendError(res, 'Not authenticated', 401);
    }

    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    return sendSuccess(res, {
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentIdNumber: user.studentIdNumber,
      phone: user.phone,
      course: user.course,
      status: user.status,
      isCurrentlyInside: user.isCurrentlyInside,
      currentSeatNumber: user.currentSeatNumber,
      lastEntryTime: user.lastEntryTime,
      lastExitTime: user.lastExitTime,
    });

  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  return sendSuccess(res, null, 'Logged out successfully');
};

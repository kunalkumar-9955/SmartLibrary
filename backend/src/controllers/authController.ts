import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { sendSuccess, sendError } from '../utils/response';

import crypto from 'crypto';
import { Session } from '../models/Session';

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 'Email and password are required', 400, 'MISSING_CREDENTIALS');
    }

    const cleanEmail = email.toLowerCase().trim();
    const adminEmail = (process.env.ADMIN_EMAIL || 'sonusingh7759@gmail.com').toLowerCase().trim();

    let user = await User.findOne({ email: cleanEmail });

    // On-demand Admin Initialization / Recovery
    if (cleanEmail === adminEmail) {
      const rawEnvPassword = process.env.ADMIN_PASSWORD;

      if (rawEnvPassword && rawEnvPassword.trim() !== '') {
        let cleanEnvPass = rawEnvPassword.trim();
        if (
          (cleanEnvPass.startsWith('"') && cleanEnvPass.endsWith('"')) ||
          (cleanEnvPass.startsWith("'") && cleanEnvPass.endsWith("'"))
        ) {
          cleanEnvPass = cleanEnvPass.slice(1, -1).trim();
        }

        if (!user) {
          // Admin does not exist in DB yet: initialize on-the-fly
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(cleanEnvPass, salt);
          user = await User.create({
            name: 'Library Admin',
            email: adminEmail,
            password: hashedPassword,
            role: 'ADMIN',
            status: 'ACTIVE',
            phone: '+91 9876543210',
          });
          console.log(`[Auth] Admin user auto-initialized for ${adminEmail}`);
        } else if (password === cleanEnvPass || password.trim() === cleanEnvPass) {
          // If password matches environment variable, ensure role is ADMIN & sync DB password if needed
          const isMatch = await user.comparePassword(password);
          if (!isMatch) {
            user.password = cleanEnvPass;
            user.role = 'ADMIN';
            user.status = 'ACTIVE';
            await user.save();
            console.log(`[Auth] Admin password synchronized with ADMIN_PASSWORD environment variable`);
          }
        }
      } else if (!user) {
        return sendError(
          res,
          'Admin account not initialized. Please set ADMIN_PASSWORD in your Render Environment Variables.',
          401,
          'ADMIN_NOT_CONFIGURED'
        );
      }
    }

    if (!user) {
      return sendError(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    let isMatch = await user.comparePassword(password);
    if (!isMatch && (password.startsWith(' ') || password.endsWith(' '))) {
      isMatch = await user.comparePassword(password.trim());
    }

    if (!isMatch) {
      return sendError(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (user.status === 'BLOCKED') {
      return sendError(res, 'Your account is blocked. Please contact the library administrator.', 403, 'ACCOUNT_BLOCKED');
    }

    if (user.status === 'INACTIVE') {
      return sendError(res, 'Your account is currently inactive.', 403, 'ACCOUNT_INACTIVE');
    }

    // Check active session limits before issuing new token
    // ADMIN: maximum 4 concurrent device sessions.
    // STUDENT: unlimited concurrent device sessions — no restriction.
    if (user.role === 'ADMIN') {
      const now = new Date();
      const activeAdminSessionCount = await Session.countDocuments({
        userId: user._id,
        isRevoked: false,
        expiresAt: { $gt: now },
      });
      if (activeAdminSessionCount >= 4) {
        return sendError(
          res,
          'Maximum 4 active admin sessions reached. Please logout from another device to continue.',
          429,
          'MAX_ADMIN_SESSIONS_REACHED'
        );
      }
    }
    // Students may log in from any number of devices simultaneously.

    const secret = process.env.JWT_SECRET || 'smart_library_jwt_secret_key_2026';
    const expiresIn = process.env.JWT_EXPIRES_IN || '365d';
    const jti = crypto.randomUUID();

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        jti,
      },
      secret,
      { expiresIn: expiresIn as any }
    );

    // Calculate exact expiresAt from token payload
    const decodedToken = jwt.decode(token) as { exp?: number } | null;
    const expiresAt = decodedToken?.exp
      ? new Date(decodedToken.exp * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const tokenHash = hashToken(token);
    const userAgent = (req.headers['user-agent'] as string) || '';
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';

    // Register active session
    await Session.create({
      userId: user._id,
      role: user.role,
      tokenHash,
      isRevoked: false,
      expiresAt,
      userAgent,
      ipAddress,
    });

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
          assignedSeatNumber: user.assignedSeatNumber,
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
      assignedSeatNumber: user.assignedSeatNumber,
      lastEntryTime: user.lastEntryTime,
      lastExitTime: user.lastExitTime,
    });

  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const tokenHash = hashToken(token);
      await Session.updateOne({ tokenHash }, { $set: { isRevoked: true } });
    }
    return sendSuccess(res, null, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return sendError(res, 'Current password and new password are required', 400);
    }

    if (newPassword.length < 8) {
      return sendError(res, 'New password must be at least 8 characters', 400);
    }

    // Fetch user WITH password field for bcrypt comparison
    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return sendError(res, 'Current password is incorrect', 401, 'WRONG_PASSWORD');
    }

    // Set new password — bcrypt hashing is done in the UserSchema pre('save') hook
    user.password = newPassword;
    await user.save();

    // Revoke all other active sessions across other devices
    const authHeader = req.headers.authorization;
    const currentToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : '';
    const currentTokenHash = currentToken ? hashToken(currentToken) : '';
    await Session.updateMany(
      { userId: user._id, tokenHash: { $ne: currentTokenHash } },
      { $set: { isRevoked: true } }
    );

    return sendSuccess(res, null, 'Password updated successfully');
  } catch (error) {
    next(error);
  }
};

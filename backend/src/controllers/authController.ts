import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { sendSuccess, sendError } from '../utils/response';

import crypto from 'crypto';
import { Session } from '../models/Session';
import { Attendance } from '../models/Attendance';

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 'Email and password are required', 400, 'MISSING_CREDENTIALS');
    }

    const sanitizeEnv = (val?: string): string => {
      if (!val) return '';
      let clean = val.trim();
      if (
        (clean.startsWith('"') && clean.endsWith('"')) ||
        (clean.startsWith("'") && clean.endsWith("'"))
      ) {
        clean = clean.slice(1, -1).trim();
      }
      return clean;
    };

    const cleanEmail = email.toLowerCase().trim();
    const rawAdminEmail = process.env.ADMIN_EMAIL;
    const cleanAdminEmail = (sanitizeEnv(rawAdminEmail) || 'sonusingh7759@gmail.com').toLowerCase().trim();
    const rawEnvPassword = process.env.ADMIN_PASSWORD;
    const cleanEnvPassword = sanitizeEnv(rawEnvPassword);

    // Find user record in MongoDB
    let user = await User.findOne({
      $or: [{ email: cleanEmail }, { email: cleanAdminEmail }]
    });

    // If cleanEmail is different from cleanAdminEmail but user exists with cleanEmail, prioritize exact user match
    if (user && user.email !== cleanEmail) {
      const directUser = await User.findOne({ email: cleanEmail });
      if (directUser) {
        user = directUser;
      }
    }

    // Determine if this login attempt targets the Admin account
    const isTargetAdmin =
      cleanEmail === cleanAdminEmail ||
      cleanEmail === 'sonusingh7759@gmail.com' ||
      user?.role === 'ADMIN';

    let isAuthenticated = false;

    if (isTargetAdmin) {
      // --- ADMIN AUTHENTICATION PIPELINE ---
      // Option A: Verify against ADMIN_PASSWORD from Environment Variables (Render / local .env)
      let envPasswordMatch = false;
      if (cleanEnvPassword && cleanEnvPassword !== '') {
        const isBcryptEnv =
          cleanEnvPassword.startsWith('$2a$') ||
          cleanEnvPassword.startsWith('$2b$') ||
          cleanEnvPassword.startsWith('$2y$');

        if (isBcryptEnv) {
          envPasswordMatch =
            (await bcrypt.compare(password, cleanEnvPassword)) ||
            (await bcrypt.compare(password.trim(), cleanEnvPassword));
        } else {
          envPasswordMatch =
            password === cleanEnvPassword ||
            password === rawEnvPassword ||
            password.trim() === cleanEnvPassword;
        }
      }

      // Option B: Verify against stored MongoDB password hash
      let dbPasswordMatch = false;
      if (user && user.password) {
        dbPasswordMatch = await user.comparePassword(password);
        if (!dbPasswordMatch && (password.startsWith(' ') || password.endsWith(' '))) {
          dbPasswordMatch = await user.comparePassword(password.trim());
        }
      }

      // Safe Diagnostics (Never exposes secrets or passwords)
      console.log(
        `[Auth Diagnostic] Admin attempt for: ${cleanEmail} | ADMIN_EMAIL set: ${Boolean(rawAdminEmail)} | ADMIN_PASSWORD set: ${Boolean(cleanEnvPassword)} | DB user exists: ${Boolean(user)} | Env match: ${envPasswordMatch} | DB match: ${dbPasswordMatch}`
      );

      if (envPasswordMatch || dbPasswordMatch) {
        isAuthenticated = true;

        if (!user) {
          // Admin account configured in environment but not in DB yet: auto-initialize
          user = await User.create({
            name: 'Library Admin',
            email: cleanEmail,
            password: cleanEnvPassword || password, // UserSchema.pre('save') handles single bcrypt hashing
            role: 'ADMIN',
            status: 'ACTIVE',
            phone: '+91 9876543210',
          });
          console.log(`[Auth] Admin user auto-initialized for ${cleanEmail}`);
        } else {
          // Ensure role and active status, and synchronize DB hash if environment password matched
          let needsSave = false;
          if (user.role !== 'ADMIN') {
            user.role = 'ADMIN';
            needsSave = true;
          }
          if (user.status !== 'ACTIVE') {
            user.status = 'ACTIVE';
            needsSave = true;
          }
          if (envPasswordMatch && !dbPasswordMatch && cleanEnvPassword) {
            user.password = cleanEnvPassword; // Synchronize with valid environment password
            needsSave = true;
            console.log(`[Auth] Synchronized Admin database password hash with environment credentials`);
          }
          if (needsSave) {
            await user.save();
          }
        }
      }
    } else {
      // --- STUDENT / STANDARD USER AUTHENTICATION ---
      if (user && user.password) {
        isAuthenticated = await user.comparePassword(password);
        if (!isAuthenticated && (password.startsWith(' ') || password.endsWith(' '))) {
          isAuthenticated = await user.comparePassword(password.trim());
        }
      }
    }

    if (!user || !isAuthenticated) {
      return sendError(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (user.status === 'BLOCKED') {
      return sendError(res, 'Your account is blocked. Please contact the library administrator.', 403, 'ACCOUNT_BLOCKED');
    }

    if (user.status === 'INACTIVE') {
      return sendError(res, 'Your account is currently inactive.', 403, 'ACCOUNT_INACTIVE');
    }

    // No device/session count limits for Admin or Student.
    // Login is granted to any account with valid credentials and ACTIVE status.
    // Sessions are tracked per-token for per-device logout (tokenHash revocation) only.


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

    let isInside = user.isCurrentlyInside;
    let currentSeat = user.currentSeatNumber;

    if (user.role === 'STUDENT') {
      const activeAttendance = await Attendance.findOne({
        studentId: user._id,
        status: 'ACTIVE',
      });
      isInside = !!activeAttendance;
      currentSeat = activeAttendance ? activeAttendance.seatNumber : undefined;

      // Self-healing database sync if drifted
      if (
        Boolean(user.isCurrentlyInside) !== isInside ||
        (user.currentSeatNumber || undefined) !== currentSeat
      ) {
        User.findByIdAndUpdate(user._id, {
          $set: { isCurrentlyInside: isInside, currentSeatNumber: currentSeat },
        }).catch((err) =>
          console.warn(`[getMe Sync] Failed to sync student ${user.name}:`, err?.message)
        );
      }
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
      isCurrentlyInside: isInside,
      currentSeatNumber: currentSeat,
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
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.body && req.body.token) {
      token = req.body.token;
    }

    if (token) {
      const tokenHash = hashToken(token);
      await Session.updateMany({ tokenHash }, { $set: { isRevoked: true } });
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

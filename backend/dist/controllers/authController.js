"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.getMe = exports.login = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const response_1 = require("../utils/response");
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return (0, response_1.sendError)(res, 'Email and password are required', 400, 'MISSING_CREDENTIALS');
        }
        const user = await User_1.User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return (0, response_1.sendError)(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return (0, response_1.sendError)(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
        }
        if (user.status === 'BLOCKED') {
            return (0, response_1.sendError)(res, 'Your account is blocked. Please contact the library administrator.', 403, 'ACCOUNT_BLOCKED');
        }
        if (user.status === 'INACTIVE') {
            return (0, response_1.sendError)(res, 'Your account is currently inactive.', 403, 'ACCOUNT_INACTIVE');
        }
        const secret = process.env.JWT_SECRET || 'smart_library_jwt_secret_key_2026';
        const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
        const token = jsonwebtoken_1.default.sign({
            id: user._id,
            email: user.email,
            role: user.role,
            name: user.name,
        }, secret, { expiresIn: expiresIn });
        return (0, response_1.sendSuccess)(res, {
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
        }, 'Login successful');
    }
    catch (error) {
        next(error);
    }
};
exports.login = login;
const getMe = async (req, res, next) => {
    try {
        if (!req.user) {
            return (0, response_1.sendError)(res, 'Not authenticated', 401);
        }
        const user = await User_1.User.findById(req.user.id).select('-password');
        if (!user) {
            return (0, response_1.sendError)(res, 'User not found', 404);
        }
        return (0, response_1.sendSuccess)(res, {
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
    }
    catch (error) {
        next(error);
    }
};
exports.getMe = getMe;
const logout = async (req, res, next) => {
    return (0, response_1.sendSuccess)(res, null, 'Logged out successfully');
};
exports.logout = logout;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const response_1 = require("../utils/response");
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return (0, response_1.sendError)(res, 'Authentication token missing or invalid format', 401, 'UNAUTHORIZED', req.originalUrl);
        }
        const token = authHeader.split(' ')[1];
        const secret = process.env.JWT_SECRET || 'smart_library_jwt_secret_key_2026';
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, secret);
        }
        catch (err) {
            return (0, response_1.sendError)(res, 'Invalid or expired authentication session. Please login again.', 401, 'TOKEN_EXPIRED', req.originalUrl);
        }
        const user = await User_1.User.findById(decoded.id).select('-password');
        if (!user) {
            return (0, response_1.sendError)(res, 'User account not found', 401, 'USER_NOT_FOUND', req.originalUrl);
        }
        if (user.status === 'BLOCKED') {
            return (0, response_1.sendError)(res, 'Your account has been blocked. Please contact your library administrator.', 403, 'ACCOUNT_BLOCKED', req.originalUrl);
        }
        if (user.status === 'INACTIVE') {
            return (0, response_1.sendError)(res, 'Your account is currently inactive.', 403, 'ACCOUNT_INACTIVE', req.originalUrl);
        }
        req.user = {
            id: user._id.toString(),
            email: user.email,
            role: user.role,
            name: user.name,
            status: user.status,
        };
        next();
    }
    catch (error) {
        return (0, response_1.sendError)(res, 'Authentication failed', 401, 'AUTH_ERROR', req.originalUrl);
    }
};
exports.authenticate = authenticate;

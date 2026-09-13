"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforceTenant = void 0;
const response_1 = require("../utils/response");
const enforceTenant = (req, res, next) => {
    if (!req.user) {
        return (0, response_1.sendError)(res, 'Authentication required', 401, 'UNAUTHORIZED', req.originalUrl);
    }
    // Super admin has platform-wide access
    if (req.user.role === 'SUPER_ADMIN') {
        return next();
    }
    // For Library Admin: enforce their own libraryId strictly
    if (req.user.role === 'LIBRARY_ADMIN') {
        if (!req.user.libraryId) {
            return (0, response_1.sendError)(res, 'No library assigned to this administrator account', 403, 'NO_LIBRARY_ASSIGNED', req.originalUrl);
        }
        // If query or body specifies a different libraryId, reject or force override
        if (req.query.libraryId && req.query.libraryId !== req.user.libraryId) {
            return (0, response_1.sendError)(res, 'Access denied: You can only access records from your assigned library', 403, 'CROSS_TENANT_FORBIDDEN', req.originalUrl);
        }
        if (req.body && req.body.libraryId && req.body.libraryId !== req.user.libraryId) {
            return (0, response_1.sendError)(res, 'Access denied: Cannot operate on another library', 403, 'CROSS_TENANT_FORBIDDEN', req.originalUrl);
        }
        // Force tenant scope to assigned library
        req.query.libraryId = req.user.libraryId;
        if (req.body && typeof req.body === 'object') {
            req.body.libraryId = req.user.libraryId;
        }
        return next();
    }
    // For Student: lock scope to their own student record & library
    if (req.user.role === 'STUDENT') {
        if (req.query.libraryId && req.user.libraryId && req.query.libraryId !== req.user.libraryId) {
            return (0, response_1.sendError)(res, 'Access denied: Cross-library query rejected', 403, 'CROSS_TENANT_FORBIDDEN', req.originalUrl);
        }
        if (req.user.libraryId) {
            req.query.libraryId = req.user.libraryId;
        }
        return next();
    }
    next();
};
exports.enforceTenant = enforceTenant;

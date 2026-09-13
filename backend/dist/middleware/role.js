"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = void 0;
const response_1 = require("../utils/response");
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return (0, response_1.sendError)(res, 'Authentication required', 401, 'UNAUTHORIZED', req.originalUrl);
        }
        if (!allowedRoles.includes(req.user.role)) {
            return (0, response_1.sendError)(res, `Access denied. Requires one of roles: ${allowedRoles.join(', ')}`, 403, 'FORBIDDEN', req.originalUrl);
        }
        next();
    };
};
exports.requireRole = requireRole;

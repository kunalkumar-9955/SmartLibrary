"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendError = exports.sendSuccess = void 0;
const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
        timestamp: new Date().toISOString(),
    });
};
exports.sendSuccess = sendSuccess;
const sendError = (res, message, statusCode = 400, code, path) => {
    return res.status(statusCode).json({
        success: false,
        message,
        code: code || 'BAD_REQUEST',
        timestamp: new Date().toISOString(),
        path,
    });
};
exports.sendError = sendError;

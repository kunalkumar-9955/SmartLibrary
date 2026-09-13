"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const response_1 = require("../utils/response");
const errorHandler = (err, req, res, next) => {
    console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);
    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map((val) => val.message);
        return (0, response_1.sendError)(res, messages.join(', '), 422, 'VALIDATION_ERROR', req.originalUrl);
    }
    // Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        return (0, response_1.sendError)(res, `Duplicate entry for ${field}. Please use another value.`, 409, 'DUPLICATE_KEY', req.originalUrl);
    }
    // Multer errors
    if (err.name === 'MulterError') {
        return (0, response_1.sendError)(res, `Upload error: ${err.message}`, 400, 'UPLOAD_ERROR', req.originalUrl);
    }
    // Cast error (e.g. invalid ObjectId)
    if (err.name === 'CastError') {
        return (0, response_1.sendError)(res, `Resource not found or invalid ID format`, 404, 'RESOURCE_NOT_FOUND', req.originalUrl);
    }
    // Custom or standard errors
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    return (0, response_1.sendError)(res, message, statusCode, 'INTERNAL_SERVER_ERROR', req.originalUrl);
};
exports.errorHandler = errorHandler;

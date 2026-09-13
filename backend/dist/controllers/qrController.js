"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateQRToken = exports.generateQR = void 0;
const qrCrypto_1 = require("../utils/qrCrypto");
const Library_1 = require("../models/Library");
const response_1 = require("../utils/response");
const generateQR = async (req, res, next) => {
    try {
        const { qrType } = req.body;
        if (!qrType || !['ENTRY', 'EXIT'].includes(qrType)) {
            return (0, response_1.sendError)(res, 'qrType must be either ENTRY or EXIT', 400);
        }
        const settings = await Library_1.Library.findOne();
        const ttl = settings?.qrExpirySeconds || 45;
        const qrPayload = (0, qrCrypto_1.generateDynamicQR)(qrType, ttl);
        return (0, response_1.sendSuccess)(res, {
            ...qrPayload,
            libraryName: settings?.name || 'Smart Library',
            ttl,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.generateQR = generateQR;
const validateQRToken = async (req, res, next) => {
    try {
        const { qrPayload, expectedType } = req.body;
        const result = (0, qrCrypto_1.validateDynamicQR)(qrPayload, expectedType);
        if (!result.isValid) {
            return (0, response_1.sendError)(res, result.error || 'Invalid attendance QR.', 400);
        }
        return (0, response_1.sendSuccess)(res, { valid: true }, 'QR Code is valid');
    }
    catch (error) {
        next(error);
    }
};
exports.validateQRToken = validateQRToken;

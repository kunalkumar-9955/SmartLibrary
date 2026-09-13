"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDynamicQR = exports.generateDynamicQR = void 0;
const crypto_1 = __importDefault(require("crypto"));
const uuid_1 = require("uuid");
const QR_SECRET = process.env.QR_SECRET || 'smart_library_personal_qr_secret_salt_2026';
// In-memory replay cache: Set of used tokens with TTL cleanup
const usedTokens = new Set();
const generateDynamicQR = (qrType, ttlSeconds = 45) => {
    const token = (0, uuid_1.v4)();
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const raw = `${qrType}:${token}:${expiresAt}`;
    const signature = crypto_1.default.createHmac('sha256', QR_SECRET).update(raw).digest('hex');
    return {
        qrType,
        token,
        expiresAt,
        signature,
    };
};
exports.generateDynamicQR = generateDynamicQR;
const validateDynamicQR = (payload, expectedType) => {
    if (!payload || !payload.qrType || !payload.token || !payload.expiresAt || !payload.signature) {
        return { isValid: false, error: 'Invalid QR code structure' };
    }
    // Check expected QR type
    if (expectedType && payload.qrType !== expectedType) {
        return {
            isValid: false,
            error: `Scanned ${payload.qrType} QR but expected ${expectedType} QR. Please scan the correct screen.`,
        };
    }
    // Check expiration
    if (Date.now() > payload.expiresAt) {
        return { isValid: false, error: 'QR code has expired. Please scan the new QR.' };
    }
    // Verify HMAC signature
    const raw = `${payload.qrType}:${payload.token}:${payload.expiresAt}`;
    const expectedSig = crypto_1.default.createHmac('sha256', QR_SECRET).update(raw).digest('hex');
    if (!crypto_1.default.timingSafeEqual(Buffer.from(payload.signature), Buffer.from(expectedSig))) {
        return { isValid: false, error: 'Invalid attendance QR.' };
    }
    // Check replay protection
    if (usedTokens.has(payload.token)) {
        return { isValid: false, error: 'This QR code was already scanned. Please scan the latest QR.' };
    }
    // Mark token as used
    usedTokens.add(payload.token);
    // Auto clean up after expiry
    const cleanupDelay = Math.max(0, payload.expiresAt - Date.now() + 10000);
    const timer = setTimeout(() => {
        usedTokens.delete(payload.token);
    }, cleanupDelay);
    if (timer && typeof timer.unref === 'function') {
        timer.unref();
    }
    return { isValid: true };
};
exports.validateDynamicQR = validateDynamicQR;

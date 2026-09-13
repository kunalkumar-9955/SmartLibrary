"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Membership = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const MembershipSchema = new mongoose_1.Schema({
    libraryId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    studentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planName: { type: String, required: true, trim: true },
    planType: {
        type: String,
        enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'CUSTOM'],
        default: 'MONTHLY',
    },
    price: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true, default: Date.now },
    expiryDate: { type: Date, required: true, index: true },
    status: {
        type: String,
        enum: ['ACTIVE', 'EXPIRED', 'SUSPENDED'],
        default: 'ACTIVE',
        index: true,
    },
    payment: {
        transactionId: { type: String, required: true },
        amount: { type: Number, required: true },
        paymentMethod: {
            type: String,
            enum: ['UPI', 'CARD', 'NETBANKING', 'CASH', 'MOCK_GATEWAY'],
            default: 'UPI',
        },
        paymentStatus: {
            type: String,
            enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'],
            default: 'SUCCESS',
        },
        paidAt: { type: Date, default: Date.now },
    },
    notes: { type: String },
}, { timestamps: true });
MembershipSchema.index({ studentId: 1, status: 1 });
MembershipSchema.index({ libraryId: 1, expiryDate: 1 });
exports.Membership = mongoose_1.default.model('Membership', MembershipSchema);

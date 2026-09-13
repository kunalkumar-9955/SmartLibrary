"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignMembership = exports.getMyMembership = exports.getMemberships = void 0;
const Membership_1 = require("../models/Membership");
const StudentProfile_1 = require("../models/StudentProfile");
const Notification_1 = require("../models/Notification");
const response_1 = require("../utils/response");
const audit_1 = require("../utils/audit");
const getMemberships = async (req, res, next) => {
    try {
        const libraryId = req.user?.libraryId || req.query.libraryId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const status = req.query.status;
        const query = {};
        if (libraryId)
            query.libraryId = libraryId;
        if (status)
            query.status = status;
        const total = await Membership_1.Membership.countDocuments(query);
        const records = await Membership_1.Membership.find(query)
            .populate('studentId', 'name email phone avatar')
            .populate('libraryId', 'name code')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
        return (0, response_1.sendSuccess)(res, {
            memberships: records,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getMemberships = getMemberships;
const getMyMembership = async (req, res, next) => {
    try {
        const studentUserId = req.user?.id;
        const memberships = await Membership_1.Membership.find({ studentId: studentUserId })
            .populate('libraryId', 'name code openingTime closingTime')
            .sort({ createdAt: -1 });
        const active = memberships.find((m) => m.status === 'ACTIVE' && new Date(m.expiryDate) >= new Date());
        return (0, response_1.sendSuccess)(res, {
            activeMembership: active || null,
            history: memberships,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getMyMembership = getMyMembership;
const assignMembership = async (req, res, next) => {
    try {
        const libraryId = req.user?.libraryId;
        const { studentId, planName, planType, price, durationDays, paymentMethod } = req.body;
        if (!studentId || !planName || !durationDays) {
            return (0, response_1.sendError)(res, 'Student ID, plan name, and duration are required', 400);
        }
        const startDate = new Date();
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + parseInt(durationDays));
        // Mock payment gateway transaction ID
        const txnId = `MOCK_TXN_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const membership = await Membership_1.Membership.create({
            libraryId,
            studentId,
            planName,
            planType: planType || 'MONTHLY',
            price: price ? parseFloat(price) : 800,
            startDate,
            expiryDate,
            status: 'ACTIVE',
            payment: {
                transactionId: txnId,
                amount: price ? parseFloat(price) : 800,
                paymentMethod: paymentMethod || 'UPI',
                paymentStatus: 'SUCCESS',
                paidAt: new Date(),
            },
        });
        // Update StudentProfile activeMembershipId
        await StudentProfile_1.StudentProfile.findOneAndUpdate({ userId: studentId }, { activeMembershipId: membership._id });
        await Notification_1.Notification.create({
            userId: studentId,
            libraryId,
            title: 'Membership Activated!',
            message: `Your "${planName}" is now active until ${expiryDate.toDateString()}.`,
            type: 'MEMBERSHIP',
        });
        await (0, audit_1.logAudit)({
            actorUserId: req.user?.id,
            actorName: req.user?.name,
            actorRole: req.user?.role,
            libraryId,
            action: 'MEMBERSHIP_ASSIGNED',
            entityType: 'Membership',
            entityId: membership._id.toString(),
            metadata: { planName, expiryDate },
        });
        return (0, response_1.sendSuccess)(res, membership, 'Membership assigned and activated successfully', 201);
    }
    catch (error) {
        next(error);
    }
};
exports.assignMembership = assignMembership;

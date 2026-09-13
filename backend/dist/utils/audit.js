"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = void 0;
const AuditLog_1 = require("../models/AuditLog");
const logAudit = async (params) => {
    try {
        await AuditLog_1.AuditLog.create({
            actorUserId: params.actorUserId,
            actorName: params.actorName,
            actorRole: params.actorRole,
            libraryId: params.libraryId,
            action: params.action,
            entityType: params.entityType,
            entityId: params.entityId,
            ipAddress: params.ipAddress,
            metadata: params.metadata,
        });
    }
    catch (err) {
        console.error('[AuditLog] Failed to record audit log:', err.message);
    }
};
exports.logAudit = logAudit;

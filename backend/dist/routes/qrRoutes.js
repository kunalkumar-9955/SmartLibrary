"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const qrController_1 = require("../controllers/qrController");
const auth_1 = require("../middleware/auth");
const role_1 = require("../middleware/role");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Admin generates QR token for display screen (students can also access if running simulator)
router.post('/generate', (0, role_1.requireRole)('ADMIN', 'STUDENT'), qrController_1.generateQR);
// QR verification test
router.post('/validate', qrController_1.validateQRToken);
exports.default = router;

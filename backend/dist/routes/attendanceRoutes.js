"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const attendanceController_1 = require("../controllers/attendanceController");
const excelController_1 = require("../controllers/excelController");
const auth_1 = require("../middleware/auth");
const role_1 = require("../middleware/role");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Student actions
router.post('/entry', (0, role_1.requireRole)('STUDENT'), attendanceController_1.markEntryAttendance);
router.post('/exit', (0, role_1.requireRole)('STUDENT'), attendanceController_1.markExitAttendance);
router.get('/my', (0, role_1.requireRole)('STUDENT'), attendanceController_1.getMyAttendanceHistory);
// Admin actions
router.get('/currently-inside', (0, role_1.requireRole)('ADMIN'), attendanceController_1.getCurrentlyInside);
router.get('/export', (0, role_1.requireRole)('ADMIN'), excelController_1.exportAttendanceExcel);
router.get('/', (0, role_1.requireRole)('ADMIN'), attendanceController_1.getAllAttendance);
router.post('/force-checkout/:id', (0, role_1.requireRole)('ADMIN'), attendanceController_1.forceCheckout);
exports.default = router;

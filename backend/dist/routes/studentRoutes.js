"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const studentController_1 = require("../controllers/studentController");
const auth_1 = require("../middleware/auth");
const role_1 = require("../middleware/role");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Admin routes
router.get('/', (0, role_1.requireRole)('ADMIN'), studentController_1.getStudents);
router.post('/', (0, role_1.requireRole)('ADMIN'), studentController_1.createStudent);
router.get('/:id', studentController_1.getStudentById);
router.put('/:id', (0, role_1.requireRole)('ADMIN'), studentController_1.updateStudent);
router.patch('/:id/status', (0, role_1.requireRole)('ADMIN'), studentController_1.updateStudentStatus);
exports.default = router;

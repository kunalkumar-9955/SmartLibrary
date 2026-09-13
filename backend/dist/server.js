"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const db_1 = require("./config/db");
const errorHandler_1 = require("./middleware/errorHandler");
const routes_1 = __importDefault(require("./routes"));
const User_1 = require("./models/User");
const seedData_1 = require("./seed/seedData");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middleware
const rawOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ['http://localhost:5173'];
const allowedOrigins = rawOrigins.map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g., mobile apps, curl, server-to-server)
        if (!origin)
            return callback(null, true);
        const cleanOrigin = origin.replace(/\/$/, '');
        if (allowedOrigins.includes('*') ||
            allowedOrigins.includes(cleanOrigin) ||
            cleanOrigin.includes('localhost') ||
            cleanOrigin.includes('127.0.0.1')) {
            return callback(null, true);
        }
        return callback(null, true); // Permissive in initial deployments to prevent blocking
    },
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Static uploads directory
const uploadDir = path_1.default.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
app.use('/uploads', express_1.default.static(uploadDir));
// Health Check
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        system: 'Smart Library Management & Student Support System',
        timestamp: new Date().toISOString(),
    });
});
// API Routes
app.use('/api', routes_1.default);
// Global Error Handler
app.use(errorHandler_1.errorHandler);
// Bootstrap
const startServer = async () => {
    try {
        await (0, db_1.connectDB)();
        // Auto-seed if database is completely empty
        const userCount = await User_1.User.countDocuments();
        if (userCount === 0) {
            console.log('[Bootstrap] No existing users found. Auto-seeding initial development database...');
            await (0, seedData_1.seedDatabase)();
        }
        app.listen(PORT, () => {
            console.log(`=======================================================`);
            console.log(`🚀 Smart Library Backend Server running on port ${PORT}`);
            console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
            console.log(`=======================================================`);
        });
    }
    catch (error) {
        console.error('[Bootstrap] Server initialization failed:', error.message);
        process.exit(1);
    }
};
startServer();
exports.default = app;

import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from './config/db';
import { errorHandler } from './middleware/errorHandler';
import apiRoutes from './routes';
import { User } from './models/User';
import { seedDatabase } from './seed/seedData';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const rawOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ['http://localhost:5173'];
const allowedOrigins = rawOrigins.map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/$/, '');
      if (
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(cleanOrigin) ||
        cleanOrigin.includes('localhost') ||
        cleanOrigin.includes('127.0.0.1')
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in initial deployments to prevent blocking
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads directory
const uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
app.use('/uploads', express.static(uploadDir));

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    system: 'Smart Library Management & Student Support System',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api', apiRoutes);

// Global Error Handler
app.use(errorHandler);

// Bootstrap
const startServer = async () => {
  try {
    await connectDB();

    // Auto-seed if database is completely empty
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('[Bootstrap] No existing users found. Auto-seeding initial development database...');
      await seedDatabase();
    }

    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 Smart Library Backend Server running on port ${PORT}`);
      console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`=======================================================`);
    });
  } catch (error: any) {
    console.error('[Bootstrap] Server initialization failed:', error.message);
    process.exit(1);
  }
};

startServer();

export default app;

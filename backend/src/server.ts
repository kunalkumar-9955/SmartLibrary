import express from 'express';
import cors from 'cors';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from './config/db';
import { errorHandler } from './middleware/errorHandler';
import apiRoutes from './routes';
import { bootstrapSystem } from './config/bootstrap';
import { User } from './models/User';

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Middleware - Secure & Production-Ready CORS
const rawOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ['http://localhost:5173'];
const allowedOrigins = rawOrigins.map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      const cleanOrigin = origin.replace(/\/$/, '');
      const isLocalhost = cleanOrigin.includes('localhost') || cleanOrigin.includes('127.0.0.1');

      // Always allow localhost for development/debugging
      if (isLocalhost) {
        return callback(null, true);
      }

      // Check against configured FRONTEND_URL
      if (allowedOrigins.includes('*') || allowedOrigins.includes(cleanOrigin)) {
        return callback(null, true);
      }

      // Allow Vercel preview deployments if main deployment is on Vercel
      const allowsVercel = allowedOrigins.some((url) => url.includes('vercel.app'));
      if (allowsVercel && cleanOrigin.endsWith('.vercel.app')) {
        return callback(null, true);
      }

      // Allow in non-production environments
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked: Origin ${origin} is not allowed by FRONTEND_URL configuration`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads directory
const uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
app.use('/uploads', express.static(uploadDir));

// Health Checks (Both /health and /api/health for Render/Vercel compatibility)
const sendHealthCheck = async (req: express.Request, res: express.Response) => {
  const adminEmail = (process.env.ADMIN_EMAIL || 'sonusingh7759@gmail.com').toLowerCase().trim();
  let adminConfigured = false;
  try {
    if (mongoose.connection.readyState === 1) {
      const exists = await User.exists({ email: adminEmail });
      adminConfigured = !!exists;
    }
  } catch {
    adminConfigured = false;
  }

  res.status(200).json({
    status: 'UP',
    database: mongoose.connection.readyState === 1 ? 'CONNECTED' : 'CONNECTING',
    adminConfigured,
    adminEmail,
    adminPasswordEnvSet: Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim() !== ''),
    system: 'Smart Library Management & Student Support System',
    timestamp: new Date().toISOString(),
  });
};

app.get('/health', sendHealthCheck);
app.get('/api/health', sendHealthCheck);

// API Routes
app.use('/api', apiRoutes);

// Global Error Handler
app.use(errorHandler);

// Bootstrap
const startServer = async () => {
  try {
    // Bind to 0.0.0.0 and PORT immediately so Render health checks pass without port timeout
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`=======================================================`);
      console.log(`🚀 Smart Library Backend Server running on port ${PORT}`);
      console.log(`📡 Health Check: http://0.0.0.0:${PORT}/health`);
      console.log(`=======================================================`);
    });

    await connectDB();
    await bootstrapSystem();
  } catch (error: any) {
    console.error('[Bootstrap] Server initialization failed:', error.message);
    process.exit(1);
  }
};

startServer();

export default app;

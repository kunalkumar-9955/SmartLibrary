import mongoose from 'mongoose';

let memoryServerInstance: any = null;

export const connectDB = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState === 1) {
      return;
    }

    const mongoUri = process.env.MONGODB_URI;

    // Production environment strictly requires MONGODB_URI (MongoDB Atlas)
    if (process.env.NODE_ENV === 'production') {
      if (!mongoUri || mongoUri.trim() === '') {
        console.error('[Database Error] MONGODB_URI environment variable is missing.');
        console.error('[Database Error] In production, Smart Library requires a MongoDB Atlas connection string.');
        console.error('[Database Error] Please configure MONGODB_URI in your Render environment variables.');
        process.exit(1);
      }

      const sanitizedUri = mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
      console.log(`[Database] Connecting to MongoDB Atlas (${sanitizedUri})...`);
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
      console.log('[Database] Connected to MongoDB Atlas successfully.');
      return;
    }

    // Development / Non-production environment
    if (mongoUri && mongoUri.trim() !== '') {
      try {
        const sanitizedUri = mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
        console.log(`[Database] Connecting to configured MongoDB (${sanitizedUri})...`);
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
        console.log('[Database] Connected to configured MongoDB successfully.');
        return;
      } catch (err: any) {
        console.warn(`[Database] Failed to connect to ${mongoUri}: ${err.message}. Trying development fallback...`);
      }
    }

    // In local development, attempt local MongoDB or dynamic in-memory server fallback
    try {
      console.log('[Database] Attempting local MongoDB connection (mongodb://127.0.0.1:27017/smart_library)...');
      await mongoose.connect('mongodb://127.0.0.1:27017/smart_library', { serverSelectionTimeoutMS: 3000 });
      console.log('[Database] Connected to local MongoDB successfully.');
      return;
    } catch {
      console.log('[Database] Local MongoDB not detected. Attempting in-memory development server...');
      try {
        // Dynamically load in-memory MongoDB only in development when package is available
        // This ensures production builds never require or fail on dev-only packages
        const { MongoMemoryServer } = require('mongodb-memory-server');
        memoryServerInstance = await MongoMemoryServer.create();
        const memoryUri = memoryServerInstance.getUri();
        await mongoose.connect(memoryUri);
        console.log('[Database] Connected to embedded development in-memory MongoDB.');
      } catch (memErr: any) {
        console.error('[Database Error] Could not initialize fallback database:', memErr.message);
        console.error('[Database Error] Please set MONGODB_URI in your .env file or start MongoDB locally.');
        process.exit(1);
      }
    }
  } catch (error: any) {
    console.error('[Database Error] MongoDB connection error:', error.message);
    if (process.env.NODE_ENV === 'production') {
      console.error('[Database Error] In production, verify MONGODB_URI credentials and MongoDB Atlas Network Access (allow IP 0.0.0.0/0).');
    }
    process.exit(1);
  }
};

export const closeDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    if (memoryServerInstance) {
      await memoryServerInstance.stop();
    }
  } catch (error: any) {
    console.error('[Database Error] Error closing DB connection:', error.message);
  }
};

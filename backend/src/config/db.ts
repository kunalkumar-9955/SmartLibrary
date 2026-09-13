import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer | null = null;

export const connectDB = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState === 1) {
      return;
    }
    const mongoUri = process.env.MONGODB_URI;

    if (mongoUri && mongoUri.trim() !== '') {
      try {
        // Mask credentials in logs to prevent accidental secret leakage
        const sanitizedUri = mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
        console.log(`[Database] Connecting to configured MongoDB (${sanitizedUri})...`);
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
        console.log('[Database] Successfully connected to configured MongoDB.');
        return;
      } catch (err: any) {
        console.error(`[Database Error] Failed to connect to configured MONGODB_URI: ${err.message}`);
        if (process.env.NODE_ENV === 'production') {
          console.error('[Database Error] In production, an external MongoDB (e.g. MongoDB Atlas) is required. Please check your MONGODB_URI and Atlas network access (allow IP 0.0.0.0/0).');
          process.exit(1);
        }
        console.warn('[Database] Falling back to embedded in-memory MongoDB for local development.');
      }
    } else if (process.env.NODE_ENV === 'production') {
      console.error('[Database Error] MONGODB_URI environment variable is not defined in production. Please set MONGODB_URI in your Render environment variables.');
      process.exit(1);
    }

    console.log('[Database] Starting standalone embedded MongoDB memory server...');
    mongod = await MongoMemoryServer.create();
    const memoryUri = mongod.getUri();
    await mongoose.connect(memoryUri);
    console.log(`[Database] Connected to embedded MongoDB successfully.`);
  } catch (error: any) {
    console.error('[Database] MongoDB initialization error:', error.message);
    process.exit(1);
  }
};

export const closeDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  } catch (error: any) {
    console.error('[Database] Error closing DB:', error.message);
  }
};

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer | null = null;

export const connectDB = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState === 1) {
      return;
    }
    let mongoUri = process.env.MONGODB_URI;

    if (mongoUri && mongoUri.trim() !== '') {
      try {
        console.log(`[Database] Attempting connection to ${mongoUri}...`);
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
        console.log('[Database] Successfully connected to configured MongoDB.');
        return;
      } catch (err: any) {
        console.warn(`[Database] Failed to connect to ${mongoUri}: ${err.message}. Falling back to embedded MongoDB server.`);
      }
    }

    console.log('[Database] Starting standalone embedded MongoDB memory server...');
    mongod = await MongoMemoryServer.create();
    const memoryUri = mongod.getUri();
    await mongoose.connect(memoryUri);
    console.log(`[Database] Connected to embedded MongoDB successfully at ${memoryUri}`);
  } catch (error: any) {
    console.error('[Database] MongoDB connection error:', error.message);
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

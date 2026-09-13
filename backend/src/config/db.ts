import mongoose from 'mongoose';

let memoryServerInstance: any = null;

/**
 * Strips accidental whitespace and surrounding quotes from the connection string.
 */
export const cleanMongoUri = (uri?: string): string => {
  if (!uri) return '';
  let cleaned = uri.trim();
  // Strip accidental surrounding single or double quotes
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
};

/**
 * Sanitizes MongoDB URI for safe logging by masking credentials.
 * Handles both mongodb:// and mongodb+srv:// protocols with any characters in username/password.
 */
export const sanitizeMongoUri = (uri: string): string => {
  if (!uri) return '';
  // Mask credentials between protocol and host
  const masked = uri.replace(/^(mongodb(?:\+srv)?:\/\/)(.*)@([^/?#]+)/i, '$1***:***@$3');
  return masked !== uri ? masked : uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
};

export const connectDB = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState === 1) {
      return;
    }

    const rawMongoUri = process.env.MONGODB_URI;
    const mongoUri = cleanMongoUri(rawMongoUri);

    // Production environment strictly requires MONGODB_URI (MongoDB Atlas)
    if (process.env.NODE_ENV === 'production') {
      if (!mongoUri) {
        console.error('[Database Error] =======================================================');
        console.error('[Database Error] MONGODB_URI environment variable is missing or empty.');
        console.error('[Database Error] In production, Smart Library requires a MongoDB Atlas connection string.');
        console.error('[Database Error] Please configure MONGODB_URI in your Render environment variables.');
        console.error('[Database Error] =======================================================');
        process.exit(1);
      }

      const sanitizedUri = sanitizeMongoUri(mongoUri);
      console.log(`[Database] Connecting to MongoDB Atlas (${sanitizedUri})...`);

      const dbName = process.env.MONGODB_DB_NAME || process.env.DB_NAME;
      const options: mongoose.ConnectOptions = {
        serverSelectionTimeoutMS: 10000,
        ...(dbName ? { dbName } : {}),
      };

      await mongoose.connect(mongoUri, options);
      console.log('[Database] Connected to MongoDB Atlas successfully.');
      return;
    }

    // Development / Non-production environment
    if (mongoUri) {
      try {
        const sanitizedUri = sanitizeMongoUri(mongoUri);
        console.log(`[Database] Connecting to configured MongoDB (${sanitizedUri})...`);
        const dbName = process.env.MONGODB_DB_NAME || process.env.DB_NAME;
        await mongoose.connect(mongoUri, {
          serverSelectionTimeoutMS: 5000,
          ...(dbName ? { dbName } : {}),
        });
        console.log('[Database] Connected to configured MongoDB successfully.');
        return;
      } catch (err: any) {
        console.warn(`[Database] Failed to connect to configured MongoDB: ${err.message}. Trying development fallback...`);
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
    const errorMsg = error?.message || String(error);
    const isAuthError =
      error?.code === 8000 ||
      /bad auth|authentication failed|auth error|auth failed/i.test(errorMsg);
    const isNetworkError =
      /serverSelectionTimeout|ETIMEDOUT|ENOTFOUND|ECONNREFUSED/i.test(errorMsg);

    if (isAuthError) {
      console.error('================================================================');
      console.error('🚨 [Database Error] MongoDB Authentication Failed (bad auth)');
      console.error('----------------------------------------------------------------');
      console.error('MongoDB Atlas rejected the database credentials.');
      console.error('');
      console.error('ACTION CHECKLIST FOR RENDER:');
      console.error(' 1. Check MongoDB Atlas "Database Access" (NOT your Atlas web login):');
      console.error('    - Go to MongoDB Atlas -> Database Access.');
      console.error('    - Verify the Database User exists and credentials match MONGODB_URI.');
      console.error(' 2. Verify Database User Permissions:');
      console.error('    - User role should be "Read and write to any database" (Built-in Role)');
      console.error('      or have readWrite role on your target database.');
      console.error(' 3. Special Characters in Password:');
      console.error('    - If the password has special characters (@, :, /, ?, #, %, &, etc.),');
      console.error('      they MUST be percent-encoded (e.g. @ -> %40, # -> %23).');
      console.error(' 4. No Quotes in Render:');
      console.error('    - In Render Environment tab, make sure the value has NO quotes around it.');
      console.error(' 5. MongoDB Atlas Network Access:');
      console.error('    - Ensure IP 0.0.0.0/0 (Allow Access from Anywhere) is configured.');
      console.error('================================================================');
    } else if (isNetworkError) {
      console.error('================================================================');
      console.error('🚨 [Database Error] MongoDB Network / Connection Timeout');
      console.error('----------------------------------------------------------------');
      console.error('Could not reach MongoDB Atlas cluster.');
      console.error('ACTION: In MongoDB Atlas -> Network Access, add IP Address: 0.0.0.0/0');
      console.error('================================================================');
    } else {
      console.error('[Database Error] MongoDB connection error:', errorMsg);
    }

    if (process.env.NODE_ENV === 'production') {
      console.error('[Database Error] Production startup aborted due to database connection failure.');
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

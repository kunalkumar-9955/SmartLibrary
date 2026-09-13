"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDB = exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
let mongod = null;
const connectDB = async () => {
    try {
        if (mongoose_1.default.connection.readyState === 1) {
            return;
        }
        let mongoUri = process.env.MONGODB_URI;
        if (mongoUri && mongoUri.trim() !== '') {
            try {
                console.log(`[Database] Attempting connection to ${mongoUri}...`);
                await mongoose_1.default.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
                console.log('[Database] Successfully connected to configured MongoDB.');
                return;
            }
            catch (err) {
                console.warn(`[Database] Failed to connect to ${mongoUri}: ${err.message}. Falling back to embedded MongoDB server.`);
            }
        }
        console.log('[Database] Starting standalone embedded MongoDB memory server...');
        mongod = await mongodb_memory_server_1.MongoMemoryServer.create();
        const memoryUri = mongod.getUri();
        await mongoose_1.default.connect(memoryUri);
        console.log(`[Database] Connected to embedded MongoDB successfully at ${memoryUri}`);
    }
    catch (error) {
        console.error('[Database] MongoDB connection error:', error.message);
        process.exit(1);
    }
};
exports.connectDB = connectDB;
const closeDB = async () => {
    try {
        await mongoose_1.default.disconnect();
        if (mongod) {
            await mongod.stop();
        }
    }
    catch (error) {
        console.error('[Database] Error closing DB:', error.message);
    }
};
exports.closeDB = closeDB;

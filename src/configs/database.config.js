import mongoose from 'mongoose';
import { env } from './env.config.js';

let isConnected = false;
let isDisconnecting = false;
let connectPromise = null;

export const connectDB = async () => {
  if (isConnected) return mongoose.connection;
  if (connectPromise) return connectPromise;

  if (!env.mongodb.uri) {
    throw new Error('MongoDB connection failed: MONGODB_URI is not configured.');
  }

  connectPromise = mongoose.connect(env.mongodb.uri, {
    dbName: env.mongodb.dbName,
    serverSelectionTimeoutMS: 3000,
    connectTimeoutMS: 3000,
    socketTimeoutMS: 45000,
  })
    .then(() => {
      isDisconnecting = false;
      isConnected = true;
      const dbName = mongoose.connection.db?.databaseName || env.mongodb.uri?.split('/').pop()?.split('?')[0]
      console.log(`MongoDB connected successfully → DB: ${dbName}`);

      mongoose.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err);
        isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        if (!isDisconnecting) {
          console.warn('MongoDB disconnected. Attempting to reconnect...');
        }
        isConnected = false;
      });

      return mongoose.connection;
    })
    .catch((error) => {
      const message = `Failed to connect to MongoDB (${env.mongodb.dbName}): ${error.message}`
      console.error(message)
      throw new Error(message, { cause: error })
    })
    .finally(() => {
      connectPromise = null
    })

  return connectPromise;
};

export const disconnectDB = async () => {
  if (!isConnected && !mongoose.connection.readyState) return;
  isDisconnecting = true;
  await mongoose.disconnect();
  isConnected = false;
  connectPromise = null;
  console.log('MongoDB disconnected');
};

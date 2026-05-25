import mongoose from 'mongoose';
import { env } from './env.config.js';

let isConnected = false;
let isDisconnecting = false;

export const connectDB = async () => {
  if (isConnected) return;

  try {
    await mongoose.connect(env.mongodb.uri, {
      dbName: env.mongodb.dbName,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isDisconnecting = false;
    isConnected = true;
<<<<<<< HEAD
    console.log(`MongoDB connected successfully: ${mongoose.connection.name}`);
=======
    const dbName = mongoose.connection.db?.databaseName || env.mongodb.uri?.split('/').pop()?.split('?')[0]
    console.log(`MongoDB connected successfully → DB: ${dbName}`);
>>>>>>> baonq

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
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  if (!isConnected) return;
  isDisconnecting = true;
  await mongoose.disconnect();
  isConnected = false;
  console.log('MongoDB disconnected');
};

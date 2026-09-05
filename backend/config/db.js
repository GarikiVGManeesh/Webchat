const mongoose = require('mongoose');

/**
 * Connect to MongoDB with retry logic and event handlers
 */
const connectDB = async () => {
  // Disable Mongoose buffering so operations fail fast if not connected
  mongoose.set('bufferCommands', false);

  // Handle connection events
  mongoose.connection.on('connected', () => {
    // Logged in the retry loop below — skip duplicate
  });

  mongoose.connection.on('error', (err) => {
    console.error(`MongoDB connection error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected. Attempting to reconnect...');
  });

  // Graceful shutdown - just close the connection, let server.js handle process exit
  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('MongoDB connection closed due to app termination');
  });

  // Attempt connection with retries
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 3000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      });
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      console.error(
        `MongoDB Connection Attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`
      );
      if (attempt === MAX_RETRIES) {
        throw new Error(
          `Failed to connect to MongoDB after ${MAX_RETRIES} attempts. ${error.message}`
        );
      }
      console.log(`Retrying in ${RETRY_DELAY / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
    }
  }
};

module.exports = connectDB;

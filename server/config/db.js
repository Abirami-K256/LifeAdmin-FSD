const mongoose = require('mongoose');

let mongoMemoryServer = null;

const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lifeadmin';

  try {
    // Attempt connecting to the configured MongoDB URI (e.g., local MongoDB or Atlas)
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2500, // Quick timeout to check availability
    });
    console.log(`[Database] Connected successfully to MongoDB at: ${uri}`);
  } catch (err) {
    console.warn(`[Database] Could not connect to MongoDB at ${uri}: ${err.message}`);
    console.log('[Database] Starting in-memory MongoDB fallback for zero-configuration setup...');

    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongoMemoryServer = await MongoMemoryServer.create();
      const memUri = mongoMemoryServer.getUri();
      await mongoose.connect(memUri);
      console.log(`[Database] In-memory MongoDB running and connected at: ${memUri}`);
    } catch (memErr) {
      console.error('[Database] Failed to start MongoDB fallback:', memErr);
      process.exit(1);
    }
  }
};

const disconnectDB = async () => {
  await mongoose.disconnect();
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
  }
};

module.exports = { connectDB, disconnectDB };

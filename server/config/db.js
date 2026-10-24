const mongoose = require('mongoose');

let mongoMemoryServer = null;

const connectDB = async () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const uri = process.env.MONGO_URI || (!isProduction ? 'mongodb://127.0.0.1:27017/lifeadmin' : null);

  if (!uri && isProduction) {
    console.error('[Database Fatal] MONGO_URI is required in production environment.');
    process.exit(1);
  }

  try {
    // Attempt connecting to the configured MongoDB URI
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[Database] Connected successfully to MongoDB at: ${uri}`);
  } catch (err) {
    if (isProduction) {
      console.error(`[Database Fatal] Could not connect to MongoDB Atlas in production: ${err.message}`);
      process.exit(1);
    }

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

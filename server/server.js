require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { connectDB } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { initCronJob } = require('./services/reminder.service');

// Route imports
const authRoutes = require('./routes/auth.routes');
const documentRoutes = require('./routes/document.routes');
const reminderRoutes = require('./routes/reminder.routes');

// Process-level error resilience: prevent crashes from unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection at Promise]:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]:', err);
});

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS Configuration
const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({
  origin: [allowedOrigin, 'http://127.0.0.1:5173', 'http://localhost:5173'],
  credentials: true,
}));

// Body Parsers
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'LifeAdmin API is up and running.',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/reminders', reminderRoutes);

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../client/dist');

  app.use(express.static(frontendPath));

  // Support React Router routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }

    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Global Error Handler
app.use(errorHandler);

// Start Server after connecting to Database
const startServer = async () => {
  try {
    await connectDB();

    // Initialize daily reminder cron job
    initCronJob();

    const server = app.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(` LifeAdmin Server running on port ${PORT}`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(` API Endpoint: http://localhost:${PORT}/api`);
      console.log(`===============================================`);
    });

    return server;
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = app;

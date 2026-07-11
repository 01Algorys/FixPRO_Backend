require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const cron = require('node-cron');

// Import middleware and services
const { connectDB } = require('./config/database');
const { securityHeaders, generalLimiter, authLimiter, sanitizeInput, corsOptions, requestSizeLimiter } = require('./middleware/security');
const errorHandler = require('./middleware/errorHandler');
const socketService = require('./services/socketService');
const { runExpirySweep } = require('./jobs/reservationExpiry');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const workerRoutes = require('./routes/workers');
const serviceRoutes = require('./routes/services');
const reservationRoutes = require('./routes/reservations');
const reviewRoutes = require('./routes/reviews');
const messageRoutes = require('./routes/messages');
const adminRoutes = require('./routes/admin');
const searchRoutes = require('./routes/search');

// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);

// NOTE: Server binds to 0.0.0.0 to be reachable from all network interfaces (including mobile devices on local network)

// CORS configuration for Socket.IO
const corsOptionsSocket = {
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

// Initialize Socket.IO
const io = socketIo(server, {
  cors: corsOptionsSocket,
  transports: ['websocket', 'polling']
});

// Store io instance in app for use in controllers
app.set('io', io);

// Initialize socket service
socketService.initialize(io);

// Middleware
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestSizeLimiter);
app.use(sanitizeInput);

// Rate limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use(generalLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// Socket test endpoint
app.get('/socket-test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Socket.IO server is accessible',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/search', searchRoutes);

// Worker profile by ID (public endpoint)
const workerController = require('./controllers/workerController');
app.get('/api/worker-profile/:id', workerController.getWorkerById);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`Socket.IO server initialized`);

  // Auto-expire PENDING reservations older than 24h — checked every 15 minutes,
  // which is well within an acceptable margin for a 24h SLA.
  cron.schedule('*/15 * * * *', () => {
    runExpirySweep().catch((error) => {
      console.error('[reservationExpiry] Sweep failed:', error);
    });
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Promise Rejection:', err);
  // Don't kill server during socket sessions, just log the error
  // server.close(() => {
  //   process.exit(1);
  // });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = app;

const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const { configureCloudinary } = require('./config/cloudinary');
const { initializeSocket, setIO } = require('./config/socket');
const { errorHandler } = require('./middlewares/error');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Initialize Express app
const app = express();
const server = http.createServer(app);

// ======== MIDDLEWARE ========

// CORS configuration
const allowedOrigins = process.env.NODE_ENV === 'development'
  ? [...new Set([
      'http://localhost:5173',
      'http://localhost:4173',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:4173',
      'http://[::1]:5173',
      'http://[::1]:4173',
      process.env.CLIENT_URL,
    ].filter(Boolean))]
  : process.env.CLIENT_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Static files (for local uploads fallback)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ======== API ROUTES ========

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Mount routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/chats', require('./routes/chatRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/stories', require('./routes/storyRoutes'));

// ======== DEPLOYMENT (Serve frontend in production) ========
// On Render this backend also serves the built React app. The SPA uses
// client-side routing (BrowserRouter), so any non-API request must fall back
// to index.html — otherwise refreshing a route like /chats returns "Not Found".
// NOTE: this must NOT be gated behind an extra SERVE_FRONTEND flag; if that
// flag is unset the catch-all never registers and refreshes 404.
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../frontend/dist');

  // Serve the built static assets (JS/CSS/images).
  app.use(express.static(distPath));

  // SPA fallback: send index.html for everything EXCEPT API and socket routes.
  // Those are already handled above; guarding them here means a missing API
  // route correctly 404s as JSON instead of returning the HTML shell.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}

// ======== GLOBAL ERROR HANDLER ========
app.use(errorHandler);

// ======== INITIALIZE SOCKET.IO ========
const io = initializeSocket(server);
setIO(io);

// Make io accessible in routes
app.set('io', io);

// ======== START SERVER (after MongoDB connects) ========
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB first — this is critical!
    await connectDB();

    // Then configure Cloudinary
    configureCloudinary();

    // Finally start listening
    server.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      console.log(`Client URL: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
      console.log(`Socket.IO server ready for connections`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        const altPort = parseInt(PORT, 10) + 1;
        console.error(`Port ${PORT} is already in use. Trying port ${altPort}...`);
        server.listen(altPort);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

// ======== UNHANDLED PROMISE REJECTIONS ========
// A rejected promise (e.g. a socket write to a client that dropped off with
// ECONNRESET) must NOT take the whole API down. Crashing here turned a single
// dropped TCP connection into a dead server, which the frontend then saw as a
// generic failure on every request — including login. Log it and keep serving.
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err && err.message ? err.message : err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

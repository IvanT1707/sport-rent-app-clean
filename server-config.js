// Server configuration and route registration
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Express app
const app = express();

// Apply middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`\n=== New Request ===`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Method: ${req.method} ${req.originalUrl}`);
  console.log(`Headers:`, req.headers);
  console.log(`Query:`, req.query);
  console.log(`Body:`, req.body);
  next();
});

// API Router
const apiRouter = express.Router();

// Mount API routes
require('./routes/equipment')(apiRouter);
require('./routes/rentals')(apiRouter);

// Mount API router at /api
app.use('/api', apiRouter);
console.log('Mounted API router at /api');

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from dist directory
const staticDir = path.join(__dirname, 'dist');
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  
  // Handle SPA routing - serve index.html for all other routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

module.exports = app;

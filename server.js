// server.js
console.log('=== Starting server ===');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Current working directory:', process.cwd());
console.log('__dirname:', __dirname);

import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current module's directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Initialize Firebase Admin
let serviceAccount;

// Try to get service account from environment variable first
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('Using service account from environment variable');
  } catch (error) {
    console.error('Error parsing FIREBASE_SERVICE_ACCOUNT:', error);
    process.exit(1);
  }
} else {
  // Fallback to service account file (for local development)
  try {
    serviceAccount = require('./serviceAccountKey.json');
    console.log('Using service account from file');
  } catch (error) {
    console.error('FATAL: No Firebase service account found');
    console.error('Please set FIREBASE_SERVICE_ACCOUNT environment variable or provide serviceAccountKey.json');
    process.exit(1);
  }
}

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://sportrent-a81c9-default-rtdb.europe-west1.firebasedatabase.app',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'sportrent-a81c9.appspot.com'
});

console.log('Firebase Admin initialized with project ID:', serviceAccount.project_id);

console.log('Firebase Admin initialized successfully');

const db = admin.firestore();
const app = express();

// Apply CORS middleware first
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true, // Allow credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`\n=== New Request ===`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Method: ${req.method} ${req.originalUrl}`);
  console.log(`Headers:`, req.headers);
  console.log(`Query:`, req.query);
  console.log(`Body:`, req.body);
  
  // Capture the original send function
  const originalSend = res.send;
  
  // Override the send function to log the response
  res.send = function(body) {
    console.log('Response:', {
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      headers: res.getHeaders(),
      body: body
    });
    return originalSend.apply(this, arguments);
  };
  
  next();
});

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(bodyParser.json());

// Helper function to convert Firestore timestamps to serializable format
const serializeTimestamp = (timestamp) => {
  if (!timestamp) return null;
  
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  
  if (timestamp.seconds !== undefined) {
    return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000).toISOString();
  }
  
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  
  return timestamp;
};

// Helper function to serialize Firestore document data
const serializeDocumentData = (data) => {
  const serialized = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && (value.toDate || value.seconds !== undefined)) {
      serialized[key] = serializeTimestamp(value);
    } else {
      serialized[key] = value;
    }
  }
  
  return serialized;
};

// Create API router
const apiRouter = express.Router();
console.log('Initialized API router');

// Simple test endpoint
apiRouter.get('/test', (req, res) => {
  console.log('Test endpoint called');
  res.json({ 
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Health check endpoint
apiRouter.get('/health', (req, res) => {
  console.log('Health check endpoint called');
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    platform: process.platform
  });
});

// Mount the API router at /api
app.use('/api', apiRouter);
console.log('Mounted API router at /api');



// GET /api/equipment - Get all equipment
apiRouter.get('/equipment', async (req, res) => {
  try {
    console.log('Fetching equipment from Firestore...');
    
    // Log request headers for debugging
    console.log('Request headers:', req.headers);
    console.log('Request URL:', req.originalUrl);
    
    const snapshot = await db.collection('equipment').get();
    
    if (snapshot.empty) {
      console.log('No equipment found in the database');
      return res.status(200).json({ 
        success: true, 
        data: [],
        message: 'No equipment found'
      });
    }

    const equipment = [];
    snapshot.forEach(doc => {
      console.log(`Found equipment: ${doc.id}`, doc.data());
      const data = serializeDocumentData(doc.data());
      equipment.push({
        id: doc.id,
        ...data
      });
    });
    
    console.log(`Returning ${equipment.length} equipment items`);
    res.status(200).json({ 
      success: true, 
      data: equipment,
      count: equipment.length
    });
  } catch (error) {
    console.error('Error fetching equipment:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch equipment',
      message: error.message,
      code: error.code || 'EQUIPMENT_FETCH_ERROR'
    });
  }
});

// GET /api/rentals - Get all rentals (with authentication)
apiRouter.get('/rentals', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split(' ')[1];
    let decodedToken;
    
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }
    
    const userId = decodedToken.uid;
    console.log(`Fetching rentals for user: ${userId}`);
    
    const snapshot = await db.collection('rentals')
      .where('userId', '==', userId)
      .get();
      
    const rentals = [];
    snapshot.forEach(doc => {
      const data = serializeDocumentData(doc.data());
      rentals.push({
        id: doc.id,
        ...data
      });
    });
    
    res.json({ data: rentals });
  } catch (error) {
    console.error('Error fetching rentals:', error);
    res.status(500).json({ 
      error: 'Failed to fetch rentals',
      details: error.message 
    });
  }
});

// Add debug route to check server configuration
app.get('/debug', (req, res) => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      // Routes registered directly on the app
      routes.push(`${Object.keys(middleware.route.methods).join(', ').toUpperCase()} ${middleware.route.path}`);
    } else if (middleware.name === 'router') {
      // Routes registered on a router
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push(`${Object.keys(handler.route.methods).join(', ').toUpperCase()} /api${handler.route.path}`);
        }
      });
    }
  });

  res.json({
    status: 'Server is running',
    time: new Date().toISOString(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000,
    cwd: process.cwd(),
    __dirname: __dirname,
    routes: routes.sort(),
    environmentVariables: Object.keys(process.env).filter(k => 
      k.startsWith('NODE_') || 
      k.startsWith('FIREBASE_') || 
      k === 'PORT' || 
      k === 'NODE_ENV'
    ).reduce((obj, key) => {
      obj[key] = process.env[key];
      return obj;
    }, {})
  });
});

// Mount the API router at /api
app.use('/api', apiRouter);
console.log('Mounted API router at /api');

// Redirect legacy routes to API routes
app.get('/rentals', (req, res) => {
  console.log('Legacy route /rentals called, redirecting to /api/rentals');
  res.redirect('/api/rentals');
});

app.post('/rentals', (req, res) => {
  console.log('Legacy POST /rentals called, redirecting to /api/rentals');
  res.redirect(307, '/api/rentals');
});

// Add a test route to verify the server is working
app.get('/api/test', (req, res) => {
  console.log('Test endpoint called');
  res.json({ message: 'Test endpoint is working!', timestamp: new Date().toISOString() });
});

// GET /api/rentals - Get all rentals (with authentication)
apiRouter.get('/rentals', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split(' ')[1];
    let decodedToken;
    
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }
    
    const userId = decodedToken.uid;
    console.log(`Fetching rentals for user: ${userId}`);
    
    const snapshot = await db.collection('rentals')
      .where('userId', '==', userId)
      .get();
      
    const rentals = [];
    snapshot.forEach(doc => {
      const data = serializeDocumentData(doc.data());
      rentals.push({
        id: doc.id,
        ...data
      });
    });
    
    res.json({ data: rentals });
  } catch (error) {
    console.error('Error fetching rentals:', error);
    res.status(500).json({ 
      error: 'Failed to fetch rentals',
      details: error.message 
    });
  }
});

// POST /api/rentals - Create a new rental
apiRouter.post('/rentals', async (req, res) => {
  try {
    const { equipmentId, startDate, endDate, quantity, name, price } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    let decodedToken;
    
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }
    
    const userId = decodedToken.uid;
    
    // Validate required fields
    if (!equipmentId || !startDate || !endDate || !quantity || !name || price === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['equipmentId', 'startDate', 'endDate', 'quantity', 'name', 'price']
      });
    }
    
    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (start < today) {
      return res.status(400).json({ error: 'Start date cannot be in the past' });
    }
    
    if (end <= start) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }
    
    // Validate quantity
    if (quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }
    
    // Validate equipment availability
    const equipmentRef = db.collection('equipment').doc(equipmentId);
    const equipmentDoc = await equipmentRef.get();
    
    if (!equipmentDoc.exists) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    
    const equipmentData = equipmentDoc.data();
    
    if (equipmentData.stock < quantity) {
      return res.status(400).json({ 
        error: 'Insufficient quantity available',
        available: equipmentData.stock,
        requested: quantity
      });
    }
    
    // Update equipment stock
    await equipmentRef.update({
      stock: admin.firestore.FieldValue.increment(-quantity)
    });
    
    // Create rental
    const rentalData = {
      userId,
      equipmentId,
      name: String(name), // Ensure it's a string
      price: Number(price * quantity), // Ensure it's a number
      quantity: Number(quantity), // Ensure it's a number
      startDate: admin.firestore.Timestamp.fromDate(new Date(startDate)),
      endDate: admin.firestore.Timestamp.fromDate(new Date(endDate)),
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const rentalRef = await db.collection('rentals').add(rentalData);
    
    // Return serialized data
    const responseData = {
      id: rentalRef.id,
      userId,
      equipmentId,
      name: String(name),
      price: Number(price * quantity),
      quantity: Number(quantity),
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    res.status(201).json(responseData);
    
  } catch (error) {
    console.error('Error creating rental:', error);
    res.status(500).json({ 
      error: 'Failed to create rental',
      details: error.message 
    });
  }
});

// DELETE /api/rentals/:id - Delete a rental
apiRouter.delete('/rentals/:id', async (req, res) => {
  try {
    const rentalId = req.params.id;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    let decodedToken;
    
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }
    
    const userId = decodedToken.uid;
    
    // Validate rental ownership
    const rentalDoc = await db.collection('rentals').doc(rentalId).get();
    
    if (!rentalDoc.exists) {
      return res.status(404).json({ error: 'Rental not found' });
    }
    
    const rentalData = rentalDoc.data();
    
    if (rentalData.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this rental' });
    }
    
    // Return equipment stock
    if (rentalData.equipmentId && rentalData.quantity) {
      const equipmentRef = db.collection('equipment').doc(rentalData.equipmentId);
      await equipmentRef.update({
        stock: admin.firestore.FieldValue.increment(rentalData.quantity)
      });
    }
    
    // Delete rental
    await db.collection('rentals').doc(rentalId).delete();
    
    res.status(200).json({ message: 'Rental deleted' });
  } catch (error) {
    console.error('Error deleting rental:', error);
    res.status(500).json({ 
      error: 'Failed to delete rental',
      details: error.message
    });
  }
});

// Legacy routes are now handled by the API router

// Health check endpoint (legacy route - will be removed in future versions)
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Log all registered routes
const printRoutes = (router) => {
  router.stack.forEach((middleware) => {
    if (middleware.route) {
      // Routes registered directly on the app
      const methods = Object.keys(middleware.route.methods).join(', ').toUpperCase();
      console.log(`Registered route: ${methods} ${middleware.route.path}`);
    } else if (middleware.name === 'router') {
      // Routes added as router
      middleware.handle.stack.forEach(handler => {
        if (handler.route) {
          const methods = Object.keys(handler.route.methods).join(', ').toUpperCase();
          console.log(`Registered route: ${methods} ${handler.route.path}`);
        }
      });
    }
  });
};

// Log all registered routes
console.log('\n=== Registered Routes ===');
printRoutes(app);
console.log('=========================\n');

// Log all registered routes after cleanup
console.log('\n=== Final Registered Routes ===');
printRoutes(app);
console.log('===============================\n');

// Serve static files from the dist directory
const staticDir = path.join(__dirname, 'dist');
console.log('Setting up static file serving from:', staticDir);

// Check if dist directory exists
if (!fs.existsSync(staticDir)) {
  console.error('ERROR: dist directory does not exist!');
  console.error('Please run `npm run build` to build the frontend');
} else {
  console.log('Dist directory contents:', fs.readdirSync(staticDir));
}

// Serve static files with proper caching headers
app.use(express.static(staticDir, {
  setHeaders: (res, filePath) => {
    // Set proper MIME type for JavaScript files
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
    // Disable caching for API requests
    if (filePath.includes('api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
  fallthrough: true
}));

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// API error handler
app.use('/api/*', (req, res, next) => {
  res.status(404).json({ 
    error: 'API endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Handle SPA routing - serve index.html for all other routes
app.get('*', (req, res) => {
  console.log(`Serving index.html for SPA route: ${req.originalUrl}`);
  res.sendFile(path.join(staticDir, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Щось пішло не так!' });
});

// Verify dist directory exists
const distPath = path.join(__dirname, 'dist');
console.log('Checking dist directory at:', distPath);
try {
  const distExists = fs.existsSync(distPath);
  const distContents = distExists ? fs.readdirSync(distPath) : [];
  console.log(`Dist directory exists: ${distExists}`);
  console.log(`Dist directory contents:`, distContents);
} catch (err) {
  console.error('Error checking dist directory:', err);
}

// Start the server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=== Server Started ===`);
  console.log(`Server running on port: ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Node version: ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log(`Memory usage: ${JSON.stringify(process.memoryUsage())}`);
  console.log(`Current directory: ${__dirname}`);
  console.log(`Server time: ${new Date().toISOString()}`);
  console.log(`Access the app at: http://localhost:${PORT}`);
  console.log('Waiting for requests...\n');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Необроблена помилка промісу:', err);
  server.close(() => process.exit(1));
});
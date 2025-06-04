// server.js
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

try {
  // Спершу пробуємо прочитати з файлу
  serviceAccount = require('./serviceAccountKey.json');
  console.log('Using service account from file');
} catch (error) {
  // Якщо файлу немає, перевіряємо змінні середовища
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('Using service account from environment variable');
  } else {
    console.error('FATAL: No Firebase service account found');
    process.exit(1);
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://sportrent-a81c9-default-rtdb.europe-west1.firebasedatabase.app'
});

console.log('Firebase Admin initialized successfully');

const db = admin.firestore();
const app = express();

// Middleware
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true, // Allow credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

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

// API Routes

// GET /api/equipment - Отримати всі обладнання
app.get('/api/equipment', async (req, res) => {
  try {
    console.log('Fetching equipment from Firestore...');
    const snapshot = await db.collection('equipment').get();
    
    if (snapshot.empty) {
      console.log('No equipment found in the database');
      return res.json({ data: [] });
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
    res.json({ data: equipment });
  } catch (error) {
    console.error('Помилка отримання обладнання:', error);
    res.status(500).json({ 
      error: 'Не вдалося отримати обладнання',
      details: error.message 
    });
  }
});

// GET /api/rentals - Отримати всі оренди (з авторизацією)
app.get('/api/rentals', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Необхідна авторизація' });
    }
    
    const token = authHeader.split(' ')[1];
    let decodedToken;
    
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      console.error('Помилка перевірки токена:', error);
      return res.status(401).json({ error: 'Недійсний токен' });
    }
    
    const userId = decodedToken.uid;
    
    // Отримати оренди для конкретного користувача
    const snapshot = await db.collection('rentals').where('userId', '==', userId).get();
    
    const rentals = [];
    snapshot.forEach(doc => {
      const data = serializeDocumentData(doc.data());
      rentals.push({
        id: doc.id,
        ...data
      });
    });
    
    console.log(`Returning ${rentals.length} rentals for user ${userId}`);
    res.json({ data: rentals });
  } catch (error) {
    console.error('Помилка отримання оренд:', error);
    res.status(500).json({ 
      error: 'Не вдалося отримати оренди',
      details: error.message 
    });
  }
});

// POST /api/rentals - Створити нову оренду
app.post('/api/rentals', async (req, res) => {
  try {
    const { equipmentId, startDate, endDate, quantity, name, price } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Необхідна авторизація' });
    }
    
    const token = authHeader.split(' ')[1];
    let decodedToken;
    
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      console.error('Помилка перевірки токена:', error);
      return res.status(401).json({ error: 'Недійсний токен' });
    }
    
    const userId = decodedToken.uid;
    
    // Перевірка наявності всіх необхідних даних
    if (!equipmentId || !startDate || !endDate || !quantity || !name || price === undefined) {
      return res.status(400).json({ 
        error: 'Відсутні обов\'язкові поля',
        required: ['equipmentId', 'startDate', 'endDate', 'quantity', 'name', 'price']
      });
    }
    
    // Перевірка дат
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (start < today) {
      return res.status(400).json({ error: 'Дата початку не може бути в минулому' });
    }
    
    if (end <= start) {
      return res.status(400).json({ error: 'Дата закінчення повинна бути після дати початку' });
    }
    
    // Перевірка кількості
    if (quantity <= 0) {
      return res.status(400).json({ error: 'Кількість повинна бути більше 0' });
    }
    
    // Перевірка наявності обладнання
    const equipmentRef = db.collection('equipment').doc(equipmentId);
    const equipmentDoc = await equipmentRef.get();
    
    if (!equipmentDoc.exists) {
      return res.status(404).json({ error: 'Обладнання не знайдено' });
    }
    
    const equipmentData = equipmentDoc.data();
    
    // Перевірка наявної кількості
    if (equipmentData.stock < quantity) {
      return res.status(400).json({ 
        error: 'Недостатня кількість на складі',
        available: equipmentData.stock,
        requested: quantity
      });
    }
    
    // Оновлення кількості на складі
    await equipmentRef.update({
      stock: admin.firestore.FieldValue.increment(-quantity)
    });
    
    // Створення оренди
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
    console.error('Помилка при створенні оренди:', error);
    res.status(500).json({ 
      error: 'Не вдалося створити оренду',
      details: error.message 
    });
  }
});

// DELETE /api/rentals/:id - Видалити оренду
app.delete('/api/rentals/:id', async (req, res) => {
  try {
    const rentalId = req.params.id;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Необхідна авторизація' });
    }
    
    const token = authHeader.split(' ')[1];
    let decodedToken;
    
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      console.error('Помилка перевірки токена:', error);
      return res.status(401).json({ error: 'Недійсний токен' });
    }
    
    const userId = decodedToken.uid;
    
    // Перевірити, чи належить оренда користувачу
    const rentalDoc = await db.collection('rentals').doc(rentalId).get();
    
    if (!rentalDoc.exists) {
      return res.status(404).json({ error: 'Оренду не знайдено' });
    }
    
    const rentalData = rentalDoc.data();
    
    if (rentalData.userId !== userId) {
      return res.status(403).json({ error: 'Немає прав для видалення цієї оренди' });
    }
    
    // Повернути кількість на склад
    if (rentalData.equipmentId && rentalData.quantity) {
      const equipmentRef = db.collection('equipment').doc(rentalData.equipmentId);
      await equipmentRef.update({
        stock: admin.firestore.FieldValue.increment(rentalData.quantity)
      });
    }
    
    // Видалити оренду
    await db.collection('rentals').doc(rentalId).delete();
    
    res.status(200).json({ message: 'Оренду видалено' });
  } catch (error) {
    console.error('Помилка при видаленні оренди:', error);
    res.status(500).json({ 
      error: 'Не вдалося видалити оренду',
      details: error.message 
    });
  }
});

// Legacy routes for backward compatibility (removed duplicates)

// GET /rentals - Redirect to API route
app.get('/rentals', (req, res) => {
  res.redirect('/api/rentals');
});

// POST /rentals - Redirect to API route
app.post('/rentals', (req, res) => {
  res.redirect(307, '/api/rentals'); // 307 preserves the POST method
});

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist'), {
  setHeaders: (res, filePath) => {
    // Set proper MIME type for JavaScript files
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Handle SPA routing - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Щось пішло не так!' });
});

// Start the server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
  console.log(`Доступно за посиланням: http://localhost:${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Необроблена помилка промісу:', err);
  server.close(() => process.exit(1));
});
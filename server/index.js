/**
 * Our Space — Express API Server
 * Entry point: loads middleware, mounts routes, handles errors
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { getDb, ensureInitialized } = require('./db/connection');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Compression & Security ──
app.use(compression());
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));

// ── CORS ──
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://ourverse.my.id',
  'http://ourverse.my.id',
  process.env.CORS_ORIGIN
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    
    // Check if origin matches allowed list or vercel preview domains or ourverse.my.id
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.includes('ourverse.my.id') ||
      process.env.NODE_ENV !== 'production'
    ) {
      return callback(null, true);
    }
    
    // In production, also allow request origin to prevent browser CORS blocking
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Pre-flight requests
app.options('*', cors());

// ── Body Parsing ──
// Handle pre-parsed bodies from serverless platforms (e.g. Vercel @vercel/node)
app.use((req, res, next) => {
  if (req.body !== undefined) {
    if (typeof req.body === 'string' && req.headers['content-type']?.includes('application/json')) {
      try {
        req.body = JSON.parse(req.body);
      } catch (e) {
        // Leave as is for express.json to handle
      }
    }
    req._body = true;
  }
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// ── Trust proxy (behind Nginx) ──
app.set('trust proxy', 1);

// ── Initialize Database ──
app.use('/api', async (req, res, next) => {
  try {
    await ensureInitialized();
    next();
  } catch (err) {
    console.error('Database initialization failed:', err);
    res.status(500).json({ error: `DB Init failed: ${err.message}` });
  }
});

// ── Serve uploads ──
const uploadsPath = process.env.UPLOADS_PATH || (process.env.VERCEL ? '/tmp/uploads' : '/var/data/ourspace/uploads');
app.use('/uploads', express.static(uploadsPath, {
  maxAge: '1d',
  etag: true
}));

// ── API Routes ──
app.use('/api/auth', require('./routes/auth'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/stories', require('./routes/stories'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/push', require('./routes/push'));

// ── Health Check ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Serve Client Build (production) ──
const clientBuildPath = path.resolve(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath, {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// ── 404 Handler ──
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// ── SPA Fallback — serve index.html for all non-API routes ──
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// ── Global Error Handler ──
app.use((err, req, res, next) => {
  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large. Maximum sizes: images 10MB, videos 50MB, audio 20MB'
    });
  }

  // Multer file type error
  if (err.message && err.message.includes('File type')) {
    return res.status(400).json({ error: err.message });
  }

  // Multer too many files
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ error: 'Too many files. Maximum 10 files per upload.' });
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start Server (skip in Vercel serverless) ──
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[Our Space] Server running on port ${PORT}`);
    console.log(`[Our Space] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[Our Space] Database: ${process.env.DB_PATH || '/var/data/ourspace/ourspace.db'}`);
  });
}

module.exports = app;

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const express    = require('express');
const cors       = require('cors');
const connectDB  = require('./config/db');

const authRoutes          = require('./routes/authRoutes');
const adminRoutes         = require('./routes/adminRoutes');
const adminMaterialRoutes = require('./routes/adminMaterialRoutes');
const adminRoundRoutes    = require('./routes/adminRoundRoutes');
const gameRoutes          = require('./routes/gameRoutes');

const Student    = require('./models/Student');

// ── Connect to MongoDB & auto-seed admin ───────────────────
async function initDB() {
  await connectDB();

  // ── Drop stale unique index on rollNo (removed from schema) ──
  // Mongoose does NOT auto-drop indexes when unique:true is removed from the schema.
  // If the old index still exists in MongoDB, duplicate rollNos would fail silently.
  try {
    const collection = Student.collection;
    const indexes    = await collection.indexes();
    const hasRollIdx = indexes.some(idx => idx.key && idx.key.rollNo !== undefined && idx.unique);
    if (hasRollIdx) {
      await collection.dropIndex('rollNo_1');
      console.log('[server] ✅ Dropped stale unique index on rollNo — duplicates now allowed');
    }
  } catch (err) {
    // Index may not exist or already dropped — safe to ignore
    console.log('[server] rollNo index cleanup (skipped or already clean):', err.message);
  }

  // Auto-create admin on first boot (safe if already exists)
  try {
    const email    = process.env.ADMIN_EMAIL;
    const rollNo   = (process.env.ADMIN_ROLL_NO || '').toUpperCase().trim();
    const password = process.env.ADMIN_PASSWORD;

    if (email && rollNo && password) {
      const existing = await Student.findOne({ $or: [{ email }, { rollNo }] });
      if (!existing) {
        await Student.create({ email, rollNo, password, role: 'admin', name: 'Admin' });
        console.log(`[server] ✅ Admin account auto-created (${email})`);
      } else {
        console.log(`[server] Admin already exists — skipping seed`);
      }
    } else {
      console.warn('[server] ⚠️  ADMIN_EMAIL / ADMIN_ROLL_NO / ADMIN_PASSWORD not set — skipping admin seed');
    }
  } catch (err) {
    console.error('[server] Admin seed error:', err.message);
  }
}

initDB();

const app = express();

// ── CORS — allow the frontend origin ──────────────────────
const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Always allow localhost variants for development
['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000'].forEach(o => {
  if (!allowedOrigins.includes(o)) allowedOrigins.push(o);
});

// Auto-allow *.onrender.com (Render hosting)
const corsOriginFn = (origin, cb) => {
  if (!origin) return cb(null, true);
  if (allowedOrigins.includes(origin)) return cb(null, true);
  if (/\.onrender\.com$/.test(origin)) return cb(null, true);
  cb(new Error('CORS: origin not allowed — ' + origin));
};

app.use(cors({
  origin: corsOriginFn,
  credentials: true
}));

// ── Body parsing ───────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



// ── API routes (registered BEFORE static files so they always take priority) ──
app.use('/api/auth',            authRoutes);
app.use('/api/admin/students',  adminRoutes);
app.use('/api/admin/materials', adminMaterialRoutes);
app.use('/api/admin/rounds',    adminRoundRoutes);
app.use('/api/game',            gameRoutes);

// ── Health check ───────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ success: true, message: 'Techno Bridge API is running' }));

// ── 404 for unknown API routes ─────────────────────────────
app.use('/api', (req, res) => {
  console.warn(`[server] 404 API route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

// ── Serve frontend files statically (after API routes) ────
app.use(express.static(path.join(__dirname, '..', 'frontend')));
// Also serve root files (api.js, index.html, rounds_menu.html, ...)
app.use(express.static(path.join(__dirname, '..')));

// ── Global error handler ───────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[server] Unhandled error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// ── Start listening ────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] Techno Bridge backend listening on port ${PORT}`);
});

// ── Graceful shutdown ──────────────────────────────────────
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
process.on('SIGINT',  () => { server.close(() => process.exit(0)); });

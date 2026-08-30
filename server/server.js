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

// ── Connect to MongoDB ─────────────────────────────────────
connectDB();

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

app.use(cors({
  origin (origin, cb) {
    // Allow requests with no origin (e.g. file:// opened directly)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed — ' + origin));
  },
  credentials: true
}));

// ── Body parsing ───────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Serve frontend files statically ───────────────────────
app.use(express.static(path.join(__dirname, '..', 'frontend')));
// Also serve root files (api.js, index.html, rounds_menu.html, ...)
app.use(express.static(path.join(__dirname, '..')));

// ── API routes ─────────────────────────────────────────────
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
const server = app.listen(PORT, () => {
  console.log(`[server] Techno Bridge backend listening on http://localhost:${PORT}`);
});

// ── Graceful shutdown ──────────────────────────────────────
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
process.on('SIGINT',  () => { server.close(() => process.exit(0)); });

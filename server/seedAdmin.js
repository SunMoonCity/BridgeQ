'use strict';

/**
 * npm run seed:admin
 *
 * Creates the first admin account using credentials from .env:
 *   ADMIN_EMAIL, ADMIN_ROLL_NO, ADMIN_PASSWORD
 *
 * Safe to run multiple times — if the admin already exists it simply
 * reports so and exits cleanly.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_) {}

const mongoose = require('mongoose');
const Student  = require('./models/Student');

async function seedAdmin() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('ERROR: MONGODB_URI not set in .env'); process.exit(1); }

  await mongoose.connect(uri);
  console.log('[seed] Connected to MongoDB Atlas');

  const email    = process.env.ADMIN_EMAIL;
  const rollNo   = (process.env.ADMIN_ROLL_NO || '').toUpperCase().trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !rollNo || !password) {
    console.error('ERROR: ADMIN_EMAIL, ADMIN_ROLL_NO, and ADMIN_PASSWORD must be set in .env');
    await mongoose.disconnect();
    process.exit(1);
  }

  // Check if admin already exists
  const existing = await Student.findOne({ $or: [{ email }, { rollNo }] });
  if (existing) {
    console.log(`[seed] Admin already exists (${existing.rollNo} / ${existing.email}). Nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  // Create admin — the pre-save hook hashes the password automatically
  const admin = await Student.create({ email, rollNo, password, role: 'admin', name: 'Admin' });
  console.log(`[seed] ✅ Admin created successfully!`);
  console.log(`       Roll No : ${admin.rollNo}`);
  console.log(`       Email   : ${admin.email}`);
  console.log(`       Role    : ${admin.role}`);

  await mongoose.disconnect();
}

seedAdmin().catch(err => {
  console.error('[seed] Error:', err.message);
  process.exit(1);
});

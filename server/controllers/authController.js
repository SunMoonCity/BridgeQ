'use strict';

const jwt     = require('jsonwebtoken');
const Student = require('../models/Student');

/* ── Helper: sign a JWT for a student ─────────────────── */
function signToken(studentId) {
  return jwt.sign(
    { id: studentId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/* ── POST /api/auth/login ─────────────────────────────── */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    // Explicitly select password (excluded by default)
    const student = await Student.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!student) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await student.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = signToken(student._id);

    // Return user without password (toJSON strips it)
    const userObj = student.toJSON();

    return res.status(200).json({
      success: true,
      token,
      user: {
        id:     userObj._id,
        rollNo: userObj.rollNo,
        email:  userObj.email,
        name:   userObj.name,
        role:   userObj.role
      }
    });
  } catch (err) {
    console.error('[auth] login error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/* ── GET /api/auth/me ──────────────────────────────────── */
async function getMe(req, res) {
  // req.user is already set by authenticateToken middleware
  const u = req.user;
  return res.status(200).json({
    success: true,
    user: {
      id:         u._id,
      rollNo:     u.rollNo,
      email:      u.email,
      name:       u.name,
      role:       u.role,
      department: u.department,
      year:       u.year,
      createdAt:  u.createdAt
    }
  });
}

module.exports = { login, getMe };

'use strict';

const jwt     = require('jsonwebtoken');
const Student = require('../models/Student');

/**
 * authenticateToken
 * Reads the JWT from  Authorization: Bearer <token>
 * Verifies it, loads the student from DB, and attaches to req.user.
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied — no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Re-fetch from DB so we always have the latest role/data
    const student = await Student.findById(decoded.id);
    if (!student) {
      return res.status(401).json({ success: false, message: 'Token is valid but user no longer exists' });
    }

    req.user = student;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired — please log in again' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

module.exports = { authenticateToken };

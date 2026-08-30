'use strict';

/**
 * requireAdmin
 * Must be used AFTER authenticateToken.
 * Rejects any request whose user is not an admin.
 * The role is read from the DB-loaded req.user — never from the client.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden — admin access required'
    });
  }
  next();
}

module.exports = { requireAdmin };

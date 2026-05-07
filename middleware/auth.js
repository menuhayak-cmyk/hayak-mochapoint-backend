'use strict';
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

/** Verify JWTs from Authorization header — protects admin routes */
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized — no token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    logger.warn('Invalid token attempt', { ip: req.ip });
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/** Write to audit_log table — non-blocking */
async function auditLog(userEmail, action, entity = null, entityId = null, ip = null) {
  try {
    await pool.query(
      'INSERT INTO audit_log (user_email, action, entity, entity_id, ip) VALUES ($1,$2,$3,$4,$5)',
      [userEmail, action, entity, String(entityId ?? ''), ip]
    );
  } catch (err) {
    logger.error('Audit log write failed', { err: err.message });
  }
}

module.exports = { verifyToken, auditLog };

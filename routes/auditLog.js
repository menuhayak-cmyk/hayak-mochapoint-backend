'use strict';
const express  = require('express');
const router   = express.Router();
const { pool } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const logger   = require('../utils/logger');

// GET /api/audit-log — admin only, last 50 entries
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 50'
    );
    return res.json({ data: result.rows });
  } catch (err) {
    logger.error('GET /audit-log error', { err: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

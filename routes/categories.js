'use strict';
const express  = require('express');
const router   = express.Router();
const { pool } = require('../config/database');
const { verifyToken, auditLog } = require('../middleware/auth');
const { validate, categorySchema } = require('../utils/validators');
const logger   = require('../utils/logger');

// GET /api/categories — public
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM categories WHERE is_active = TRUE ORDER BY sort_order ASC, id ASC'
    );
    return res.json({ data: result.rows });
  } catch (err) {
    logger.error('GET /categories error', { err: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/categories/admin/all — admin only (includes inactive)
router.get('/admin/all', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM categories ORDER BY sort_order ASC, id ASC'
    );
    return res.json({ data: result.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/categories — admin only
router.post('/', verifyToken, validate(categorySchema), async (req, res) => {
  const { name_ar, name_tr, icon, sort_order, is_active } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO categories (name_ar, name_tr, icon, sort_order, is_active) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name_ar, name_tr, icon ?? '☕', sort_order ?? 0, is_active ?? true]
    );
    await auditLog(req.user.email, 'CATEGORY_CREATE', 'categories', result.rows[0].id, req.ip);
    return res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    logger.error('POST /categories error', { err: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/categories/:id — admin only
router.put('/:id', verifyToken, validate(categorySchema), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
  const { name_ar, name_tr, icon, sort_order, is_active } = req.body;
  try {
    const result = await pool.query(
      'UPDATE categories SET name_ar=$1, name_tr=$2, icon=$3, sort_order=$4, is_active=$5 WHERE id=$6 RETURNING *',
      [name_ar, name_tr, icon, sort_order, is_active, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Category not found' });
    await auditLog(req.user.email, 'CATEGORY_UPDATE', 'categories', id, req.ip);
    return res.json({ data: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/categories/:id — admin only
router.delete('/:id', verifyToken, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
  try {
    await pool.query('UPDATE categories SET is_active = FALSE WHERE id = $1', [id]);
    await auditLog(req.user.email, 'CATEGORY_DELETE', 'categories', id, req.ip);
    return res.json({ message: 'Category deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

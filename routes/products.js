'use strict';
const express  = require('express');
const router   = express.Router();
const { pool } = require('../config/database');
const { verifyToken, auditLog } = require('../middleware/auth');
const { validate, productSchema } = require('../utils/validators');
const logger   = require('../utils/logger');

// ── GET /api/products ─────────────────────────────────────────────────────────
// Public — supports ?category_id=X&featured=true&active=true
router.get('/', async (req, res) => {
  try {
    const { category_id, featured, search } = req.query;
    let sql = `
      SELECT p.*, c.name_ar AS category_name, c.name_tr AS category_name_tr, c.icon AS category_icon
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = TRUE
    `;
    const params = [];

    if (category_id) {
      params.push(parseInt(category_id));
      sql += ` AND p.category_id = $${params.length}`;
    }
    if (featured === 'true') {
      sql += ` AND p.is_featured = TRUE`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (p.name_ar ILIKE $${params.length})`;
    }

    sql += ' ORDER BY p.sort_order ASC, p.id ASC';

    const result = await pool.query(sql, params);
    return res.json({ data: result.rows, count: result.rowCount });
  } catch (err) {
    logger.error('GET /products error', { err: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/products/admin/all ───────────────────────────────────────────────
// Admin only — returns all including inactive (must be before /:id)
router.get('/admin/all', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, c.name_ar AS category_name FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ORDER BY p.sort_order ASC, p.id ASC`
    );
    return res.json({ data: result.rows, count: result.rowCount });
  } catch (err) {
    logger.error('GET /products/admin/all error', { err: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/products/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const result = await pool.query(
      `SELECT p.*, c.name_ar AS category_name, c.name_tr AS category_name_tr FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1 AND p.is_active = TRUE`,
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
    return res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error('GET /products/:id error', { err: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/products ────────────────────────────────────────────────────────
router.post('/', verifyToken, validate(productSchema), async (req, res) => {
  const { name_ar, name_tr, price, category_id, image_url, ingredients, ingredients_tr, badge, badge_tr, is_featured, is_active, sort_order } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO products (name_ar, name_tr, price, category_id, image_url, ingredients, ingredients_tr, badge, badge_tr, is_featured, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [name_ar, name_tr, price, category_id, image_url, ingredients, ingredients_tr, badge, badge_tr, is_featured ?? false, is_active ?? true, sort_order ?? 0]
    );
    const product = result.rows[0];
    await auditLog(req.user.email, 'PRODUCT_CREATE', 'products', product.id, req.ip);
    logger.info('Product created', { id: product.id, by: req.user.email });
    return res.status(201).json({ data: product });
  } catch (err) {
    logger.error('POST /products error', { err: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/products/:id ─────────────────────────────────────────────────────
router.put('/:id', verifyToken, validate(productSchema), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  const { name_ar, name_tr, price, category_id, image_url, ingredients, ingredients_tr, badge, badge_tr, is_featured, is_active, sort_order } = req.body;
  try {
    const result = await pool.query(
      `UPDATE products SET
         name_ar=$1, name_tr=$2, price=$3, category_id=$4, image_url=$5,
         ingredients=$6, ingredients_tr=$7, badge=$8, badge_tr=$9, is_featured=$10, is_active=$11, sort_order=$12
       WHERE id=$13 RETURNING *`,
      [name_ar, name_tr, price, category_id, image_url, ingredients, ingredients_tr, badge, badge_tr, is_featured, is_active, sort_order, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
    await auditLog(req.user.email, 'PRODUCT_UPDATE', 'products', id, req.ip);
    return res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error('PUT /products/:id error', { err: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/products/:id (soft delete) ────────────────────────────────────
router.delete('/:id', verifyToken, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const result = await pool.query(
      'UPDATE products SET is_active = FALSE WHERE id = $1 RETURNING id',
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
    await auditLog(req.user.email, 'PRODUCT_DELETE', 'products', id, req.ip);
    return res.json({ message: 'Product deleted' });
  } catch (err) {
    logger.error('DELETE /products/:id error', { err: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});


module.exports = router;

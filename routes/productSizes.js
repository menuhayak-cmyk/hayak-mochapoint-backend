'use strict';
const express  = require('express');
const router   = express.Router();
const { pool } = require('../config/database');
const { verifyToken, auditLog } = require('../middleware/auth');
const { validate, productSizeSchema } = require('../utils/validators');
const logger   = require('../utils/logger');

// ── GET /api/product-sizes/:productId ─────────────────────────────────────────
// Public — get all active sizes for a product
router.get('/:productId', async (req, res) => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) return res.status(400).json({ error: 'Invalid product ID' });

  try {
    const result = await pool.query(
      `SELECT * FROM product_sizes
       WHERE product_id = $1 AND is_active = TRUE
       ORDER BY sort_order ASC, id ASC`,
      [productId]
    );
    return res.json({ data: result.rows });
  } catch (err) {
    logger.error('GET /product-sizes/:productId error', { err: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/product-sizes/:productId/admin ───────────────────────────────────
// Admin only — get all sizes (including inactive) for a product
router.get('/:productId/admin', verifyToken, async (req, res) => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) return res.status(400).json({ error: 'Invalid product ID' });

  try {
    const result = await pool.query(
      `SELECT * FROM product_sizes
       WHERE product_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [productId]
    );
    return res.json({ data: result.rows });
  } catch (err) {
    logger.error('GET /product-sizes/:productId/admin error', { err: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/product-sizes/:productId ────────────────────────────────────────
// Admin only — add a size to a product
router.post('/:productId', verifyToken, validate(productSizeSchema), async (req, res) => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) return res.status(400).json({ error: 'Invalid product ID' });

  const { name_ar, name_tr, price, sort_order, is_active } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO product_sizes (product_id, name_ar, name_tr, price, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [productId, name_ar, name_tr ?? null, price, sort_order ?? 0, is_active ?? true]
    );
    const size = result.rows[0];
    await auditLog(req.user.email, 'PRODUCT_SIZE_CREATE', 'product_sizes', size.id, req.ip);
    logger.info('Product size created', { id: size.id, productId, by: req.user.email });
    return res.status(201).json({ data: size });
  } catch (err) {
    logger.error('POST /product-sizes/:productId error', { err: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/product-sizes/:productId/:sizeId ─────────────────────────────────
// Admin only — update a size
router.put('/:productId/:sizeId', verifyToken, validate(productSizeSchema), async (req, res) => {
  const productId = parseInt(req.params.productId);
  const sizeId    = parseInt(req.params.sizeId);
  if (isNaN(productId) || isNaN(sizeId)) return res.status(400).json({ error: 'Invalid ID' });

  const { name_ar, name_tr, price, sort_order, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE product_sizes
       SET name_ar=$1, name_tr=$2, price=$3, sort_order=$4, is_active=$5
       WHERE id=$6 AND product_id=$7
       RETURNING *`,
      [name_ar, name_tr ?? null, price, sort_order ?? 0, is_active ?? true, sizeId, productId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Size not found' });
    await auditLog(req.user.email, 'PRODUCT_SIZE_UPDATE', 'product_sizes', sizeId, req.ip);
    return res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error('PUT /product-sizes/:productId/:sizeId error', { err: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/product-sizes/:productId/:sizeId ──────────────────────────────
// Admin only — delete a size
router.delete('/:productId/:sizeId', verifyToken, async (req, res) => {
  const productId = parseInt(req.params.productId);
  const sizeId    = parseInt(req.params.sizeId);
  if (isNaN(productId) || isNaN(sizeId)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const result = await pool.query(
      'DELETE FROM product_sizes WHERE id=$1 AND product_id=$2 RETURNING id',
      [sizeId, productId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Size not found' });
    await auditLog(req.user.email, 'PRODUCT_SIZE_DELETE', 'product_sizes', sizeId, req.ip);
    return res.json({ message: 'Size deleted' });
  } catch (err) {
    logger.error('DELETE /product-sizes/:productId/:sizeId error', { err: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/product-sizes/:productId/bulk ───────────────────────────────────
// Admin only — replace all sizes for a product in one shot
router.post('/:productId/bulk', verifyToken, async (req, res) => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) return res.status(400).json({ error: 'Invalid product ID' });

  const { sizes } = req.body; // array of { name_ar, name_tr, price, sort_order }
  if (!Array.isArray(sizes)) return res.status(400).json({ error: 'sizes must be an array' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Delete existing sizes
    await client.query('DELETE FROM product_sizes WHERE product_id=$1', [productId]);
    // Insert new sizes
    for (let i = 0; i < sizes.length; i++) {
      const { name_ar, name_tr, price } = sizes[i];
      if (!name_ar || !price) continue;
      await client.query(
        `INSERT INTO product_sizes (product_id, name_ar, name_tr, price, sort_order)
         VALUES ($1,$2,$3,$4,$5)`,
        [productId, name_ar, name_tr ?? null, price, i]
      );
    }
    await client.query('COMMIT');
    const result = await pool.query(
      'SELECT * FROM product_sizes WHERE product_id=$1 ORDER BY sort_order ASC',
      [productId]
    );
    await auditLog(req.user.email, 'PRODUCT_SIZES_BULK_UPDATE', 'product_sizes', productId, req.ip);
    return res.json({ data: result.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('POST /product-sizes/:productId/bulk error', { err: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;

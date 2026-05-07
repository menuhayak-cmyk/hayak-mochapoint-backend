'use strict';
const express  = require('express');
const router   = express.Router();
const { pool } = require('../config/database');
const { verifyToken, auditLog } = require('../middleware/auth');
const { validate, heroSlideSchema } = require('../utils/validators');
const logger   = require('../utils/logger');

// ── GET /api/hero-slides ─────────────────────────────────────────────────────────
// Public — returns all active slides
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM hero_slides WHERE is_active = TRUE ORDER BY id ASC`
    );
    return res.json({ data: result.rows, count: result.rowCount });
  } catch (err) {
    logger.error('GET /hero-slides error', { err: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/hero-slides/admin/all ───────────────────────────────────────────────
// Admin only — returns all including inactive
router.get('/admin/all', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM hero_slides ORDER BY id ASC`
    );
    return res.json({ data: result.rows, count: result.rowCount });
  } catch (err) {
    logger.error('GET /hero-slides/admin/all error', { err: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/hero-slides ────────────────────────────────────────────────────────
router.post('/', verifyToken, validate(heroSlideSchema), async (req, res) => {
  const { image_url, title, title_tr, subtitle, subtitle_tr, is_active } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO hero_slides (image_url, title, title_tr, subtitle, subtitle_tr, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [image_url, title, title_tr, subtitle, subtitle_tr, is_active]
    );
    const slide = result.rows[0];
    await auditLog(req.user.email, 'HERO_SLIDE_CREATE', 'hero_slides', slide.id, req.ip);
    return res.status(201).json({ data: slide });
  } catch (err) {
    logger.error('POST /hero-slides error', { err: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/hero-slides/:id ─────────────────────────────────────────────────────
router.put('/:id', verifyToken, validate(heroSlideSchema), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  const { image_url, title, title_tr, subtitle, subtitle_tr, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE hero_slides SET
         image_url=$1, title=$2, title_tr=$3, subtitle=$4, subtitle_tr=$5, is_active=$6
       WHERE id=$7 RETURNING *`,
      [image_url, title, title_tr, subtitle, subtitle_tr, is_active, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Slide not found' });
    await auditLog(req.user.email, 'HERO_SLIDE_UPDATE', 'hero_slides', id, req.ip);
    return res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error('PUT /hero-slides/:id error', { err: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/hero-slides/:id ────────────────────────────────────
router.delete('/:id', verifyToken, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const result = await pool.query(
      'DELETE FROM hero_slides WHERE id = $1 RETURNING id',
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Slide not found' });
    await auditLog(req.user.email, 'HERO_SLIDE_DELETE', 'hero_slides', id, req.ip);
    return res.json({ message: 'Slide deleted' });
  } catch (err) {
    logger.error('DELETE /hero-slides/:id error', { err: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

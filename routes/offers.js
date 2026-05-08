'use strict';
const express  = require('express');
const router   = express.Router();
const { pool } = require('../config/database');
const { verifyToken, auditLog } = require('../middleware/auth');
const { validate, offerSchema, dailyPickSchema } = require('../utils/validators');
const logger   = require('../utils/logger');

// ── OFFERS ───────────────────────────────────────────────────────────────────

router.get('/offers', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM offers WHERE is_active = TRUE ORDER BY sort_order ASC, id ASC'
    );
    return res.json({ data: result.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/offers/admin/all', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM offers ORDER BY sort_order ASC, id ASC');
    return res.json({ data: result.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/offers', verifyToken, validate(offerSchema), async (req, res) => {
  const { image_url, alt_text, alt_text_tr, sort_order, is_active } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO offers (image_url, alt_text, alt_text_tr, sort_order, is_active) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [image_url, alt_text, alt_text_tr, sort_order ?? 0, is_active ?? true]
    );
    await auditLog(req.user.email, 'OFFER_CREATE', 'offers', result.rows[0].id, req.ip);
    return res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/offers/:id', verifyToken, validate(offerSchema), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
  const { image_url, alt_text, alt_text_tr, sort_order, is_active } = req.body;
  try {
    const result = await pool.query(
      'UPDATE offers SET image_url=$1, alt_text=$2, alt_text_tr=$3, sort_order=$4, is_active=$5 WHERE id=$6 RETURNING *',
      [image_url, alt_text, alt_text_tr, sort_order, is_active, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Offer not found' });
    await auditLog(req.user.email, 'OFFER_UPDATE', 'offers', id, req.ip);
    return res.json({ data: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/offers/:id', verifyToken, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
  try {
    await pool.query('UPDATE offers SET is_active = FALSE WHERE id = $1', [id]);
    await auditLog(req.user.email, 'OFFER_DELETE', 'offers', id, req.ip);
    return res.json({ message: 'Offer deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DAILY PICKS ──────────────────────────────────────────────────────────────

router.get('/daily-picks', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM daily_picks WHERE is_active = TRUE ORDER BY id ASC'
    );
    return res.json({ data: result.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/daily-picks/admin/all', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM daily_picks ORDER BY id ASC');
    return res.json({ data: result.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/daily-picks', verifyToken, validate(dailyPickSchema), async (req, res) => {
  const { title, title_tr, subtitle, subtitle_tr, price, emoji, is_active } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO daily_picks (title, title_tr, subtitle, subtitle_tr, price, emoji, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [title, title_tr, subtitle, subtitle_tr, price, emoji, is_active ?? true]
    );
    await auditLog(req.user.email, 'DAILY_PICK_CREATE', 'daily_picks', result.rows[0].id, req.ip);
    return res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/daily-picks/:id', verifyToken, validate(dailyPickSchema), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
  const { title, title_tr, subtitle, subtitle_tr, price, emoji, is_active } = req.body;
  try {
    const result = await pool.query(
      'UPDATE daily_picks SET title=$1, title_tr=$2, subtitle=$3, subtitle_tr=$4, price=$5, emoji=$6, is_active=$7 WHERE id=$8 RETURNING *',
      [title, title_tr, subtitle, subtitle_tr, price, emoji, is_active, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Daily pick not found' });
    await auditLog(req.user.email, 'DAILY_PICK_UPDATE', 'daily_picks', id, req.ip);
    return res.json({ data: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/daily-picks/:id', verifyToken, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
  try {
    await pool.query('UPDATE daily_picks SET is_active = FALSE WHERE id = $1', [id]);
    await auditLog(req.user.email, 'DAILY_PICK_DELETE', 'daily_picks', id, req.ip);
    return res.json({ message: 'Daily pick deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

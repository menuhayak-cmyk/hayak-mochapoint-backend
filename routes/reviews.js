'use strict';
const express = require('express');
const router = express.Router();
const { pool: db } = require('../config/database');
const { reviewSchema, validate } = require('../utils/validators');
const { verifyToken } = require('../middleware/auth');

// Public: Get all active reviews
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM reviews WHERE is_active = true ORDER BY id DESC'
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Get all reviews
router.get('/admin/all', verifyToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM reviews ORDER BY id DESC');
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Error fetching all reviews:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Create review
router.post('/', verifyToken, validate(reviewSchema), async (req, res) => {
  const { name, rating, comment, comment_tr, is_active } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO reviews (name, rating, comment, comment_tr, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, rating, comment, comment_tr || null, is_active ?? true]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    console.error('Error creating review:', err);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// Admin: Update review
router.put('/:id', verifyToken, validate(reviewSchema), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  const { name, rating, comment, comment_tr, is_active } = req.body;
  try {
    const result = await db.query(
      `UPDATE reviews 
       SET name = $1, rating = $2, comment = $3, comment_tr = $4, is_active = $5
       WHERE id = $6 RETURNING *`,
      [name, rating, comment, comment_tr || null, is_active ?? true, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Error updating review:', err);
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// Admin: Delete review
router.delete('/:id', verifyToken, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const result = await db.query('DELETE FROM reviews WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }
    res.json({ message: 'Review deleted successfully' });
  } catch (err) {
    console.error('Error deleting review:', err);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

module.exports = router;

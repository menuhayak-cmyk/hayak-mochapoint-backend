const express = require('express');
const router = express.Router();
const { pool: db } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

// GET /api/contact - Public route for frontend
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM contact_info WHERE is_active = true ORDER BY sort_order ASC, created_at DESC'
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching contact info:', error);
    res.status(500).json({ error: 'Failed to fetch contact info' });
  }
});

// GET /api/contact/admin/all - Admin route to get all (including inactive)
router.get('/admin/all', verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM contact_info ORDER BY sort_order ASC, created_at DESC'
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching admin contact info:', error);
    res.status(500).json({ error: 'Failed to fetch contact info' });
  }
});

// POST /api/contact/admin - Create new contact info
router.post('/admin', verifyToken, async (req, res) => {
  const { type, title_ar, title_tr, detail, detail_tr, icon, sort_order, is_active } = req.body;
  if (!type || !title_ar || !detail) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await db.query(
      `INSERT INTO contact_info (type, title_ar, title_tr, detail, detail_tr, icon, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [type, title_ar, title_tr, detail, detail_tr, icon || 'Phone', sort_order || 0, is_active ?? true]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error creating contact info:', error);
    res.status(500).json({ error: 'Failed to create contact info' });
  }
});

// PUT /api/contact/admin/:id - Update contact info
router.put('/admin/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { type, title_ar, title_tr, detail, detail_tr, icon, sort_order, is_active } = req.body;

  try {
    const result = await db.query(
      `UPDATE contact_info
       SET type = COALESCE($1, type),
           title_ar = COALESCE($2, title_ar),
           title_tr = COALESCE($3, title_tr),
           detail = COALESCE($4, detail),
           detail_tr = COALESCE($5, detail_tr),
           icon = COALESCE($6, icon),
           sort_order = COALESCE($7, sort_order),
           is_active = COALESCE($8, is_active)
       WHERE id = $9
       RETURNING *`,
      [type, title_ar, title_tr, detail, detail_tr, icon, sort_order, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact info not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error updating contact info:', error);
    res.status(500).json({ error: 'Failed to update contact info' });
  }
});

// DELETE /api/contact/admin/:id - Delete contact info
router.delete('/admin/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      'DELETE FROM contact_info WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact info not found' });
    }

    res.json({ message: 'Contact info deleted successfully' });
  } catch (error) {
    console.error('Error deleting contact info:', error);
    res.status(500).json({ error: 'Failed to delete contact info' });
  }
});

module.exports = router;

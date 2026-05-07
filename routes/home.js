'use strict';
const express  = require('express');
const router   = express.Router();
const { pool } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const [
      heroSlidesRes,
      offersRes,
      dailyPicksRes,
      categoriesRes,
      productsRes,
      reviewsRes
    ] = await Promise.all([
      pool.query('SELECT * FROM hero_slides WHERE is_active = TRUE ORDER BY sort_order ASC, id ASC'),
      pool.query('SELECT * FROM offers WHERE is_active = TRUE ORDER BY sort_order ASC, id ASC'),
      pool.query('SELECT * FROM daily_picks WHERE is_active = TRUE ORDER BY id ASC'),
      pool.query('SELECT * FROM categories WHERE is_active = TRUE ORDER BY sort_order ASC, id ASC'),
      pool.query(`
        SELECT p.*, c.name_ar AS category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_active = TRUE
        ORDER BY p.sort_order ASC, p.id ASC
      `),
      pool.query('SELECT * FROM reviews WHERE is_active = TRUE ORDER BY created_at DESC')
    ]);

    return res.json({
      data: {
        heroSlides: heroSlidesRes.rows,
        offers: offersRes.rows,
        dailyPicks: dailyPicksRes.rows,
        categories: categoriesRes.rows,
        products: productsRes.rows,
        reviews: reviewsRes.rows
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

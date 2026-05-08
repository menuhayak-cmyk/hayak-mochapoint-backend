'use strict';
require('dotenv').config();
const bcrypt   = require('bcryptjs');
const { pool } = require('../config/database');

const categories = [
  { name_ar: 'القهوة',         icon: '☕', sort_order: 1 },
  { name_ar: 'العصائر',         icon: '🥤', sort_order: 2 },
  { name_ar: 'V60',             icon: '☕', sort_order: 3 },
  { name_ar: 'المشروبات الباردة', icon: '🧋', sort_order: 4 },
  { name_ar: 'الكيك',           icon: '🧁', sort_order: 5 },
];

const products = [
  { name_ar: 'أمريكانو',          price: 9.99,  cat: 'القهوة',           image_url: null, ingredients: 'إسبريسو، ماء ساخن',                      badge: 'القهوة',            is_featured: true  },
  { name_ar: 'لاتيه',             price: 11.99, cat: 'القهوة',           image_url: null, ingredients: 'إسبريسو، حليب مبخر، رغوة حليب',          badge: 'القهوة',            is_featured: true  },
  { name_ar: 'موكا',              price: 12.99, cat: 'القهوة',           image_url: null, ingredients: 'إسبريسو، شوكولاتة، حليب، كريمة',          badge: 'القهوة',            is_featured: false },
  { name_ar: 'كابتشينو',          price: 10.99, cat: 'القهوة',           image_url: null, ingredients: 'إسبريسو، حليب، رغوة حليب كثيفة',          badge: 'القهوة',            is_featured: true  },
  { name_ar: 'إسبريسو',           price: 7.99,  cat: 'القهوة',           image_url: null, ingredients: 'قهوة محمصة، ماء',                          badge: 'القهوة',            is_featured: false },
  { name_ar: 'تركي',              price: 6.99,  cat: 'القهوة',           image_url: null, ingredients: 'قهوة تركية مطحونة، ماء، سكر (اختياري)',   badge: 'القهوة',            is_featured: false },
  { name_ar: 'موكا بالكراميل',    price: 9.99,  cat: 'المشروبات الباردة', image_url: null, ingredients: 'إسبريسو، شوكولاتة، كراميل، حليب بارد، ثلج', badge: 'المشروبات الباردة', is_featured: true  },
  { name_ar: 'فرابتشينو',         price: 11.99, cat: 'المشروبات الباردة', image_url: null, ingredients: 'قهوة، حليب، ثلج، سكر، كريمة',              badge: 'المشروبات الباردة', is_featured: true  },
  { name_ar: 'عصير برتقال',       price: 10.99, cat: 'العصائر',           image_url: null, ingredients: 'برتقال طازج',                              badge: 'العصائر',           is_featured: true  },
  { name_ar: 'ليموناضة',          price: 7.99,  cat: 'العصائر',           image_url: null, ingredients: 'ليمون طازج، سكر، ماء، نعناع',             badge: 'العصائر',           is_featured: false },
  { name_ar: 'كيك شوكولاتة',      price: 9.99,  cat: 'الكيك',            image_url: null, ingredients: 'دقيق، سكر، كاكاو، بيض، زبدة، حليب',       badge: 'الكيك',             is_featured: true  },
  { name_ar: 'تشيز كيك',          price: 12.99, cat: 'الكيك',            image_url: null, ingredients: 'جبنة كريمية، سكر، بيض، بسكويت، زبدة',     badge: 'الكيك',             is_featured: true  },
  { name_ar: 'كيك فانيليا',        price: 11.99, cat: 'الكيك',            image_url: null, ingredients: 'دقيق، سكر، بيض، زبدة، فانيليا، حليب',    badge: 'الكيك',             is_featured: false },
];

const offers = [
  { image_url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800', alt_text: 'عرض القهوة اليومي', sort_order: 1 },
  { image_url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800', alt_text: 'عروض الكيك',        sort_order: 2 },
];

const dailyPicks = [
  { title: 'امريكانو + كيكة الشوكولاتة', subtitle: 'خياراتك المميزة اليوم', price: '₺9.99',  emoji: '😋' },
  { title: 'وافل + لاتيه',               subtitle: 'خياراتك المميزة اليوم', price: '₺7.99',  emoji: '🥗' },
  { title: 'كابتشينو + براونيز',           subtitle: 'خياراتك المميزة اليوم', price: '₺11.99', emoji: '🍰' },
  { title: 'موكا + كوكيز',                subtitle: 'خياراتك المميزة اليوم', price: '₺8.99',  emoji: '🍪' },
];

async function seed() {
  console.log('🌱 Seeding database...');
  const { runMigrations, seedAdmin } = require('../config/database');
  await runMigrations();
  await seedAdmin();
  const client = await pool.connect();
  try {
    // Check if already seeded
    const check = await client.query('SELECT COUNT(*) FROM categories');
    if (parseInt(check.rows[0].count) > 0) {
      console.log('✅ Already seeded — skipping');
      return;
    }

    // Categories
    const catIds = {};
    for (const cat of categories) {
      const r = await client.query(
        'INSERT INTO categories (name_ar, icon, sort_order) VALUES ($1,$2,$3) RETURNING id, name_ar',
        [cat.name_ar, cat.icon, cat.sort_order]
      );
      catIds[r.rows[0].name_ar] = r.rows[0].id;
    }
    console.log('✅ Categories seeded');

    // Products
    for (const p of products) {
      const catId = catIds[p.cat] || null;
      await client.query(
        `INSERT INTO products (name_ar, price, category_id, image_url, ingredients, badge, is_featured) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [p.name_ar, p.price, catId, p.image_url, p.ingredients, p.badge, p.is_featured]
      );
    }
    console.log('✅ Products seeded');

    // Offers
    for (const o of offers) {
      await client.query(
        'INSERT INTO offers (image_url, alt_text, sort_order) VALUES ($1,$2,$3)',
        [o.image_url, o.alt_text, o.sort_order]
      );
    }

    // Daily picks
    for (const d of dailyPicks) {
      await client.query(
        'INSERT INTO daily_picks (title, subtitle, price, emoji) VALUES ($1,$2,$3,$4)',
        [d.title, d.subtitle, d.price, d.emoji]
      );
    }
    console.log('✅ Offers and daily picks seeded');

    console.log('🎉 Seed complete!');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => { console.error('Seed failed:', err.message); process.exit(1); });

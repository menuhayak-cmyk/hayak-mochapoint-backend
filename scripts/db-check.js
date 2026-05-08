'use strict';
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '6543'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const RESET  = '\x1b[0m';

const ok   = (msg) => console.log(`${GREEN}✅ ${msg}${RESET}`);
const warn = (msg) => console.log(`${YELLOW}⚠️  ${msg}${RESET}`);
const err  = (msg) => console.log(`${RED}❌ ${msg}${RESET}`);
const info = (msg) => console.log(`${CYAN}ℹ️  ${msg}${RESET}`);

async function run() {
  const client = await pool.connect();
  console.log('\n══════════════════════════════════════════════');
  console.log('  فحص قاعدة بيانات Mocha Point');
  console.log('══════════════════════════════════════════════\n');

  try {
    // 1. Check connection
    await client.query('SELECT 1');
    ok('الاتصال بقاعدة البيانات يعمل');

    // 2. List all tables
    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const tables = tablesRes.rows.map(r => r.table_name);
    info(`الجداول الموجودة (${tables.length}): ${tables.join(', ')}`);

    const expectedTables = [
      'categories', 'products', 'product_sizes', 'offers', 'daily_picks',
      'hero_slides', 'reviews', 'orders', 'order_items', 'contact_info',
      'admin_users', 'otp_tokens', 'refresh_tokens', 'audit_log'
    ];
    for (const t of expectedTables) {
      if (!tables.includes(t)) err(`جدول مفقود: ${t}`);
      else ok(`جدول موجود: ${t}`);
    }

    console.log('\n── فحص الأعمدة ─────────────────────────────\n');

    // 3. Check products columns
    const prodCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'products' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    const prodColNames = prodCols.rows.map(r => r.column_name);
    info(`أعمدة products: ${prodColNames.join(', ')}`);
    const requiredProdCols = ['id','name_ar','name_tr','price','category_id','image_url','ingredients','ingredients_tr','badge','badge_tr','is_featured','is_active','sort_order'];
    for (const col of requiredProdCols) {
      if (!prodColNames.includes(col)) err(`عمود مفقود في products: ${col}`);
    }
    ok('أعمدة products كاملة');

    // 4. Check product_sizes columns
    if (tables.includes('product_sizes')) {
      const sizeCols = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'product_sizes' AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      const sizeColNames = sizeCols.rows.map(r => r.column_name);
      info(`أعمدة product_sizes: ${sizeColNames.join(', ')}`);
      for (const col of ['id','product_id','name_ar','name_tr','price','sort_order','is_active']) {
        if (!sizeColNames.includes(col)) err(`عمود مفقود في product_sizes: ${col}`);
      }
      ok('أعمدة product_sizes كاملة');
    }

    // 4b. Check offers columns
    if (tables.includes('offers')) {
      const offersCols = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'offers' AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      const offersColNames = offersCols.rows.map(r => r.column_name);
      info(`أعمدة offers: ${offersColNames.join(', ')}`);
      for (const col of ['id','image_url','alt_text','alt_text_tr','sort_order','is_active']) {
        if (!offersColNames.includes(col)) err(`عمود مفقود في offers: ${col}`);
      }
      ok('أعمدة offers كاملة');
    }

    // 5. Check foreign key constraints
    console.log('\n── فحص الـ Foreign Keys ──────────────────────\n');
    const fkRes = await client.query(`
      SELECT
        tc.table_name, kcu.column_name,
        ccu.table_name AS foreign_table
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.table_name
    `);
    fkRes.rows.forEach(fk => ok(`FK: ${fk.table_name}.${fk.column_name} → ${fk.foreign_table}`));

    // 6. Check indexes
    console.log('\n── فحص الـ Indexes ───────────────────────────\n');
    const idxRes = await client.query(`
      SELECT indexname, tablename FROM pg_indexes
      WHERE schemaname = 'public' AND indexname NOT LIKE '%pkey'
      ORDER BY tablename
    `);
    idxRes.rows.forEach(idx => ok(`Index: ${idx.indexname} على ${idx.tablename}`));

    // 7. Check triggers
    console.log('\n── فحص الـ Triggers ──────────────────────────\n');
    const trigRes = await client.query(`
      SELECT trigger_name, event_object_table FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table
    `);
    if (trigRes.rows.length === 0) warn('لا يوجد triggers');
    else trigRes.rows.forEach(tr => ok(`Trigger: ${tr.trigger_name} على ${tr.event_object_table}`));

    // 8. Row counts
    console.log('\n── إحصائيات البيانات ─────────────────────────\n');
    for (const table of ['products','categories','product_sizes','orders','reviews','contact_info','hero_slides']) {
      if (!tables.includes(table)) continue;
      const cnt = await client.query(`SELECT COUNT(*) FROM ${table}`);
      info(`${table}: ${cnt.rows[0].count} سجل`);
    }

    // 9. Orphaned product_sizes (product deleted)
    console.log('\n── فحص البيانات المعزولة ─────────────────────\n');
    if (tables.includes('product_sizes')) {
      const orphan = await client.query(`
        SELECT ps.id, ps.product_id FROM product_sizes ps
        LEFT JOIN products p ON ps.product_id = p.id
        WHERE p.id IS NULL
      `);
      if (orphan.rows.length > 0) warn(`product_sizes معزولة (product غير موجود): ${orphan.rows.length}`);
      else ok('لا توجد product_sizes معزولة');
    }

    // 10. Products with no category
    const noCat = await client.query(`SELECT COUNT(*) FROM products WHERE category_id IS NULL AND is_active = true`);
    if (parseInt(noCat.rows[0].count) > 0) warn(`منتجات نشطة بدون صنف: ${noCat.rows[0].count}`);
    else ok('كل المنتجات النشطة لها صنف');

    // 11. Admin users check
    const admins = await client.query('SELECT email, failed_attempts, locked_until FROM admin_users');
    console.log('\n── حسابات المدير ─────────────────────────────\n');
    admins.rows.forEach(a => {
      const locked = a.locked_until && new Date(a.locked_until) > new Date();
      if (locked) err(`حساب مقفل: ${a.email} حتى ${a.locked_until}`);
      else ok(`حساب نشط: ${a.email} (محاولات فاشلة: ${a.failed_attempts})`);
    });

    console.log('\n══════════════════════════════════════════════');
    console.log(`${GREEN}  الفحص اكتمل بنجاح${RESET}`);
    console.log('══════════════════════════════════════════════\n');

  } catch (e) {
    err(`خطأ غير متوقع: ${e.message}`);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

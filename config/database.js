'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '6543'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err.message);
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
    }
    console.log('✅ DB migrations applied');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function seedAdmin() {
  const bcrypt = require('bcryptjs');
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  try {
    const exists = await pool.query(
      'SELECT id FROM admin_users WHERE email = $1',
      [email]
    );
    if (exists.rows.length === 0) {
      const hash = await bcrypt.hash(password, 12);
      await pool.query(
        'INSERT INTO admin_users (email, password_hash) VALUES ($1, $2)',
        [email, hash]
      );
      console.log(`✅ Admin user seeded: ${email}`);
    }
  } catch (err) {
    console.error('❌ Admin seed failed:', err.message);
  }
}

module.exports = { pool, runMigrations, seedAdmin };

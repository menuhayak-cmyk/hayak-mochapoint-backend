'use strict';
require('dotenv').config();
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const router   = express.Router();

const { pool }        = require('../config/database');
const { sendOTPEmail } = require('../config/resend');
const { authLimiter } = require('../middleware/security');
const { auditLog }    = require('../middleware/auth');
const { validate, loginSchema, otpSchema } = require('../utils/validators');
const logger          = require('../utils/logger');

const OTP_TTL_MS      = 10 * 60 * 1000; // 10 minutes
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS    = 5;

function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    algorithm: 'HS512',
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    algorithm: 'HS512',
  });
}

// ── POST /api/auth/login ─────────────────────────────────────────────────────
// Step 1: validate email + password → send OTP
router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash, failed_attempts, locked_until FROM admin_users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];
    // Generic message to prevent user enumeration (OWASP A07)
    const INVALID_MSG = 'Invalid credentials';

    if (!user) {
      logger.warn('Login: unknown email', { email, ip: req.ip });
      return res.status(401).json({ error: INVALID_MSG });
    }

    // Check account lock
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(user.locked_until) - Date.now()) / 60000);
      return res.status(423).json({
        error: `Account locked. Try again in ${remaining} minute(s).`,
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const newAttempts = (user.failed_attempts || 0) + 1;
      const lockUntil = newAttempts >= MAX_ATTEMPTS
        ? new Date(Date.now() + LOCK_DURATION_MS).toISOString()
        : null;

      await pool.query(
        'UPDATE admin_users SET failed_attempts = $1, locked_until = $2 WHERE id = $3',
        [newAttempts, lockUntil, user.id]
      );

      logger.warn('Login: bad password', { email, attempts: newAttempts, ip: req.ip });
      return res.status(401).json({ error: INVALID_MSG });
    }

    // Reset failed attempts on valid password
    await pool.query(
      'UPDATE admin_users SET failed_attempts = 0, locked_until = NULL WHERE id = $1',
      [user.id]
    );

    // Invalidate previous OTPs for this user
    await pool.query(
      'UPDATE otp_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE',
      [user.id]
    );

    // Generate and store OTP
    const otp       = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
    const hashedOtp = await bcrypt.hash(otp, 8);

    await pool.query(
      'INSERT INTO otp_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, hashedOtp, expiresAt]
    );

    // Send OTP email
    try {
      await sendOTPEmail(email, otp);
      logger.info('OTP sent', { email, ip: req.ip });
      await auditLog(email, 'OTP_SENT', 'admin_users', user.id, req.ip);
    } catch (emailErr) {
      logger.warn('Email delivery failed, using console fallback', { email, error: emailErr.message });
      console.log('\n' + '='.repeat(50));
      console.log(`[AUTH FALLBACK] OTP for ${email}: ${otp}`);
      console.log('='.repeat(50) + '\n');
      
      await auditLog(email, 'OTP_CONSOLE_FALLBACK', 'admin_users', user.id, req.ip);
      return res.json({ 
        requiresOtp: true, 
        message: 'OTP generated (check server console for code since email failed)' 
      });
    }

    return res.json({ requiresOtp: true, message: 'OTP sent to your email' });
  } catch (err) {
    logger.error('Login error', { err: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/auth/verify-otp ────────────────────────────────────────────────
router.post('/verify-otp', authLimiter, validate(otpSchema), async (req, res) => {
  const { email, otp } = req.body;

  try {
    const userResult = await pool.query(
      'SELECT id FROM admin_users WHERE email = $1',
      [email]
    );
    const user = userResult.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid OTP' });

    const tokenResult = await pool.query(
      `SELECT id, token, expires_at FROM otp_tokens
       WHERE user_id = $1 AND used = FALSE
       ORDER BY id DESC LIMIT 1`,
      [user.id]
    );

    const record = tokenResult.rows[0];
    if (!record) return res.status(401).json({ error: 'OTP not found or already used' });

    if (new Date(record.expires_at) < new Date()) {
      return res.status(401).json({ error: 'OTP expired' });
    }

    const valid = await bcrypt.compare(otp, record.token);
    if (!valid) {
      logger.warn('Invalid OTP attempt', { email, ip: req.ip });
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    // Mark OTP as used
    await pool.query('UPDATE otp_tokens SET used = TRUE WHERE id = $1', [record.id]);

    // Issue tokens
    const payload      = { userId: user.id, email };
    const accessToken  = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    const rtExpiry     = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, rtExpiry]
    );

    logger.info('Login successful', { email, ip: req.ip });
    await auditLog(email, 'LOGIN_SUCCESS', 'admin_users', user.id, req.ip);

    return res.json({ accessToken, refreshToken, email });
  } catch (err) {
    logger.error('Verify OTP error', { err: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/auth/refresh ───────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    const result = await pool.query(
      'SELECT id, user_id FROM refresh_tokens WHERE token = $1 AND revoked = FALSE AND expires_at > NOW()',
      [refreshToken]
    );

    if (!result.rows[0]) return res.status(401).json({ error: 'Invalid or expired refresh token' });

    const newAccessToken = signAccessToken({ userId: decoded.userId, email: decoded.email });
    return res.json({ accessToken: newAccessToken });
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await pool.query('UPDATE refresh_tokens SET revoked = TRUE WHERE token = $1', [refreshToken])
      .catch(() => {});
  }
  return res.json({ message: 'Logged out' });
});

module.exports = router;

'use strict';
require('dotenv').config();

const express      = require('express');
const cookieParser = require('cookie-parser');
const logger       = require('./utils/logger');
const { runMigrations, seedAdmin } = require('./config/database');
const { corsOptions, helmetConfig, apiLimiter, cors } = require('./middleware/security');

const authRouter       = require('./routes/auth');
const productsRouter   = require('./routes/products');
const categoriesRouter = require('./routes/categories');
const offersRouter     = require('./routes/offers');
const heroSlidesRouter = require('./routes/heroSlides');
const uploadRouter     = require('./routes/upload');
const auditLogRouter   = require('./routes/auditLog');
const reviewsRouter    = require('./routes/reviews');
const contactRouter    = require('./routes/contact');
const ordersRouter     = require('./routes/orders');
const homeRouter       = require('./routes/home');
const productSizesRouter = require('./routes/productSizes');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Security middlewareddddds ────────────────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmetConfig);
app.use(cors(corsOptions));
app.use(apiLimiter);

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(cookieParser());

// ── Request logger ────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',        authRouter);
app.use('/api/products',    productsRouter);
app.use('/api/categories',  categoriesRouter);
app.use('/api/hero-slides', heroSlidesRouter);
app.use('/api/upload',      uploadRouter);
app.use('/api/audit-log',   auditLogRouter);
app.use('/api/reviews',     reviewsRouter);
app.use('/api/contact',     contactRouter);
app.use('/api/orders',      ordersRouter);
app.use('/api/home',          homeRouter);
app.use('/api/product-sizes', productSizesRouter);
app.use('/api',               offersRouter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Global error handler (no stack traces in response — OWASP A05) ────────────
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { err: err.message, stack: err.stack });
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  res.status(status).json({ error: message });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
async function boot() {
  try {
    await runMigrations();
    await seedAdmin();
    if (process.env.VERCEL) {
      logger.info('🚀 API running in Vercel Serverless environment');
    } else {
      app.listen(PORT, () => {
        logger.info(`🚀 API running on http://localhost:${PORT}`);
      });
    }
  } catch (err) {
    logger.error('Boot failed', { err: err.message });
    if (!process.env.VERCEL) process.exit(1);
  }
}

boot().catch(err => {
  logger.error('Critical boot failure during initialization', { err: err.message });
});

module.exports = app;

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGTERM', () => { logger.info('SIGTERM received, shutting down'); process.exit(0); });
process.on('SIGINT',  () => { logger.info('SIGINT received, shutting down');  process.exit(0); });

'use strict';
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const cors        = require('cors');

/** CORS — only allow the Next.js frontend */
const corsOptions = {
  origin: (origin, callback) => {
    const allowedUrls = (process.env.FRONTEND_URL || 'http://localhost:3000')
      .split(',')
      .map(url => url.trim());
    const extraAllowed = [
      'https://mochapoint.hayak-menu.com',
      'https://www.mochapoint.hayak-menu.com'
    ];
    
    const allowed = [...allowedUrls, ...extraAllowed];
    
    // Allow server-to-server (no origin)
    if (!origin || allowed.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
//
/** Rate limit — auth endpoints: 5 attempts / 15 min */
const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             5,
  message:         { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req) => req.ip,
});

/** Rate limit — general API: 200 req / min */
const apiLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             200,
  message:         { error: 'Rate limit exceeded, slow down.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

/** Helmet — security headers */
const helmetConfig = helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc:     ["'self'", 'data:', 'res.cloudinary.com', 'blob:'],
    },
  },
});

module.exports = { corsOptions, authLimiter, apiLimiter, helmetConfig, cors };

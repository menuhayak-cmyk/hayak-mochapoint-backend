'use strict';
const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email('Invalid email').max(255).trim(),
  password: z.string().min(6, 'Password too short').max(128),
});

const otpSchema = z.object({
  email: z.string().email().max(255).trim(),
  otp: z.string().length(6).regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

const productSchema = z.object({
  name_ar: z.string().min(1).max(200).trim(),
  name_tr: z.string().max(200).trim().optional().nullable(),
  price: z.number({ coerce: true }).positive().max(999999),
  category_id: z.number({ coerce: true }).int().positive().optional().nullable(),
  image_url: z.string().max(500).optional().nullable(),
  ingredients: z.string().max(1000).optional().nullable(),
  ingredients_tr: z.string().max(1000).optional().nullable(),
  badge: z.string().max(100).optional().nullable(),
  badge_tr: z.string().max(100).optional().nullable(),
  is_featured: z.boolean().optional().default(false),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number({ coerce: true }).int().optional().default(0),
});

const productSizeSchema = z.object({
  name_ar:    z.string().min(1).max(100).trim(),
  name_tr:    z.string().max(100).trim().optional().nullable(),
  price:      z.number({ coerce: true }).positive().max(999999),
  sort_order: z.number({ coerce: true }).int().optional().default(0),
  is_active:  z.boolean().optional().default(true),
});

const categorySchema = z.object({
  name_ar: z.string().min(1).max(200).trim(),
  name_tr: z.string().max(200).trim().optional().nullable(),
  icon: z.string().max(500).optional().nullable(),
  sort_order: z.number({ coerce: true }).int().optional().default(0),
  is_active: z.boolean().optional().default(true),
});

const offerSchema = z.object({
  image_url: z.string().url('Must be a valid URL').max(500),
  alt_text: z.string().max(200).optional().nullable(),
  alt_text_tr: z.string().max(200).optional().nullable(),
  sort_order: z.number({ coerce: true }).int().optional().default(0),
  is_active: z.boolean().optional().default(true),
});

const dailyPickSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  title_tr: z.string().max(200).trim().optional().nullable(),
  subtitle: z.string().max(200).optional().nullable(),
  subtitle_tr: z.string().max(200).optional().nullable(),
  price: z.string().max(50).optional().nullable(),
  emoji: z.string().max(10).optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

const heroSlideSchema = z.object({
  image_url: z.string().url('Must be a valid URL').max(500),
  title: z.string().min(1).max(200).trim(),
  title_tr: z.string().max(200).trim().optional().nullable(),
  subtitle: z.string().max(200).optional().nullable(),
  subtitle_tr: z.string().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  discount: z.string().max(50).optional().nullable(),
  sort_order: z.number({ coerce: true }).int().optional().default(0),
  is_active: z.boolean().optional().default(true),
});

const reviewSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).trim(),
  rating: z.number({ coerce: true }).int().min(1).max(5),
  comment: z.string().min(1, 'Comment is required').trim(),
  comment_tr: z.string().optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

/** Middleware factory — validates req.body against a Zod schema */
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }
  req.body = result.data;
  next();
};

module.exports = {
  loginSchema,
  otpSchema,
  productSchema,
  productSizeSchema,
  categorySchema,
  offerSchema,
  dailyPickSchema,
  heroSlideSchema,
  reviewSchema,
  validate,
};

/**
 * Rate Limiting — Login endpoint protection
 * Max 10 attempts per 15 minutes per IP
 */

const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use X-Forwarded-For when behind Nginx proxy
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  }
});

module.exports = { loginLimiter };

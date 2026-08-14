/**
 * Auth Routes — Login, Refresh, Logout, Me
 * JWT access token (15min) + refresh token (7d) via httpOnly cookies
 * Refresh token rotation: each refresh invalidates old token
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, is_admin: Boolean(user.is_admin) },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

function setCookies(res, accessToken, refreshToken) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000 // 7 days
  });
}

function clearCookies(res) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('access_token', { httpOnly: true, secure: isProduction, sameSite: 'lax' });
  res.clearCookie('refresh_token', { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/api/auth' });
}

// POST /api/auth/login
router.post('/login',
  loginLimiter,
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const db = getDb();
      const { username, password } = req.body;

      const user = db.prepare('SELECT id, username, password_hash, display_name, avatar FROM users WHERE username = ?').get(username);
      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken();
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

      // Store refresh token and log login in one transaction
      const loginTransaction = db.transaction(() => {
        // Clean up old refresh tokens for this user
        db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(user.id);
        
        // Store new refresh token
        db.prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, refreshToken, expiresAt);
        
        // Log activity
        db.prepare(
          'INSERT INTO activity_logs (user_id, action_type, description, metadata, created_at) VALUES (?, ?, ?, ?, ?)'
        ).run(user.id, 'USER_LOGIN', `${user.username} logged in`, '{}', new Date().toISOString());
      });

      loginTransaction();

      setCookies(res, accessToken, refreshToken);

      res.json({
        user: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar: user.avatar,
          is_admin: Boolean(user.is_admin)
        }
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/auth/refresh
router.post('/refresh', (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  try {
    const db = getDb();
    const stored = db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(token);

    if (!stored) {
      clearCookies(res);
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (new Date(stored.expires_at) < new Date()) {
      db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(stored.id);
      clearCookies(res);
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    const user = db.prepare('SELECT id, username, display_name, avatar FROM users WHERE id = ?').get(stored.user_id);
    if (!user) {
      clearCookies(res);
      return res.status(401).json({ error: 'User not found' });
    }

    // Rotate refresh token
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const refreshTransaction = db.transaction(() => {
      db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(stored.id);
      db.prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, newRefreshToken, expiresAt);
    });

    refreshTransaction();

    setCookies(res, newAccessToken, newRefreshToken);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar: user.avatar,
        is_admin: Boolean(user.is_admin)
      }
    });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const refreshToken = req.cookies?.refresh_token;

    const logoutTransaction = db.transaction(() => {
      if (refreshToken) {
        db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
      }
      db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(req.user.id);

      db.prepare(
        'INSERT INTO activity_logs (user_id, action_type, description, metadata, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(req.user.id, 'USER_LOGOUT', `${req.user.username} logged out`, '{}', new Date().toISOString());
    });

    logoutTransaction();

    clearCookies(res);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare(
      'SELECT id, username, display_name, avatar, bio, join_date, theme_preset, accent_color, bg_color, split_ratio_percent, is_admin FROM users WHERE id = ?'
    ).get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/auth/password
router.put('/password',
  authenticateToken,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const db = getDb();
      const { currentPassword, newPassword } = req.body;

      const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!validPassword) {
        return res.status(400).json({ error: 'Incorrect current password' });
      }

      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newPasswordHash, req.user.id);

      db.prepare(
        'INSERT INTO activity_logs (user_id, action_type, description, metadata, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(req.user.id, 'USER_PASSWORD_CHANGE', `User changed their password`, '{}', new Date().toISOString());

      res.json({ message: 'Password updated successfully' });
    } catch (err) {
      console.error('Change password error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;

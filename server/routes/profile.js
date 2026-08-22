/**
 * Profile Routes — User profile CRUD and theme settings
 * MODULE 3: Profile & Theme
 */

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { getDb } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');
const { upload, validateFileSizes } = require('../middleware/upload');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const VALID_PRESETS = ['sakura', 'lavender', 'mint', 'twilight', 'custom'];
const USERNAME_CHANGE_COOLDOWN_DAYS = 30;

router.use(authenticateToken);

// GET /api/profile/:username
router.get('/:username',
  [param('username').trim().notEmpty()],
  async (req, res) => {
    try {
      const db = getDb();
      const { rows } = await db.query(
        'SELECT id, username, display_name, avatar, bio, link, join_date, last_username_change, theme_preset, accent_color, bg_color, split_ratio_percent FROM users WHERE username = $1',
        [req.params.username]
      );
      const user = rows[0];

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        profile: {
          ...user,
          is_owner: user.id === req.user.id
        }
      });
    } catch (err) {
      console.error('Get profile error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/profile — get both users for partner display
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const { rows: users } = await db.query(
      'SELECT id, username, display_name, avatar, bio, link, join_date FROM users'
    );

    res.json({ users });
  } catch (err) {
    console.error('Get profiles error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/profile
router.put('/',
  upload.single('avatar'),
  [
    body('display_name').optional().trim().isLength({ min: 1, max: 50 }).withMessage('Display name must be 1-50 characters'),
    body('username').optional().trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
    body('bio').optional().trim().isLength({ max: 160 }).withMessage('Bio must be under 160 characters'),
    body('link').optional().trim().isLength({ max: 255 }).withMessage('Link must be under 255 characters'),
    body('split_ratio_percent').optional().isInt({ min: 0, max: 100 }).withMessage('Split ratio must be between 0 and 100')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ } }
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const db = getDb();
      const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
      const currentUser = rows[0];
      
      if (!currentUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      const updates = {};
      const changes = [];

      if (req.body.display_name !== undefined) {
        updates.display_name = req.body.display_name;
        changes.push('display name');
      }

      if (req.body.bio !== undefined) {
        updates.bio = req.body.bio;
        changes.push('bio');
      }

      if (req.body.link !== undefined) {
        updates.link = req.body.link;
        changes.push('link');
      }

      if (req.body.split_ratio_percent !== undefined) {
        updates.split_ratio_percent = req.body.split_ratio_percent;
        changes.push('split ratio');
      }

      if (req.body.username && req.body.username !== currentUser.username) {
        const lastChange = new Date(currentUser.last_username_change);
        const now = new Date();
        const daysSinceChange = (now - lastChange) / (1000 * 60 * 60 * 24);

        if (daysSinceChange < USERNAME_CHANGE_COOLDOWN_DAYS) {
          const daysLeft = Math.ceil(USERNAME_CHANGE_COOLDOWN_DAYS - daysSinceChange);
          if (req.file) { try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ } }
          return res.status(400).json({
            error: `Username can only be changed once every 30 days. ${daysLeft} day(s) remaining.`
          });
        }

        const { rows: existing } = await db.query('SELECT id FROM users WHERE username = $1 AND id != $2', [req.body.username, req.user.id]);
        if (existing.length > 0) {
          if (req.file) { try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ } }
          return res.status(400).json({ error: 'Username is already taken' });
        }

        updates.username = req.body.username;
        updates.last_username_change = new Date().toISOString();
        changes.push('username');
      }

      if (req.file) {
        if (currentUser.avatar) {
          const uploadsPath = process.env.UPLOADS_PATH || (process.env.VERCEL ? '/tmp/uploads' : '/var/data/ourspace/uploads');
          try { fs.unlinkSync(path.join(uploadsPath, currentUser.avatar)); } catch (e) { /* ignore */ }
        }
        updates.avatar = req.file.filename;
        changes.push('avatar');
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No changes provided' });
      }

      const setClauses = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`).join(', ');
      const values = Object.values(updates);
      
      const now = new Date().toISOString();

      await db.query(`UPDATE users SET ${setClauses} WHERE id = $${values.length + 1}`, [...values, req.user.id]);

      await db.query(
        'INSERT INTO activity_logs (user_id, action_type, description, metadata, created_at) VALUES ($1, $2, $3, $4, $5)',
        [
          req.user.id,
          'PROFILE_UPDATED',
          `${updates.username || currentUser.username} updated profile: ${changes.join(', ')}`,
          JSON.stringify({ changes, updates: Object.keys(updates) }),
          now
        ]
      );

      const { rows: updatedRows } = await db.query(
        'SELECT id, username, display_name, avatar, bio, link, join_date, last_username_change, theme_preset, accent_color, bg_color, split_ratio_percent FROM users WHERE id = $1',
        [req.user.id]
      );
      const updatedUser = updatedRows[0];

      res.json({ profile: { ...updatedUser, is_owner: true } });
    } catch (err) {
      console.error('Update profile error:', err);
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ } }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PUT /api/profile/theme
router.put('/theme',
  [
    body('theme_preset').isIn(VALID_PRESETS).withMessage(`Preset must be one of: ${VALID_PRESETS.join(', ')}`),
    body('accent_color').matches(/^#[0-9a-fA-F]{6}$/).withMessage('Accent color must be a valid hex color'),
    body('bg_color').matches(/^#[0-9a-fA-F]{6}$/).withMessage('Background color must be a valid hex color')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const db = getDb();
      const { theme_preset, accent_color, bg_color } = req.body;
      const now = new Date().toISOString();

      await db.query(
        'UPDATE users SET theme_preset = $1, accent_color = $2, bg_color = $3 WHERE id = $4',
        [theme_preset, accent_color, bg_color, req.user.id]
      );

      await db.query(
        'INSERT INTO activity_logs (user_id, action_type, description, metadata, created_at) VALUES ($1, $2, $3, $4, $5)',
        [
          req.user.id,
          'THEME_CHANGED',
          `${req.user.username} changed theme to ${theme_preset}`,
          JSON.stringify({ theme_preset, accent_color, bg_color }),
          now
        ]
      );

      res.json({ theme: { theme_preset, accent_color, bg_color } });
    } catch (err) {
      console.error('Update theme error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PUT /api/profile/password
router.put('/password',
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
      const { rows } = await db.query('SELECT id, password_hash FROM users WHERE id = $1', [req.user.id]);
      const user = rows[0];
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const validPassword = await bcrypt.compare(req.body.currentPassword, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Incorrect current password' });
      }

      const newPasswordHash = await bcrypt.hash(req.body.newPassword, 10);
      
      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, req.user.id]);

      res.json({ message: 'Password updated successfully' });
    } catch (err) {
      console.error('Update password error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;

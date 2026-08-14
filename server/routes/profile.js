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
  (req, res) => {
    try {
      const db = getDb();
      const user = db.prepare(
        'SELECT id, username, display_name, avatar, bio, link, join_date, last_username_change, theme_preset, accent_color, bg_color, split_ratio_percent FROM users WHERE username = ?'
      ).get(req.params.username);

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
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const users = db.prepare(
      'SELECT id, username, display_name, avatar, bio, link, join_date FROM users'
    ).all();

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
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Clean up avatar if uploaded
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ } }
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const db = getDb();
      const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      if (!currentUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      const updates = {};
      const changes = [];

      // Display name
      if (req.body.display_name !== undefined) {
        updates.display_name = req.body.display_name;
        changes.push('display name');
      }

      // Bio
      if (req.body.bio !== undefined) {
        updates.bio = req.body.bio;
        changes.push('bio');
      }

      // Link
      if (req.body.link !== undefined) {
        updates.link = req.body.link;
        changes.push('link');
      }

      // Split ratio
      if (req.body.split_ratio_percent !== undefined) {
        updates.split_ratio_percent = req.body.split_ratio_percent;
        changes.push('split ratio');
      }

      // Username change (30-day cooldown)
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

        // Check uniqueness
        const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(req.body.username, req.user.id);
        if (existing) {
          if (req.file) { try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ } }
          return res.status(400).json({ error: 'Username is already taken' });
        }

        updates.username = req.body.username;
        updates.last_username_change = new Date().toISOString();
        changes.push('username');
      }

      // Avatar
      if (req.file) {
        // Delete old avatar if exists
        if (currentUser.avatar) {
          const uploadsPath = process.env.UPLOADS_PATH || '/var/data/ourspace/uploads';
          try { fs.unlinkSync(path.join(uploadsPath, currentUser.avatar)); } catch (e) { /* ignore */ }
        }
        updates.avatar = req.file.filename;
        changes.push('avatar');
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No changes provided' });
      }

      // Build dynamic UPDATE query
      const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updates);

      const now = new Date().toISOString();

      const updateTransaction = db.transaction(() => {
        db.prepare(`UPDATE users SET ${setClauses} WHERE id = ?`).run(...values, req.user.id);

        db.prepare(
          'INSERT INTO activity_logs (user_id, action_type, description, metadata, created_at) VALUES (?, ?, ?, ?, ?)'
        ).run(
          req.user.id,
          'PROFILE_UPDATED',
          `${updates.username || currentUser.username} updated profile: ${changes.join(', ')}`,
          JSON.stringify({ changes, updates: Object.keys(updates) }),
          now
        );
      });

      updateTransaction();

      // Return updated profile
      const updatedUser = db.prepare(
        'SELECT id, username, display_name, avatar, bio, link, join_date, last_username_change, theme_preset, accent_color, bg_color, split_ratio_percent FROM users WHERE id = ?'
      ).get(req.user.id);

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
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const db = getDb();
      const { theme_preset, accent_color, bg_color } = req.body;
      const now = new Date().toISOString();

      const themeTransaction = db.transaction(() => {
        db.prepare(
          'UPDATE users SET theme_preset = ?, accent_color = ?, bg_color = ? WHERE id = ?'
        ).run(theme_preset, accent_color, bg_color, req.user.id);

        db.prepare(
          'INSERT INTO activity_logs (user_id, action_type, description, metadata, created_at) VALUES (?, ?, ?, ?, ?)'
        ).run(
          req.user.id,
          'THEME_CHANGED',
          `${req.user.username} changed theme to ${theme_preset}`,
          JSON.stringify({ theme_preset, accent_color, bg_color }),
          now
        );
      });

      themeTransaction();

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
      const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const validPassword = await bcrypt.compare(req.body.currentPassword, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Incorrect current password' });
      }

      const newPasswordHash = await bcrypt.hash(req.body.newPassword, 10);
      
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newPasswordHash, req.user.id);

      res.json({ message: 'Password updated successfully' });
    } catch (err) {
      console.error('Update password error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;

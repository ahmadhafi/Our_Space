const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { put } = require('@vercel/blob');
const fs = require('fs');

// Fetch all active stories
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    
    // Get stories that haven't expired
    const result = await db.query(`
      SELECT 
        s.*, 
        u.username, 
        u.display_name, 
        u.avatar 
      FROM stories s
      JOIN users u ON s.user_id = u.id
      WHERE s.expires_at > NOW()
      ORDER BY s.created_at ASC
    `);

    // Group stories by user
    const grouped = result.rows.reduce((acc, story) => {
      if (!acc[story.user_id]) {
        acc[story.user_id] = {
          user_id: story.user_id,
          username: story.username,
          display_name: story.display_name,
          avatar: story.avatar,
          stories: []
        };
      }
      acc[story.user_id].stories.push({
        id: story.id,
        media_type: story.media_type,
        file_path: story.file_path,
        text_content: story.text_content,
        bg_color: story.bg_color,
        created_at: story.created_at,
        expires_at: story.expires_at
      });
      return acc;
    }, {});

    res.json({ users: Object.values(grouped) });
  } catch (err) {
    next(err);
  }
});

// Create a new story
router.post('/', requireAuth, upload.single('media'), async (req, res, next) => {
  try {
    const db = await getDb();
    const { media_type, text_content, bg_color } = req.body;
    const user_id = req.user.id;
    let file_path = null;

    if (req.file) {
      if (process.env.VERCEL) {
        // Upload to Vercel Blob
        const fileBuffer = fs.readFileSync(req.file.path);
        const blob = await put(`stories/${Date.now()}-${req.file.originalname}`, fileBuffer, {
          access: 'public',
          token: process.env.BLOB_READ_WRITE_TOKEN
        });
        file_path = blob.url;
        
        // Clean up temp file
        try { fs.unlinkSync(req.file.path); } catch (e) {}
      } else {
        file_path = req.file.filename;
      }
    }

    // Insert with expiration set to 24 hours from now
    const result = await db.query(`
      INSERT INTO stories (user_id, media_type, file_path, text_content, bg_color, expires_at)
      VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '24 hours')
      RETURNING *
    `, [user_id, media_type, file_path, text_content, bg_color]);

    // Log activity
    await db.query(`
      INSERT INTO activity_logs (user_id, action_type, description)
      VALUES ($1, 'STORY_CREATED', 'added a new story')
    `, [user_id]);

    res.status(201).json({ story: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Delete a story
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    
    // Check ownership or admin
    const check = await db.query('SELECT user_id FROM stories WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Story not found' });
    
    if (check.rows[0].user_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await db.query('DELETE FROM stories WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

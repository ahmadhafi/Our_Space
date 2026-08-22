const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { put } = require('@vercel/blob');
const fs = require('fs');

// Get list of recent chats (users we've talked to)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    const myId = req.user.id;
    
    // We want a list of all other users, and if there's a chat, the latest message and unread count.
    // Since this is a small private app, we can just fetch all users and attach latest message.
    const result = await db.query(`
      SELECT 
        u.id, u.username, u.display_name, u.avatar, u.is_admin,
        (
          SELECT json_build_object(
            'text', m.text,
            'media_type', m.media_type,
            'created_at', m.created_at,
            'sender_id', m.sender_id,
            'is_read', m.is_read
          )
          FROM messages m 
          WHERE (m.sender_id = u.id AND m.receiver_id = $1) 
             OR (m.sender_id = $1 AND m.receiver_id = u.id)
          ORDER BY m.created_at DESC 
          LIMIT 1
        ) as latest_message,
        (
          SELECT count(*) 
          FROM messages m 
          WHERE m.sender_id = u.id AND m.receiver_id = $1 AND m.is_read = false
        ) as unread_count
      FROM users u
      WHERE u.id != $1
      ORDER BY u.id ASC
    `, [myId]);

    res.json({ chats: result.rows });
  } catch (err) {
    next(err);
  }
});

// Get chat history with a specific user
router.get('/:userId', requireAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    const myId = req.user.id;
    const otherId = parseInt(req.params.userId, 10);
    
    const result = await db.query(`
      SELECT * FROM messages
      WHERE (sender_id = $1 AND receiver_id = $2)
         OR (sender_id = $2 AND receiver_id = $1)
      ORDER BY created_at ASC
    `, [myId, otherId]);

    res.json({ messages: result.rows });
  } catch (err) {
    next(err);
  }
});

// Send a message to a specific user
router.post('/:userId', requireAuth, upload.single('media'), async (req, res, next) => {
  try {
    const db = await getDb();
    const myId = req.user.id;
    const otherId = parseInt(req.params.userId, 10);
    const { text, media_type } = req.body;
    
    let file_path = null;

    if (req.file) {
      if (process.env.VERCEL) {
        // Upload to Vercel Blob
        const fileBuffer = fs.readFileSync(req.file.path);
        const blob = await put(`chat/${Date.now()}-${req.file.originalname}`, fileBuffer, {
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

    const result = await db.query(`
      INSERT INTO messages (sender_id, receiver_id, text, media_type, file_path)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [myId, otherId, text || '', media_type || null, file_path]);

    res.status(201).json({ message: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Mark messages as read
router.put('/:userId/read', requireAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    const myId = req.user.id;
    const otherId = parseInt(req.params.userId, 10);
    
    await db.query(`
      UPDATE messages 
      SET is_read = true 
      WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false
    `, [otherId, myId]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

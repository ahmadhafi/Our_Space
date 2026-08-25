/**
 * Posts Routes — CRUD for posts, media, likes, comments
 * MODULE 1: Posts Feed (Threads-style)
 */

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { getDb } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');
const { upload, validateFileSizes, getMediaType } = require('../middleware/upload');
const { sendPushToPartner } = require('../services/pushService');
const { put, del } = require('@vercel/blob');
const fs = require('fs');
const path = require('path');

// All routes require authentication
router.use(authenticateToken);

// GET /api/posts?page=1
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('username').optional().trim()
  ],
  async (req, res) => {
    try {
      const db = getDb();
      const page = req.query.page || 1;
      const username = req.query.username;
      const limit = 20;
      const offset = (page - 1) * limit;
      const userId = req.user.id;

      let posts = [];
      let totalCount = 0;

      if (username) {
        const { rows } = await db.query(`
          SELECT 
            p.id, p.text, p.created_at,
            u.id as user_id, u.username, u.display_name, u.avatar,
            (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
            (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = $1) as user_liked,
            (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
          FROM posts p
          JOIN users u ON p.user_id = u.id
          WHERE u.username = $2
          ORDER BY p.created_at DESC
          LIMIT $3 OFFSET $4
        `, [userId, username, limit, offset]);
        posts = rows;

        const countRes = await db.query(`
          SELECT COUNT(*) as count 
          FROM posts p 
          JOIN users u ON p.user_id = u.id 
          WHERE u.username = $1
        `, [username]);
        totalCount = parseInt(countRes.rows[0].count);
      } else {
        const { rows } = await db.query(`
          SELECT 
            p.id, p.text, p.created_at,
            u.id as user_id, u.username, u.display_name, u.avatar,
            (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
            (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = $1) as user_liked,
            (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
          FROM posts p
          JOIN users u ON p.user_id = u.id
          ORDER BY p.created_at DESC
          LIMIT $2 OFFSET $3
        `, [userId, limit, offset]);
        posts = rows;

        const countRes = await db.query('SELECT COUNT(*) as count FROM posts');
        totalCount = parseInt(countRes.rows[0].count);
      }

      // Attach media to each post
      const postsWithMedia = await Promise.all(posts.map(async (post) => {
        const mediaRes = await db.query('SELECT id, media_type, file_path, original_name FROM post_media WHERE post_id = $1', [post.id]);
        return {
          ...post,
          user_liked: parseInt(post.user_liked) > 0,
          like_count: parseInt(post.like_count),
          comment_count: parseInt(post.comment_count),
          media: mediaRes.rows
        };
      }));

      res.json({
        posts: postsWithMedia,
        pagination: {
          page,
          limit,
          total: totalCount,
          hasMore: offset + limit < totalCount
        }
      });
    } catch (err) {
      console.error('Get posts error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/posts
router.post('/',
  upload.array('media', 10),
  validateFileSizes,
  [body('text').optional().trim()],
  async (req, res) => {
    try {
      const db = getDb();
      const { text } = req.body;
      const files = req.files || [];

      if ((!text || text.trim() === '') && files.length === 0) {
        return res.status(400).json({ error: 'Post must have text or media content' });
      }

      const now = new Date().toISOString();

      const insertRes = await db.query(
        'INSERT INTO posts (user_id, text, created_at) VALUES ($1, $2, $3) RETURNING id',
        [req.user.id, text || '', now]
      );
      const postId = insertRes.rows[0].id;

      for (const file of files) {
        const mediaType = getMediaType(file.mimetype);
        const filename = `${Date.now()}-${file.originalname}`;
        const blob = await put(`posts/${filename}`, file.buffer, { access: 'public' });
        
        await db.query(
          'INSERT INTO post_media (post_id, media_type, file_path, original_name) VALUES ($1, $2, $3, $4)',
          [postId, mediaType, blob.url, file.originalname]
        );
      }

      const mediaTypes = files.map(f => getMediaType(f.mimetype));
      const description = files.length > 0
        ? `${req.user.username} created a post with ${files.length} media file(s)`
        : `${req.user.username} created a text post`;

      await db.query(
        'INSERT INTO activity_logs (user_id, action_type, description, metadata, created_at) VALUES ($1, $2, $3, $4, $5)',
        [req.user.id, 'POST_CREATED', description, JSON.stringify({ post_id: Number(postId), media_types: mediaTypes }), now]
      );

      const postRes = await db.query(`
        SELECT 
          p.id, p.text, p.created_at,
          u.id as user_id, u.username, u.display_name, u.avatar
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.id = $1
      `, [postId]);
      const post = postRes.rows[0];

      const mediaRes = await db.query('SELECT id, media_type, file_path, original_name FROM post_media WHERE post_id = $1', [postId]);

      sendPushToPartner(req.user.id, {
        title: 'Our Space 📸',
        body: `${req.user.display_name || req.user.username} shared a new post`,
        url: '/'
      }).catch(err => console.error('Post push error:', err));

      res.status(201).json({
        post: {
          ...post,
          like_count: 0,
          user_liked: false,
          comment_count: 0,
          media: mediaRes.rows
        }
      });
    } catch (err) {
      console.error('Create post error:', err);
      if (req.files) {
        req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) { /* ignore */ } });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/posts/:id
router.delete('/:id',
  [param('id').isInt().toInt()],
  async (req, res) => {
    try {
      const db = getDb();
      const postId = req.params.id;

      const postRes = await db.query('SELECT id, user_id, text FROM posts WHERE id = $1', [postId]);
      const post = postRes.rows[0];
      
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }
      if (post.user_id !== req.user.id && !req.user.is_admin) {
        return res.status(403).json({ error: 'You can only delete your own posts unless you are an admin' });
      }

      const mediaRes = await db.query('SELECT file_path FROM post_media WHERE post_id = $1', [postId]);
      const mediaFiles = mediaRes.rows;

      await db.query('DELETE FROM posts WHERE id = $1', [postId]);

      await db.query(
        'INSERT INTO activity_logs (user_id, action_type, description, metadata, created_at) VALUES ($1, $2, $3, $4, $5)',
        [req.user.id, 'POST_DELETED', `${req.user.username} deleted a post`, JSON.stringify({ post_id: postId }), new Date().toISOString()]
      );

      for (const media of mediaFiles) {
        if (media.file_path.startsWith('http')) {
          try {
            await del(media.file_path);
          } catch (e) { console.error('Blob delete error:', e); }
        }
      }

      res.json({ message: 'Post deleted' });
    } catch (err) {
      console.error('Delete post error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/posts/:id/like (toggle)
router.post('/:id/like',
  [param('id').isInt().toInt()],
  async (req, res) => {
    try {
      const db = getDb();
      const postId = req.params.id;

      const postRes = await db.query('SELECT id FROM posts WHERE id = $1', [postId]);
      if (postRes.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const existRes = await db.query('SELECT id FROM likes WHERE post_id = $1 AND user_id = $2', [postId, req.user.id]);
      const existing = existRes.rows[0];

      if (existing) {
        await db.query('DELETE FROM likes WHERE id = $1', [existing.id]);
      } else {
        await db.query('INSERT INTO likes (post_id, user_id) VALUES ($1, $2)', [postId, req.user.id]);
      }

      const countRes = await db.query('SELECT COUNT(*) as count FROM likes WHERE post_id = $1', [postId]);
      const likeCount = parseInt(countRes.rows[0].count);
      const userLiked = !existing;

      res.json({ liked: userLiked, like_count: likeCount });
    } catch (err) {
      console.error('Like error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/posts/:id/comments
router.get('/:id/comments',
  [param('id').isInt().toInt()],
  async (req, res) => {
    try {
      const db = getDb();
      const postId = req.params.id;

      const { rows: comments } = await db.query(`
        SELECT 
          c.id, c.text, c.created_at,
          u.id as user_id, u.username, u.display_name, u.avatar
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id = $1
        ORDER BY c.created_at ASC
      `, [postId]);

      res.json({ comments });
    } catch (err) {
      console.error('Get comments error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/posts/:id/comments
router.post('/:id/comments',
  [
    param('id').isInt().toInt(),
    body('text').trim().notEmpty().withMessage('Comment text is required').isLength({ max: 1000 }).withMessage('Comment must be under 1000 characters')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const db = getDb();
      const postId = req.params.id;
      const { text } = req.body;

      const postRes = await db.query('SELECT id FROM posts WHERE id = $1', [postId]);
      if (postRes.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const now = new Date().toISOString();

      const insertRes = await db.query(
        'INSERT INTO comments (post_id, user_id, text, created_at) VALUES ($1, $2, $3, $4) RETURNING id',
        [postId, req.user.id, text, now]
      );
      const commentId = insertRes.rows[0].id;

      await db.query(
        'INSERT INTO activity_logs (user_id, action_type, description, metadata, created_at) VALUES ($1, $2, $3, $4, $5)',
        [req.user.id, 'COMMENT_ADDED', `${req.user.username} commented on a post`, JSON.stringify({ post_id: postId, comment_id: Number(commentId) }), now]
      );

      sendPushToPartner(req.user.id, {
        title: 'Our Space 💬',
        body: `${req.user.display_name || req.user.username}: ${text}`,
        url: '/'
      }).catch(err => console.error('Comment push error:', err));

      const commentRes = await db.query(`
        SELECT 
          c.id, c.text, c.created_at,
          u.id as user_id, u.username, u.display_name, u.avatar
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.id = $1
      `, [commentId]);
      
      res.status(201).json({ comment: commentRes.rows[0] });
    } catch (err) {
      console.error('Create comment error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/posts/:id/comments/:commentId
router.delete('/:id/comments/:commentId',
  [
    param('id').isInt().toInt(),
    param('commentId').isInt().toInt()
  ],
  async (req, res) => {
    try {
      const db = getDb();
      const { id: postId, commentId } = req.params;

      const commentRes = await db.query('SELECT id, user_id FROM comments WHERE id = $1 AND post_id = $2', [commentId, postId]);
      const comment = commentRes.rows[0];
      
      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      if (comment.user_id !== req.user.id && !req.user.is_admin) {
        return res.status(403).json({ error: 'You can only delete your own comments unless you are an admin' });
      }

      await db.query('DELETE FROM comments WHERE id = $1', [commentId]);

      res.json({ message: 'Comment deleted' });
    } catch (err) {
      console.error('Delete comment error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;

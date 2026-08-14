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
  (req, res) => {
    try {
      const db = getDb();
      const page = req.query.page || 1;
      const username = req.query.username;
      const limit = 20;
      const offset = (page - 1) * limit;
      const userId = req.user.id;

      let posts;
      let totalCount;

      if (username) {
        posts = db.prepare(`
          SELECT 
            p.id, p.text, p.created_at,
            u.id as user_id, u.username, u.display_name, u.avatar,
            (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
            (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as user_liked,
            (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
          FROM posts p
          JOIN users u ON p.user_id = u.id
          WHERE u.username = ?
          ORDER BY p.created_at DESC
          LIMIT ? OFFSET ?
        `).all(userId, username, limit, offset);

        totalCount = db.prepare(`
          SELECT COUNT(*) as count 
          FROM posts p 
          JOIN users u ON p.user_id = u.id 
          WHERE u.username = ?
        `).get(username).count;
      } else {
        posts = db.prepare(`
          SELECT 
            p.id, p.text, p.created_at,
            u.id as user_id, u.username, u.display_name, u.avatar,
            (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
            (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as user_liked,
            (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
          FROM posts p
          JOIN users u ON p.user_id = u.id
          ORDER BY p.created_at DESC
          LIMIT ? OFFSET ?
        `).all(userId, limit, offset);

        totalCount = db.prepare('SELECT COUNT(*) as count FROM posts').get().count;
      }

      // Attach media to each post
      const mediaStmt = db.prepare('SELECT id, media_type, file_path, original_name FROM post_media WHERE post_id = ?');
      const postsWithMedia = posts.map(post => ({
        ...post,
        user_liked: post.user_liked > 0,
        media: mediaStmt.all(post.id)
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
  (req, res) => {
    try {
      const db = getDb();
      const { text } = req.body;
      const files = req.files || [];

      // Must have either text or media
      if ((!text || text.trim() === '') && files.length === 0) {
        // Clean up any uploaded files
        files.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) { /* ignore */ } });
        return res.status(400).json({ error: 'Post must have text or media content' });
      }

      const now = new Date().toISOString();
      let postId;

      const createTransaction = db.transaction(() => {
        const result = db.prepare(
          'INSERT INTO posts (user_id, text, created_at) VALUES (?, ?, ?)'
        ).run(req.user.id, text || '', now);
        postId = result.lastInsertRowid;

        // Insert media files
        const insertMedia = db.prepare(
          'INSERT INTO post_media (post_id, media_type, file_path, original_name) VALUES (?, ?, ?, ?)'
        );
        for (const file of files) {
          const mediaType = getMediaType(file.mimetype);
          insertMedia.run(postId, mediaType, file.filename, file.originalname);
        }

        // Activity log
        const mediaTypes = files.map(f => getMediaType(f.mimetype));
        const description = files.length > 0
          ? `${req.user.username} created a post with ${files.length} media file(s)`
          : `${req.user.username} created a text post`;

        db.prepare(
          'INSERT INTO activity_logs (user_id, action_type, description, metadata, created_at) VALUES (?, ?, ?, ?, ?)'
        ).run(
          req.user.id,
          'POST_CREATED',
          description,
          JSON.stringify({ post_id: Number(postId), media_types: mediaTypes }),
          now
        );
      });

      createTransaction();

      // Fetch the created post with all data
      const post = db.prepare(`
        SELECT 
          p.id, p.text, p.created_at,
          u.id as user_id, u.username, u.display_name, u.avatar
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.id = ?
      `).get(postId);

      const media = db.prepare('SELECT id, media_type, file_path, original_name FROM post_media WHERE post_id = ?').all(postId);

      res.status(201).json({
        post: {
          ...post,
          like_count: 0,
          user_liked: false,
          comment_count: 0,
          media
        }
      });
    } catch (err) {
      console.error('Create post error:', err);
      // Clean up files on error
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
  (req, res) => {
    try {
      const db = getDb();
      const postId = req.params.id;

      const post = db.prepare('SELECT id, user_id, text FROM posts WHERE id = ?').get(postId);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }
      if (post.user_id !== req.user.id && !req.user.is_admin) {
        return res.status(403).json({ error: 'You can only delete your own posts unless you are an admin' });
      }

      // Get media files to delete
      const mediaFiles = db.prepare('SELECT file_path FROM post_media WHERE post_id = ?').all(postId);

      const deleteTransaction = db.transaction(() => {
        db.prepare('DELETE FROM posts WHERE id = ?').run(postId);

        db.prepare(
          'INSERT INTO activity_logs (user_id, action_type, description, metadata, created_at) VALUES (?, ?, ?, ?, ?)'
        ).run(
          req.user.id,
          'POST_DELETED',
          `${req.user.username} deleted a post`,
          JSON.stringify({ post_id: postId }),
          new Date().toISOString()
        );
      });

      deleteTransaction();

      // Delete media files from disk (outside transaction — best effort)
      const uploadsPath = process.env.UPLOADS_PATH || '/var/data/ourspace/uploads';
      for (const media of mediaFiles) {
        try {
          fs.unlinkSync(path.join(uploadsPath, media.file_path));
        } catch (e) { /* file may not exist */ }
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
  (req, res) => {
    try {
      const db = getDb();
      const postId = req.params.id;

      const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const existing = db.prepare('SELECT id FROM likes WHERE post_id = ? AND user_id = ?').get(postId, req.user.id);

      if (existing) {
        db.prepare('DELETE FROM likes WHERE id = ?').run(existing.id);
      } else {
        db.prepare('INSERT INTO likes (post_id, user_id) VALUES (?, ?)').run(postId, req.user.id);
      }

      const likeCount = db.prepare('SELECT COUNT(*) as count FROM likes WHERE post_id = ?').get(postId).count;
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
  (req, res) => {
    try {
      const db = getDb();
      const postId = req.params.id;

      const comments = db.prepare(`
        SELECT 
          c.id, c.text, c.created_at,
          u.id as user_id, u.username, u.display_name, u.avatar
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC
      `).all(postId);

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
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    try {
      const db = getDb();
      const postId = req.params.id;
      const { text } = req.body;

      const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const now = new Date().toISOString();
      let commentId;

      const commentTransaction = db.transaction(() => {
        const result = db.prepare(
          'INSERT INTO comments (post_id, user_id, text, created_at) VALUES (?, ?, ?, ?)'
        ).run(postId, req.user.id, text, now);
        commentId = result.lastInsertRowid;

        db.prepare(
          'INSERT INTO activity_logs (user_id, action_type, description, metadata, created_at) VALUES (?, ?, ?, ?, ?)'
        ).run(
          req.user.id,
          'COMMENT_ADDED',
          `${req.user.username} commented on a post`,
          JSON.stringify({ post_id: postId, comment_id: Number(commentId) }),
          now
        );
      });

      commentTransaction();

      const comment = db.prepare(`
        SELECT 
          c.id, c.text, c.created_at,
          u.id as user_id, u.username, u.display_name, u.avatar
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
      `).get(commentId);

      res.status(201).json({ comment });
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
  (req, res) => {
    try {
      const db = getDb();
      const { id: postId, commentId } = req.params;

      const comment = db.prepare('SELECT id, user_id FROM comments WHERE id = ? AND post_id = ?').get(commentId, postId);
      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      if (comment.user_id !== req.user.id && !req.user.is_admin) {
        return res.status(403).json({ error: 'You can only delete your own comments unless you are an admin' });
      }

      db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);

      res.json({ message: 'Comment deleted' });
    } catch (err) {
      console.error('Delete comment error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;

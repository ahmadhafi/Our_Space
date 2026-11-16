/**
 * Unified Storage Service
 * Supports:
 * 1. Vercel Blob (when BLOB_READ_WRITE_TOKEN is set)
 * 2. Persistent Local Disk (for cPanel, VPS, or local development)
 */

const fs = require('fs');
const path = require('path');

// Determine uploads directory on disk
const uploadsDir = process.env.UPLOADS_PATH || (process.env.VERCEL ? '/tmp/uploads' : path.join(__dirname, '..', '..', 'uploads'));

// Ensure base upload directory exists
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  console.warn('[Storage] Uploads directory creation note:', e.message);
}

/**
 * Save an uploaded file buffer.
 * @param {string} folder - subfolder e.g. 'posts', 'stories', 'avatars', 'chat'
 * @param {string} originalName - original filename
 * @param {Buffer} buffer - file content buffer
 * @returns {Promise<string>} - full url (Blob) or relative path (local: 'posts/123-file.jpg')
 */
async function saveMedia(folder, originalName, buffer) {
  // If Vercel Blob token is configured, use Vercel Blob
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put } = require('@vercel/blob');
      const filename = `${Date.now()}-${(originalName || 'file').replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const blob = await put(`${folder}/${filename}`, buffer, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN
      });
      return blob.url;
    } catch (blobErr) {
      console.warn('[Storage] Vercel Blob upload failed, falling back to local disk:', blobErr.message);
    }
  }

  // Local filesystem storage (cPanel / VPS)
  const targetDir = path.join(uploadsDir, folder);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const ext = path.extname(originalName || '') || '.jpg';
  const base = path.basename(originalName || 'file', ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${Date.now()}-${base}${ext}`;
  const filePath = path.join(targetDir, filename);

  await fs.promises.writeFile(filePath, buffer);

  // Return relative path: 'posts/1715000-photo.jpg'
  // client getMediaUrl resolves this to '/uploads/posts/1715000-photo.jpg'
  return `${folder}/${filename}`;
}

/**
 * Delete a media file from Vercel Blob or local disk.
 * @param {string} fileUrlOrPath
 */
async function deleteMedia(fileUrlOrPath) {
  if (!fileUrlOrPath) return;

  // If it's a Vercel Blob URL
  if (fileUrlOrPath.startsWith('http')) {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { del } = require('@vercel/blob');
        await del(fileUrlOrPath, { token: process.env.BLOB_READ_WRITE_TOKEN });
      } catch (err) {
        console.error('[Storage] Blob delete error:', err.message);
      }
    }
    return;
  }

  // Local file delete
  try {
    const cleanRelPath = fileUrlOrPath.replace(/^\/?uploads\//, '');
    const fullPath = path.join(uploadsDir, cleanRelPath);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  } catch (err) {
    console.error('[Storage] Local delete error:', err.message);
  }
}

module.exports = {
  saveMedia,
  deleteMedia,
  uploadsDir
};

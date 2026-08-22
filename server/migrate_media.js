const { db } = require('@vercel/postgres');
const { put } = require('@vercel/blob');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const UPLOADS_DIR = path.join(__dirname, 'uploads');

async function migrateMedia() {
  const client = await db.connect();
  try {
    console.log('Checking for users with local avatars...');
    const users = await client.query('SELECT id, avatar_url FROM users WHERE avatar_url IS NOT NULL AND avatar_url NOT LIKE $1', ['http%']);
    
    for (const user of users.rows) {
      const localPath = path.join(UPLOADS_DIR, path.basename(user.avatar_url));
      if (fs.existsSync(localPath)) {
        console.log(`Uploading avatar for user ${user.id}...`);
        const fileBuffer = fs.readFileSync(localPath);
        const blob = await put(`avatars/${path.basename(user.avatar_url)}`, fileBuffer, { access: 'public' });
        await client.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [blob.url, user.id]);
        console.log(`Migrated user ${user.id} avatar to ${blob.url}`);
      } else {
        console.log(`Local file not found for user ${user.id}: ${localPath}`);
      }
    }

    console.log('Checking for post_media with local paths...');
    const mediaItems = await client.query('SELECT id, file_path FROM post_media WHERE file_path NOT LIKE $1', ['http%']);
    
    for (const media of mediaItems.rows) {
      const localPath = path.join(UPLOADS_DIR, path.basename(media.file_path));
      if (fs.existsSync(localPath)) {
        console.log(`Uploading post media ${media.id}...`);
        const fileBuffer = fs.readFileSync(localPath);
        const blob = await put(`posts/${path.basename(media.file_path)}`, fileBuffer, { access: 'public' });
        await client.query('UPDATE post_media SET file_path = $1 WHERE id = $2', [blob.url, media.id]);
        console.log(`Migrated post media ${media.id} to ${blob.url}`);
      } else {
        console.log(`Local file not found for post media ${media.id}: ${localPath}`);
      }
    }

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
  }
}

migrateMedia();

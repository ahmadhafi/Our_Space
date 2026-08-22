const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcrypt');
const { getDb } = require('./db/connection');
const { initializeSchema } = require('./db/schema');

const uploadsPath = process.env.UPLOADS_PATH || './uploads';
fs.mkdirSync(uploadsPath, { recursive: true });

async function seed() {
  try {
    const db = getDb();
    
    console.log('Initializing schema...');
    await initializeSchema(db);

    console.log('Checking for existing users...');
    const { rows } = await db.query('SELECT id FROM users LIMIT 1');
    if (rows.length > 0) {
      console.log('Database already seeded. Skipping initial user creation.');
      return;
    }

    console.log('Seeding initial users...');
    const hash = await bcrypt.hash('password123', 12);
    const now = new Date().toISOString();
    
    await db.query(`
      INSERT INTO users (username, password_hash, display_name, avatar, bio, join_date, last_username_change, theme_preset, accent_color, bg_color)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, ['lila', hash, 'Lila', null, '', now, now, 'sakura', '#f9a8d4', '#fff0f5']);

    await db.query(`
      INSERT INTO users (username, password_hash, display_name, avatar, bio, join_date, last_username_change, theme_preset, accent_color, bg_color)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, ['hafi', hash, 'Hafi', null, '', now, now, 'lavender', '#c084fc', '#f5f0ff']);

    console.log('Database seeded with lila/password123 and hafi/password123');
  } catch (err) {
    if (err.message.includes('unique constraint')) {
      console.log('Already seeded.');
    } else {
      console.error(err);
    }
  }
}

seed();

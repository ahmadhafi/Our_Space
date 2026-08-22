const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const { initializeSchema } = require('./db/schema');

const dbPath = process.env.DB_PATH || './ourspace.db';
const uploadsPath = process.env.UPLOADS_PATH || './uploads';

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.mkdirSync(uploadsPath, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

initializeSchema(db);

async function seed() {
  const hash = await bcrypt.hash('password123', 12);
  const now = new Date().toISOString();
  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, display_name, avatar, bio, join_date, last_username_change, theme_preset, accent_color, bg_color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  try {
    const seedTransaction = db.transaction(() => {
      insertUser.run('lila', hash, 'Lila', null, '', now, now, 'sakura', '#f9a8d4', '#fff0f5');
      insertUser.run('hafi', hash, 'Hafi', null, '', now, now, 'lavender', '#c084fc', '#f5f0ff');
    });
    seedTransaction();
    console.log('Database seeded with lila/password123 and hafi/password123');
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      console.log('Already seeded.');
    } else {
      console.error(err);
    }
  }
}
seed();

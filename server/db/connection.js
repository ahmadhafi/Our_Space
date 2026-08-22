/**
 * Database Connection — Singleton better-sqlite3 instance
 * WAL mode for concurrent reads (PM2 cluster), foreign keys enabled
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { initializeSchema } = require('./schema');

let db = null;

function getDb() {
  if (db) return db;

  const defaultPath = process.env.VERCEL ? '/tmp/ourspace.db' : '/var/data/ourspace/ourspace.db';
  const dbPath = process.env.DB_PATH || defaultPath;

  // Ensure parent directory exists
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  
  // Ensure schema exists on every start
  initializeSchema(db);
  
  // VERCEL AUTO-SEEDING: Because Vercel's /tmp is ephemeral, the DB resets on every cold start.
  // We need to automatically seed the 'lila' and 'hafi' accounts if they don't exist.
  if (process.env.VERCEL) {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (userCount === 0) {
      const now = new Date().toISOString();
      // Hardcoded hash for 'password123'
      const hash = '$2b$12$n17PuNfigAEdumSVf9Ryn.RS0gx6bpImGrKKi/ZW3/yHuv/vqjdhW';
      
      const insertUser = db.prepare(`
        INSERT INTO users (username, password_hash, display_name, avatar, bio, join_date, last_username_change, theme_preset, accent_color, bg_color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      try {
        db.transaction(() => {
          insertUser.run('lila', hash, 'Lila', null, '', now, now, 'sakura', '#f9a8d4', '#fff0f5');
          insertUser.run('hafi', hash, 'Hafi', null, '', now, now, 'lavender', '#c084fc', '#f5f0ff');
        })();
        console.log('[Vercel Setup] Auto-seeded database with default accounts.');
      } catch (err) {
        console.error('[Vercel Setup] Failed to auto-seed database:', err.message);
      }
    }
  }

  return db;
}

// Graceful shutdown
process.on('SIGINT', () => {
  if (db) db.close();
});
process.on('SIGTERM', () => {
  if (db) db.close();
});

module.exports = { getDb };

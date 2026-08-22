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

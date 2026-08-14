const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/ourspace.db');

try {
  const db = new Database(dbPath);
  
  const username = process.argv[2];
  
  if (!username) {
    console.error('Please provide a username: node make-admin.js <username>');
    process.exit(1);
  }
  
  const user = db.prepare('SELECT id, is_admin FROM users WHERE username = ?').get(username);
  
  if (!user) {
    console.error(`User '${username}' not found.`);
    process.exit(1);
  }
  
  if (user.is_admin) {
    console.log(`User '${username}' is already an admin.`);
    process.exit(0);
  }
  
  db.prepare('UPDATE users SET is_admin = 1 WHERE username = ?').run(username);
  console.log(`User '${username}' has been successfully promoted to admin.`);
  
  db.close();
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}

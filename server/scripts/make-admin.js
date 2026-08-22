const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { getDb } = require('../db/connection');

async function makeAdmin() {
  try {
    const db = getDb();
    
    const username = process.argv[2];
    
    if (!username) {
      console.error('Please provide a username: node make-admin.js <username>');
      process.exit(1);
    }
    
    const { rows } = await db.query('SELECT id, is_admin FROM users WHERE username = $1', [username]);
    const user = rows[0];
    
    if (!user) {
      console.error(`User '${username}' not found.`);
      process.exit(1);
    }
    
    if (user.is_admin) {
      console.log(`User '${username}' is already an admin.`);
      process.exit(0);
    }
    
    await db.query('UPDATE users SET is_admin = true WHERE username = $1', [username]);
    console.log(`User '${username}' has been successfully promoted to admin.`);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

makeAdmin();

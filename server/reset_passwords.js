const bcrypt = require('bcrypt');
const { getDb } = require('./db/connection');

async function resetPasswords() {
  const db = getDb();
  
  const users = db.prepare('SELECT id, username FROM users').all();
  
  const defaultPassword = 'password123';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);
  
  for (const user of users) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashedPassword, user.id);
    console.log(`Password reset to "${defaultPassword}" for user: ${user.username}`);
  }
  
  console.log('All passwords reset successfully.');
}

resetPasswords().catch(console.error);

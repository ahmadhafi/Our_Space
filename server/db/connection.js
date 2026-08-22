const { Pool } = require('pg');
const sql = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const { initializeSchema } = require('./schema');

let initPromise = null;

function ensureInitialized() {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await initializeSchema(sql);
        await seedDefaultUsers(sql);
      } catch (err) {
        initPromise = null;
        throw err;
      }
    })();
  }
  return initPromise;
}

function getDb() {
  return sql;
}

async function seedDefaultUsers(db) {
  try {
    // Forcefully update passwords as requested by the user
    if (process.env.VERCEL) {
      const hashHafi = '$2b$10$uQyPkAdL0RAumHJ4CBaCoOEmYTes3CLczlZVAG6jFnp9sWvJE4jCu'; // sayanglila
      const hashLila = '$2b$10$A8CmVXLhOQTmyZMPlEYGz.5vr4Q45AVOqBvEwzI1Cw6FA.Nku54UC'; // password123
      
      await db.query(`UPDATE users SET password_hash = $1 WHERE username = 'hafi'`, [hashHafi]);
      await db.query(`UPDATE users SET password_hash = $1 WHERE username = 'lila'`, [hashLila]);

      const { rows } = await db.query('SELECT COUNT(*) as count FROM users');
      if (parseInt(rows[0].count) === 0) {
        await db.query(`
          INSERT INTO users (username, password_hash, display_name, avatar, bio, theme_preset, accent_color, bg_color)
          VALUES 
            ('lila', $1, 'Lila', null, '', 'sakura', '#f9a8d4', '#fff0f5'),
            ('hafi', $2, 'Hafi', null, '', 'lavender', '#c084fc', '#f5f0ff')
        `, [hashLila, hashHafi]);
        console.log('[Postgres Setup] Auto-seeded database with default accounts.');
      }
    }
  } catch (err) {
    console.error('[Postgres Setup] Failed to auto-seed database:', err.message);
    throw err;
  }
}

module.exports = { getDb, ensureInitialized };

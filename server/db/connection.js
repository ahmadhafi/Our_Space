const { Pool } = require('pg');

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

const sql = new Pool(
  connectionString
    ? {
        connectionString,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
      }
    : {
        ssl: { rejectUnauthorized: false }
      }
);

const { initializeSchema } = require('./schema');

let isInitialized = false;
let initPromise = null;

async function ensureInitialized() {
  if (isInitialized) {
    return Promise.resolve();
  }

  if (!initPromise) {
    initPromise = (async () => {
      try {
        await initializeSchema(sql);
        await seedDefaultUsers(sql);
        isInitialized = true;
      } catch (err) {
        initPromise = null;
        console.error('[Postgres] ensureInitialized error:', err.message);
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
    if (process.env.VERCEL) {
      const { rows } = await db.query('SELECT COUNT(*) as count FROM users');
      if (parseInt(rows[0].count, 10) === 0) {
        const hashHafi = '$2b$10$uQyPkAdL0RAumHJ4CBaCoOEmYTes3CLczlZVAG6jFnp9sWvJE4jCu'; // sayanglila
        const hashLila = '$2b$10$A8CmVXLhOQTmyZMPlEYGz.5vr4Q45AVOqBvEwzI1Cw6FA.Nku54UC'; // password123

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
    console.error('[Postgres Setup] Seed check note:', err.message);
  }
}

module.exports = { getDb, ensureInitialized };

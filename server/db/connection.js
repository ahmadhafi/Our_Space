const { createPool } = require('@vercel/postgres');
const sql = createPool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL
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
    // Only auto-seed if we are on Vercel to ensure initial users exist
    if (process.env.VERCEL) {
      const { rows } = await db.query('SELECT COUNT(*) as count FROM users');
      if (parseInt(rows[0].count) === 0) {
        const hash = '$2b$12$n17PuNfigAEdumSVf9Ryn.RS0gx6bpImGrKKi/ZW3/yHuv/vqjdhW';
        await db.query(`
          INSERT INTO users (username, password_hash, display_name, avatar, bio, theme_preset, accent_color, bg_color)
          VALUES 
            ('lila', $1, 'Lila', null, '', 'sakura', '#f9a8d4', '#fff0f5'),
            ('hafi', $1, 'Hafi', null, '', 'lavender', '#c084fc', '#f5f0ff')
        `, [hash]);
        console.log('[Postgres Setup] Auto-seeded database with default accounts.');
      }
    }
  } catch (err) {
    console.error('[Postgres Setup] Failed to auto-seed database:', err.message);
    throw err;
  }
}

module.exports = { getDb, ensureInitialized };

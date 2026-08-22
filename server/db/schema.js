/**
 * Database Schema — All CREATE TABLE statements
 * Called once during setup-wizard.js and also on server start (IF NOT EXISTS)
 */

function initializeSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      avatar TEXT DEFAULT NULL,
      bio TEXT NOT NULL DEFAULT '',
      link TEXT NOT NULL DEFAULT '',
      is_admin INTEGER NOT NULL DEFAULT 0,
      join_date TEXT NOT NULL DEFAULT (datetime('now')),
      last_username_change TEXT NOT NULL DEFAULT (datetime('now')),
      theme_preset TEXT NOT NULL DEFAULT 'sakura',
      accent_color TEXT NOT NULL DEFAULT '#f9a8d4',
      bg_color TEXT NOT NULL DEFAULT '#fff0f5',
      split_ratio_percent INTEGER NOT NULL DEFAULT 50
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS post_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      media_type TEXT NOT NULL CHECK(media_type IN ('image', 'video', 'audio')),
      file_path TEXT NOT NULL,
      original_name TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(post_id, user_id),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS finance_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      category TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      split_type TEXT NOT NULL DEFAULT 'personal',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS finance_budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      category TEXT NOT NULL,
      amount INTEGER NOT NULL,
      UNIQUE(month, category)
    );

    CREATE TABLE IF NOT EXISTS finance_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      target_amount INTEGER NOT NULL,
      current_amount INTEGER NOT NULL DEFAULT 0,
      deadline TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS finance_goal_contributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      instrument TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (goal_id) REFERENCES finance_goals(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action_type TEXT NOT NULL CHECK(action_type IN (
        'POST_CREATED', 'POST_DELETED', 'COMMENT_ADDED',
        'FINANCE_ENTRY_ADDED', 'FINANCE_ENTRY_DELETED',
        'PROFILE_UPDATED', 'THEME_CHANGED',
        'USER_LOGIN', 'USER_LOGOUT'
      )),
      description TEXT NOT NULL DEFAULT '',
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON post_media(post_id);
    CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
    CREATE INDEX IF NOT EXISTS idx_likes_user_post ON likes(user_id, post_id);
    CREATE INDEX IF NOT EXISTS idx_finance_date ON finance_entries(date);
    CREATE INDEX IF NOT EXISTS idx_finance_user ON finance_entries(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_logs(action_type);
    CREATE INDEX IF NOT EXISTS idx_refresh_token ON refresh_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_finance_goal_contrib ON finance_goal_contributions(goal_id);
  `);

  try {
    // Migration: add split_type to existing finance_entries
    db.exec(`ALTER TABLE finance_entries ADD COLUMN split_type TEXT NOT NULL DEFAULT 'personal'`);
  } catch (e) {
    // Ignore if column already exists
  }

  try {
    // Migration: add split_ratio_percent to existing users
    db.exec(`ALTER TABLE users ADD COLUMN split_ratio_percent INTEGER NOT NULL DEFAULT 50`);
  } catch (e) {
    // Ignore if column already exists
  }

  try {
    // Migration: check if finance_budgets has category column
    db.prepare('SELECT category FROM finance_budgets LIMIT 1').get();
  } catch (e) {
    // If it fails, category column doesn't exist. We need to migrate.
    db.exec(`
      CREATE TABLE IF NOT EXISTS finance_budgets_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        month TEXT NOT NULL,
        category TEXT NOT NULL,
        amount INTEGER NOT NULL,
        UNIQUE(month, category)
      );
      INSERT INTO finance_budgets_new (month, category, amount) 
      SELECT month, 'Overall', amount FROM finance_budgets;
      DROP TABLE finance_budgets;
      ALTER TABLE finance_budgets_new RENAME TO finance_budgets;
    `);
  }

  try {
    // Migration: remove CHECK constraint from finance_entries.category
    // SQLite doesn't allow dropping constraints easily, so we recreate the table.
    // We can check if the constraint exists by checking the SQL of the table.
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='finance_entries'").get();
    if (tableInfo && tableInfo.sql.includes("CHECK(category IN")) {
      db.exec(`
        PRAGMA foreign_keys=off;
        CREATE TABLE IF NOT EXISTS finance_entries_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          amount INTEGER NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
          category TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          date TEXT NOT NULL,
          split_type TEXT NOT NULL DEFAULT 'personal',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        INSERT INTO finance_entries_new SELECT id, user_id, amount, type, category, note, date, split_type, created_at FROM finance_entries;
        DROP TABLE finance_entries;
        ALTER TABLE finance_entries_new RENAME TO finance_entries;
        CREATE INDEX IF NOT EXISTS idx_finance_date ON finance_entries(date);
        CREATE INDEX IF NOT EXISTS idx_finance_user ON finance_entries(user_id);
        PRAGMA foreign_keys=on;
      `);
    }
  } catch (e) {
    console.error("Migration error for finance_entries:", e);
  }
}

module.exports = { initializeSchema };

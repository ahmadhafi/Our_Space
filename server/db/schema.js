/**
 * Database Schema — PostgreSQL version
 * Called once on server start (CREATE TABLE IF NOT EXISTS)
 */

async function initializeSchema(sql) {
  try {
    await sql.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL DEFAULT '',
        avatar TEXT DEFAULT NULL,
        bio TEXT NOT NULL DEFAULT '',
        link TEXT NOT NULL DEFAULT '',
        is_admin INTEGER NOT NULL DEFAULT 0,
        join_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        last_username_change TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        theme_preset TEXT NOT NULL DEFAULT 'sakura',
        accent_color TEXT NOT NULL DEFAULT '#f9a8d4',
        bg_color TEXT NOT NULL DEFAULT '#fff0f5',
        split_ratio_percent INTEGER NOT NULL DEFAULT 50
      );

      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        text TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS post_media (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL,
        media_type TEXT NOT NULL CHECK(media_type IN ('image', 'video', 'audio')),
        file_path TEXT NOT NULL,
        original_name TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS likes (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(post_id, user_id),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS finance_entries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        category TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        date TEXT NOT NULL,
        split_type TEXT NOT NULL DEFAULT 'personal',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS finance_budgets (
        id SERIAL PRIMARY KEY,
        month TEXT NOT NULL,
        category TEXT NOT NULL,
        amount INTEGER NOT NULL,
        UNIQUE(month, category)
      );

      CREATE TABLE IF NOT EXISTS finance_goals (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        target_amount INTEGER NOT NULL,
        current_amount INTEGER NOT NULL DEFAULT 0,
        deadline TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS finance_goal_contributions (
        id SERIAL PRIMARY KEY,
        goal_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        instrument TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        FOREIGN KEY (goal_id) REFERENCES finance_goals(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        action_type TEXT NOT NULL CHECK(action_type IN (
          'POST_CREATED', 'POST_DELETED', 'COMMENT_ADDED',
          'FINANCE_ENTRY_ADDED', 'FINANCE_ENTRY_DELETED',
          'PROFILE_UPDATED', 'THEME_CHANGED',
          'USER_LOGIN', 'USER_LOGOUT'
        )),
        description TEXT NOT NULL DEFAULT '',
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
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
      CREATE INDEX IF NOT EXISTS idx_finance_goal_contrib ON finance_goal_contributions(goal_id);
    `);
    console.log('[Postgres] Schema initialized successfully');
  } catch (err) {
    console.error('[Postgres] Failed to initialize schema:', err);
    throw err;
  }
}

module.exports = { initializeSchema };

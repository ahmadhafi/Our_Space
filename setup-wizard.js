#!/usr/bin/env node

/**
 * Our Space — First-Run Setup Wizard
 * 
 * Run ONCE to:
 * 1. Create data directories (/var/data/ourspace/uploads/)
 * 2. Initialize the Postgres database with all tables
 * 3. Seed two user accounts
 * 4. Write .setup-complete flag to prevent re-runs
 * 
 * Usage: node setup-wizard.js
 */

const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Load env
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const SETUP_FLAG = path.resolve(__dirname, '.setup-complete');

// Check if already run
if (fs.existsSync(SETUP_FLAG)) {
  console.error('\n❌ Setup has already been completed.');
  console.error('   Delete .setup-complete to run again (this will NOT wipe the database).\n');
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function askHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }
    stdin.resume();

    let password = '';
    const onData = (ch) => {
      const c = ch.toString('utf8');
      if (c === '\n' || c === '\r' || c === '\u0004') {
        if (stdin.isTTY) {
          stdin.setRawMode(wasRaw);
        }
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(password);
      } else if (c === '\u0003') {
        process.exit(0);
      } else if (c === '\u007F' || c === '\b') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        password += c;
        process.stdout.write('*');
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║        Our Space — Setup Wizard          ║');
  console.log('║     First-run account configuration      ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const uploadsPath = process.env.UPLOADS_PATH || '/var/data/ourspace/uploads';

  // Step 1: Create directories
  console.log('📁 Step 1: Creating data directories...');
  try {
    fs.mkdirSync(uploadsPath, { recursive: true });
    console.log(`   ✅ ${uploadsPath}\n`);
  } catch (err) {
    console.error(`   ❌ Failed to create directories: ${err.message}`);
    console.error('   Make sure you run this with appropriate permissions (sudo if needed).\n');
    process.exit(1);
  }

  // Step 2: Initialize database
  console.log('🗄️  Step 2: Initializing database...');
  const { getDb } = require('./server/db/connection');
  const db = getDb();
  
  const { initializeSchema } = require('./server/db/schema');
  await initializeSchema(db);
  console.log('   ✅ All tables created.\n');

  // Step 3: Collect user info
  console.log('👤 Step 3: Create the two user accounts.\n');

  // User A
  console.log('── User A ──');
  let usernameA = '';
  while (!usernameA || usernameA.length < 3 || usernameA.length > 30 || !/^[a-zA-Z0-9_]+$/.test(usernameA)) {
    usernameA = await ask('   Username (3-30 chars, alphanumeric + underscore): ');
    if (!usernameA || usernameA.length < 3 || usernameA.length > 30 || !/^[a-zA-Z0-9_]+$/.test(usernameA)) {
      console.log('   ⚠️  Invalid username. Use 3-30 alphanumeric characters or underscores.');
    }
  }

  let passwordA = '';
  while (!passwordA || passwordA.length < 6) {
    passwordA = await askHidden('   Password (min 6 chars): ');
    if (!passwordA || passwordA.length < 6) {
      console.log('   ⚠️  Password must be at least 6 characters.');
    }
  }

  console.log('');

  // User B
  console.log('── User B ──');
  let usernameB = '';
  while (!usernameB || usernameB.length < 3 || usernameB.length > 30 || !/^[a-zA-Z0-9_]+$/.test(usernameB) || usernameB === usernameA) {
    usernameB = await ask('   Username (3-30 chars, alphanumeric + underscore): ');
    if (usernameB === usernameA) {
      console.log('   ⚠️  Username must be different from User A.');
    } else if (!usernameB || usernameB.length < 3 || usernameB.length > 30 || !/^[a-zA-Z0-9_]+$/.test(usernameB)) {
      console.log('   ⚠️  Invalid username. Use 3-30 alphanumeric characters or underscores.');
    }
  }

  let passwordB = '';
  while (!passwordB || passwordB.length < 6) {
    passwordB = await askHidden('   Password (min 6 chars): ');
    if (!passwordB || passwordB.length < 6) {
      console.log('   ⚠️  Password must be at least 6 characters.');
    }
  }

  console.log('');

  // Step 4: Hash passwords and seed
  console.log('🔐 Step 4: Hashing passwords and seeding accounts...');
  const bcrypt = require('bcrypt');
  const hashA = await bcrypt.hash(passwordA, 12);
  const hashB = await bcrypt.hash(passwordB, 12);

  const now = new Date().toISOString();

  try {
    const { rows: resultA } = await db.query(`
      INSERT INTO users (username, password_hash, display_name, avatar, bio, join_date, last_username_change, theme_preset, accent_color, bg_color)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id
    `, [usernameA, hashA, usernameA, null, '', now, now, 'sakura', '#f9a8d4', '#fff0f5']);
    
    const { rows: resultB } = await db.query(`
      INSERT INTO users (username, password_hash, display_name, avatar, bio, join_date, last_username_change, theme_preset, accent_color, bg_color)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id
    `, [usernameB, hashB, usernameB, null, '', now, now, 'lavender', '#c084fc', '#f5f0ff']);

    await db.query(`
      INSERT INTO activity_logs (user_id, action_type, description, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [resultA[0].id, 'USER_LOGIN', `${usernameA} account created via setup wizard`, '{}', now]);

    await db.query(`
      INSERT INTO activity_logs (user_id, action_type, description, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [resultB[0].id, 'USER_LOGIN', `${usernameB} account created via setup wizard`, '{}', now]);
    
    console.log(`   ✅ User "${usernameA}" created.`);
    console.log(`   ✅ User "${usernameB}" created.\n`);
  } catch (err) {
    if (err.message.includes('unique constraint')) {
      console.error('   ❌ One or both usernames already exist in the database.');
      console.error('   If you need to re-seed, clear the database table first.\n');
    } else {
      console.error(`   ❌ Error seeding accounts: ${err.message}\n`);
    }
    rl.close();
    process.exit(1);
  }

  // Step 5: Write flag
  fs.writeFileSync(SETUP_FLAG, `Setup completed at ${now}\nUsers: ${usernameA}, ${usernameB}\n`);
  rl.close();

  console.log('╔══════════════════════════════════════════╗');
  console.log('║         ✅ Setup Complete!               ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Copy nginx.conf to /etc/nginx/sites-available/ourspace');
  console.log('  2. ln -s /etc/nginx/sites-available/ourspace /etc/nginx/sites-enabled/');
  console.log('  3. nginx -t && systemctl reload nginx');
  console.log('  4. pm2 start ecosystem.config.js');
  console.log('  5. pm2 save && pm2 startup');
  console.log('');
}

main().catch((err) => {
  console.error('\n❌ Setup failed:', err.message);
  rl.close();
  process.exit(1);
});

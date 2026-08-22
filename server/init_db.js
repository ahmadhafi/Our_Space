require('dotenv').config({ path: '../.env' });
const { ensureInitialized } = require('./db/connection');

async function run() {
  try {
    console.log('Initializing DB...');
    await ensureInitialized();
    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error('Failed:', err);
    process.exit(1);
  }
}
run();

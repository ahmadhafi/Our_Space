require('dotenv').config({ path: '../.env' });
const { getDb } = require('../db/connection.js');
async function run() {
  const db = await getDb();
  try {
    const res = await db.query("SELECT conname FROM pg_constraint WHERE conrelid = 'activity_logs'::regclass;");
    console.log(res.rows);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();

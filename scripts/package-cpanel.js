#!/usr/bin/env node

/**
 * Our Space — cPanel Deployment Packager
 * 
 * 1. Builds client React frontend (`client/dist`)
 * 2. Packages backend files and built frontend into `cpanel-deploy.zip`
 * 3. Ready to upload directly to cPanel File Manager!
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const clientDir = path.join(rootDir, 'client');
const distDir = path.join(clientDir, 'dist');
const zipFile = path.join(rootDir, 'cpanel-deploy.zip');

console.log('🚀 [cPanel Packager] Starting deployment build...\n');

// 1. Build Client
console.log('📦 Step 1/3: Building React client (Vite)...');
try {
  execSync('npm run build', { cwd: clientDir, stdio: 'inherit' });
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('client/dist/index.html was not generated.');
  }
  console.log('   ✅ Client build successful.\n');
} catch (err) {
  console.error('   ❌ Client build failed:', err.message);
  process.exit(1);
}

// 2. Prepare uploads folder
console.log('📁 Step 2/3: Ensuring uploads folder exists...');
const uploadsDir = path.join(rootDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const gitkeep = path.join(uploadsDir, '.gitkeep');
if (!fs.existsSync(gitkeep)) {
  fs.writeFileSync(gitkeep, '');
}
console.log('   ✅ Uploads folder ready.\n');

// 3. Remove old zip if exists
if (fs.existsSync(zipFile)) {
  fs.unlinkSync(zipFile);
}

// 4. Create zip package
console.log('🗜️  Step 3/3: Creating cpanel-deploy.zip...');
try {
  const excludePatterns = [
    '*.git*',
    'node_modules/*',
    'client/node_modules/*',
    'client/src/*',
    'server/node_modules/*',
    '*.env',
    '*.db*',
    'scratch/*',
    '.vercel/*',
    'cpanel-deploy.zip'
  ].map(p => `-x "${p}"`).join(' ');

  const zipCmd = `zip -r cpanel-deploy.zip app.js package.json package-lock.json .env.example .htaccess server/ client/dist/ uploads/ ${excludePatterns}`;
  execSync(zipCmd, { cwd: rootDir, stdio: 'pipe' });

  const stats = fs.statSync(zipFile);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`\n🎉 Success! Deployment package created:`);
  console.log(`   📦 File: cpanel-deploy.zip (${sizeMB} MB)`);
  console.log(`   📂 Path: ${zipFile}`);
  console.log(`\n📋 Next Steps:`);
  console.log(`   1. Open cPanel File Manager -> Upload cpanel-deploy.zip`);
  console.log(`   2. Extract cpanel-deploy.zip into your app directory`);
  console.log(`   3. Setup Node.js App in cPanel pointing to app.js`);
  console.log(`   4. Create .env file with your DATABASE_URL and secrets`);
  console.log(`   5. Click "Run NPM Install" and Start Application!`);
} catch (err) {
  console.error('   ❌ Failed to create zip package:', err.message);
  process.exit(1);
}

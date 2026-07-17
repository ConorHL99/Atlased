/**
 * Load environment variables BEFORE anything else.
 * This file must be imported first in index.ts before any other imports.
 */

import dotenv from 'dotenv';
import fs from 'fs';

// Absolute path to .env.local and .env in backend directory
const envLocalPath = `c:\\Users\\lyoncon\\OneDrive - Mars Inc\\Documents\\TRAVEL-MAP-PROJECT\\backend\\.env.local`;
const envPath = `c:\\Users\\lyoncon\\OneDrive - Mars Inc\\Documents\\TRAVEL-MAP-PROJECT\\backend\\.env`;

console.log(`\n🔍 Checking for .env files...`);
console.log(`   .env.local exists: ${fs.existsSync(envLocalPath)}`);
console.log(`   .env exists: ${fs.existsSync(envPath)}\n`);

let result;
if (fs.existsSync(envLocalPath)) {
  console.log(`✅ Loading .env.local`);
  result = dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  console.log(`✅ Loading .env`);
  result = dotenv.config({ path: envPath });
} else {
  console.error(`❌ Neither .env.local nor .env found!`);
  result = { error: new Error('No .env file found') };
}

if (result.error) {
  console.warn(`⚠️  Error loading env: ${result.error.message}`);
} else if (result.parsed) {
  console.log(`✅ Environment variables loaded (${Object.keys(result.parsed).length} vars)`);
  console.log(`   DATABASE_PROVIDER: ${process.env.DATABASE_PROVIDER}`);
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '(set)' : '(not set)'}`);
  console.log(`   JWT_SECRET: ${process.env.JWT_SECRET ? '(set)' : '(not set)'}`);
  console.log(`   CORS_ORIGIN: ${process.env.CORS_ORIGIN || '(not set)'}\n`);
}

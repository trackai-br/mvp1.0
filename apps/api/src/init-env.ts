/**
 * CRITICAL: This file MUST be imported FIRST in any entrypoint
 * It loads environment variables BEFORE any other imports happen
 * Ensures .env.local (Supabase Cloud) overwrites root .env
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve(process.cwd(), '../../infra/secrets/.env.local');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
  console.log('[init-env] ✓ Loaded .env.local');
} else {
  console.log('[init-env] Loading root .env (fallback)');
  dotenv.config({ override: true });
}

// Verify DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error('[init-env] FATAL: DATABASE_URL not found in environment!');
}

console.log('[init-env] ✓ DATABASE_URL loaded:', process.env.DATABASE_URL.substring(0, 60) + '...');

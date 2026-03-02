import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

// CRITICAL: Load environment variables BEFORE usage
// This ensures .env.local (Supabase Cloud) is available
const envPath = path.resolve(process.cwd(), '../../infra/secrets/.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
} else {
  dotenv.config({ override: true });
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL || process.env.DB_URL,
  },
});

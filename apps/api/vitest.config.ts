import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env.local (in parent directory)
const envPath = path.resolve(__dirname, '../../infra/secrets/.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

export default defineConfig({
  test: {
    exclude: ['dist/**', 'node_modules/**'],
    testTimeout: 30000, // Load tests need more time due to SQS latency
  },
});

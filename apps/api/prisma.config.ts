import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

// Carregar .env.local primeiro (como server.ts faz)
const envPath = path.resolve(process.cwd(), '../../infra/secrets/.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // Fallback para .env padrão (ou nada se não existir)
  dotenv.config();
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL || process.env.DB_URL,
  },
});

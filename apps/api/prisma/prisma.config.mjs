import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: './schema.prisma',
  migrations: {
    path: './migrations'
  },
  datasource: {
    provider: 'postgresql',
    url: process.env.DB_URL
  }
});

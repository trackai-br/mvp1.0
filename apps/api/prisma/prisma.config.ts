import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: './schema.prisma',
  migrations: {
    path: './migrations'
  },
  datasource: {
    provider: 'postgresql',
    url: env('DB_URL')
  }
});

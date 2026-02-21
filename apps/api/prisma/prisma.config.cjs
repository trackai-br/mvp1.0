require('dotenv/config');

module.exports = {
  schema: './schema.prisma',
  migrations: {
    path: './migrations'
  },
  datasource: {
    provider: 'postgresql',
    url: process.env.DB_URL
  }
};

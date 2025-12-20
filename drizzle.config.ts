import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

const config = dotenv.config({ path: '.env' }).parsed!;

export default defineConfig({
  out: './drizzle',
  schema: './api/db',
  dialect: 'mysql',
  dbCredentials: {
    host: config.DB_MYSQL_HOST!,
    user: config.DB_MYSQL_USER!,
    database: config.DB_MYSQL_DATABASE!,
    password: config.DB_MYSQL_PASSWORD!
  },
});
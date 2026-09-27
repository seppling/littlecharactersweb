#!/usr/bin/env node
/** Apply database migrations to the Postgres in DATABASE_URL (run on deploy). */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. (Local dev uses embedded PGlite and migrates itself.)');
  process.exit(1);
}
const client = postgres(process.env.DATABASE_URL, { max: 1 });
await migrate(drizzle(client), { migrationsFolder: 'drizzle' });
await client.end();
console.log('Migrations applied.');

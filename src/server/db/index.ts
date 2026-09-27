/**
 * Database connection.
 *
 * Production: any Postgres via DATABASE_URL (we recommend Neon).
 * Development & tests: embedded PGlite (real Postgres compiled to WASM), so the
 * portal runs with zero setup. Same schema, same queries.
 */
import path from 'node:path';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';
import { config } from '../env';

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const migrationsFolder = path.resolve(process.cwd(), 'drizzle');

/**
 * Small buffers keep the whole server under 512 MB (Render's free preview),
 * plenty for a demo's few families. Production uses real Postgres instead.
 */
export const PGLITE_OPTIONS = {
  postgresqlconf: ['shared_buffers=16MB', 'work_mem=1MB', 'maintenance_work_mem=8MB', 'wal_buffers=512kB'],
};

let dbPromise: Promise<DB> | undefined;

async function connect(): Promise<DB> {
  if (config.databaseUrl) {
    const { default: postgres } = await import('postgres');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const client = postgres(config.databaseUrl, { max: 5, prepare: false });
    return drizzle(client, { schema }) as unknown as DB;
  }

  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const client = new PGlite(config.pgliteDir, PGLITE_OPTIONS);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return db as unknown as DB;
}

export function getDb(): Promise<DB> {
  dbPromise ??= connect();
  return dbPromise;
}

/** Tests: start from a fresh in-memory database. */
export function resetDbForTests() {
  dbPromise = undefined;
}

export { schema };

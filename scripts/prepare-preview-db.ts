#!/usr/bin/env tsx
/**
 * Render preview build step: create the embedded demo database (PGlite) and
 * apply migrations now, so the running server only has to open it.
 *
 * Creating a Postgres database takes over 500 MB of memory for a few seconds,
 * more than the free plan's 512 MB, while opening an existing one takes about
 * 200 MB. Render keeps files written during the build (in the project folder,
 * not /tmp), so each deploy and each wake from sleep starts from this empty
 * database.
 */
import { getDb } from '../src/server/db';
import { config } from '../src/server/env';

if (config.databaseUrl) {
  console.log('DATABASE_URL is set, so there is no embedded database to prepare.');
  process.exit(0);
}

const db = await getDb();
await (db as unknown as { $client: { close(): Promise<void> } }).$client.close();
console.log(`Demo database ready in ${config.pgliteDir}`);

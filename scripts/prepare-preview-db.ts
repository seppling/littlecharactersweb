#!/usr/bin/env tsx
/**
 * Render preview build step: set up the embedded demo database (PGlite) so the
 * running server only has to open it.
 *
 * Creating a Postgres database from scratch peaks at 550–700 MB of memory, more
 * than the free plan's 512 MB (for the build as well as the server). Opening an
 * existing one takes about 200 MB. So instead of creating one, we unpack
 * scripts/pglite-empty.tar.gz (made by `npm run db:snapshot`) with plain `tar`,
 * then open it once to apply migrations.
 *
 * The database lives in the project folder (PGLITE_DIR=.data/pglite), because
 * Render keeps files written during the build but not /tmp. Each deploy and
 * each wake from sleep starts from this empty database.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getDb } from '../src/server/db';
import { config } from '../src/server/env';

if (config.databaseUrl) {
  console.log('DATABASE_URL is set, so there is no embedded database to prepare.');
  process.exit(0);
}

const dir = config.pgliteDir;
if (dir.startsWith('memory://')) throw new Error('PGLITE_DIR must be a folder for the preview, not memory://');

if (!existsSync(path.join(dir, 'PG_VERSION'))) {
  mkdirSync(dir, { recursive: true });
  // stderr is kept for the error message only: tar notes that it strips the archive's leading '/'.
  execFileSync('tar', ['-xzf', path.resolve('scripts/pglite-empty.tar.gz'), '-C', dir], { stdio: ['ignore', 'inherit', 'pipe'] });
}

try {
  const db = await getDb();
  await (db as unknown as { $client: { close(): Promise<void> } }).$client.close();
} catch (e) {
  console.error('The empty database snapshot did not open. After a PGlite upgrade, run `npm run db:snapshot` and commit the result.');
  throw e;
}

const peakMb = Math.round(Number(readFileSync('/proc/self/status', 'utf8').match(/VmHWM:\s+(\d+)/)?.[1] ?? 0) / 1024);
console.log(`Demo database ready in ${dir} (peak memory ${peakMb} MB).`);

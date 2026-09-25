#!/usr/bin/env tsx
/**
 * Regenerate scripts/pglite-empty.tar.gz: a brand-new, empty PGlite database
 * that the Render preview unpacks instead of creating its own (see
 * prepare-preview-db.ts for why).
 *
 * Run this on a laptop or in CI (it needs about 700 MB of memory) whenever CI
 * says the snapshot no longer opens, which happens when an @electric-sql/pglite
 * upgrade moves to a new Postgres major version:
 *
 *   npm run db:snapshot
 */
import { writeFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { PGLITE_OPTIONS } from '../src/server/db';

const out = 'scripts/pglite-empty.tar.gz';
const db = new PGlite('memory://', PGLITE_OPTIONS);
await db.waitReady;
const blob = await db.dumpDataDir('gzip');
writeFileSync(out, Buffer.from(await blob.arrayBuffer()));
await db.close();
console.log(`Wrote ${out} (${(blob.size / 1e6).toFixed(1)} MB). Commit it.`);

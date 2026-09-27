/**
 * Import families and students from Studio Director CSV exports.
 *
 *   npm run import:studio-director -- families.csv students.csv            # preview (writes nothing)
 *   npm run import:studio-director -- families.csv students.csv --commit   # write
 *   npm run import:studio-director -- students.csv --map email="Mom Email"  # point a field at a column
 *
 * Uses DATABASE_URL (production) or the local dev database (APP_ENV=development;
 * stop the dev server first). Needs DATA_ENCRYPTION_KEY in production.
 * Keep exports out of git: *.csv and imports/ are ignored. Delete them when done.
 * Prints counts and row numbers only, never names or notes.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { FIELDS, importFamilies, readFamilies, type Field } from '../src/server/studio-director';

const args = process.argv.slice(2);
const commit = args.includes('--commit');
const overrides: Partial<Record<Field, string>> = {};
const files: string[] = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--commit' || a === '--dry-run') continue;
  if (a === '--map') {
    const [field, ...header] = (args[++i] ?? '').split('=');
    if (!(field in FIELDS) || !header.length) {
      console.error(`--map expects field=Column Header. Fields: ${Object.keys(FIELDS).join(', ')}`);
      process.exit(1);
    }
    overrides[field as Field] = header.join('=');
  } else if (a.startsWith('-')) {
    console.error(`Unknown option ${a}`);
    process.exit(1);
  } else files.push(a);
}
if (!files.length) {
  console.error('Usage: npm run import:studio-director -- <export.csv> [more.csv] [--map field="Header"] [--commit]');
  process.exit(1);
}

const { families, problems, columns } = readFamilies(
  files.map((f) => ({ name: path.basename(f), text: readFileSync(f, 'utf8') })),
  overrides,
);

console.log('\nColumns recognized');
for (const c of columns) {
  console.log(`  ${c.file}`);
  for (const [field, header] of Object.entries(c.matched)) console.log(`    ${field.padEnd(15)} ← ${header}`);
  if (c.ignored.length) console.log(`    (ignored: ${c.ignored.join(', ')})`);
}

const report = await importFamilies(families, { dryRun: !commit });
const all = [...problems, ...report.problems];

console.log(`\n${commit ? 'Imported' : 'Preview (nothing written)'}`);
console.log(`  Households  ${report.households.created} new, ${report.households.matched} already here`);
console.log(`  Parents     ${report.guardians.created} new, ${report.guardians.matched} already here`);
console.log(`  Students    ${report.students.created} new, ${report.students.matched} already here`);
if (all.length) {
  console.log(`\n${all.length} row${all.length === 1 ? '' : 's'} to look at`);
  for (const p of all) console.log(`  ${p.where}  ${p.reason}`);
}
if (!commit) console.log('\nLooks right? Run again with --commit to write it.');
process.exit(0);

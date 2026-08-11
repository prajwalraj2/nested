/**
 * Bring stored table settings in line with the code defaults (K-2, K-4b).
 * ============================================================================
 *
 *     node scripts/align-table-settings.mjs --dry-run     # show, write nothing
 *     node scripts/align-table-settings.mjs               # apply
 *
 * ⚠️ WHY THIS SCRIPT EXISTS — AND WHY IT MUST RUN ON EVERY BRANCH.
 *
 * `resolveTableSettings` merges a stored blob OVER the code defaults, so a stored value
 * always wins. Two fields were changed in code because their stored values were boilerplate
 * that no screen has ever written (proved in K-2: all 20 settings fields held exactly one
 * distinct value across every table):
 *
 *     ui.alternatingRows   true  -> false   K-2, at the user's request: no row stripes
 *     sorting.multiSort    false -> true    K-4b: otherwise the Sort panel is single-rule
 *
 * Changing the default is not enough. Until the stored value changes too, the old value
 * keeps winning — which is exactly what happened: development was migrated, production was
 * not, and the deployed site striped its tables and refused a second sort rule while local
 * behaved correctly.
 *
 * **A code change that depends on a data change is not done until every branch has it.**
 *
 * ⚠️ ONE FIELD EACH, NOTHING ELSE. Every other key in every blob is written back verbatim,
 * and the run verifies afterwards that all 20 settings paths still exist — a drop would mean
 * a shallow spread had eaten keys.
 *
 * ⚠️ Idempotent: it selects only rows that still disagree, so re-running is a no-op.
 *
 * ── Running it against production ──────────────────────────────────────────────
 *   1. Edit `.env` to the production DATABASE_URL / DIRECT_URL
 *   2. node scripts/align-table-settings.mjs --dry-run
 *   3. node scripts/align-table-settings.mjs
 *   4. **Switch `.env` back to development immediately**
 *
 * The change is visible on the site within `CACHE_DURATIONS.MEDIUM` (60s) — the public table
 * response is wrapped in `unstable_cache`, and writing through Prisma does not fire
 * `revalidateTag`. Any admin edit clears it at once if the wait matters.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = process.cwd();
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const require = createRequire(pathToFileURL(path.join(ROOT, 'package.json')).href);
const { PrismaClient } = require(path.join(ROOT, 'src', 'generated', 'prisma'));
const prisma = new PrismaClient();

const DRY = process.argv.includes('--dry-run');
const host = process.env.DATABASE_URL.match(/@([^/]*)\//)[1];
const branch = host.includes('bold-meadow')
  ? 'PRODUCTION'
  : host.includes('patient-boat')
    ? 'development'
    : host;

console.log(`branch : ${branch}`);
console.log(`host   : ${host}`);
console.log(`mode   : ${DRY ? 'DRY RUN — nothing will be written' : 'APPLY'}\n`);

/** The fields this script owns, and the value the code now expects. */
const TARGETS = [
  { block: 'ui', key: 'alternatingRows', want: false, why: 'K-2 — no row stripes' },
  { block: 'sorting', key: 'multiSort', want: true, why: 'K-4b — the Sort panel needs it' },
];

const tables = await prisma.table.findMany({ select: { id: true, name: true, settings: true } });
console.log(`tables: ${tables.length}`);

const needing = tables.filter((t) =>
  TARGETS.some((tg) => t.settings?.[tg.block]?.[tg.key] !== tg.want),
);
for (const tg of TARGETS) {
  const n = tables.filter((t) => t.settings?.[tg.block]?.[tg.key] !== tg.want).length;
  console.log(`  ${tg.block}.${tg.key} -> ${tg.want}   needs changing on ${n}   (${tg.why})`);
}
console.log(`\nrows to touch: ${needing.length}`);

if (DRY) {
  console.log('\n--dry-run: nothing written');
  await prisma.$disconnect();
  process.exit(0);
}

let done = 0;
for (const t of needing) {
  /*
    Spread every level explicitly. A shallow `{...settings, ui:{alternatingRows:false}}`
    would DELETE density, showBorders and stickyHeader from the blob — the same trap
    `resolveTableSettings` guards against on the read side.
  */
  const next = { ...t.settings };
  for (const tg of TARGETS) {
    next[tg.block] = { ...(next[tg.block] ?? {}), [tg.key]: tg.want };
  }
  await prisma.table.update({ where: { id: t.id }, data: { settings: next } });
  done++;
}
console.log(`updated: ${done}`);

// ── Verify: the targets changed, and NOTHING else did ──────────────────────────────────
const after = await prisma.table.findMany({ select: { settings: true } });
const paths = new Map();
const flat = (o, p = '') => {
  for (const [k, v] of Object.entries(o ?? {})) {
    const key = p ? `${p}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key);
    else {
      if (!paths.has(key)) paths.set(key, new Set());
      paths.get(key).add(JSON.stringify(v));
    }
  }
};
for (const t of after) flat(t.settings);

console.log('\nafter:');
let diverged = 0;
for (const [p, vs] of [...paths].sort()) {
  if (vs.size !== 1) {
    console.log(`  ⚠️ ${p}: ${vs.size} distinct — ${[...vs].join(' ')}`);
    diverged++;
  }
}
for (const tg of TARGETS) {
  console.log(`  ${`${tg.block}.${tg.key}`.padEnd(22)} = ${[...(paths.get(`${tg.block}.${tg.key}`) ?? [])].join()}`);
}
console.log(`  ${'settings paths total'.padEnd(22)} = ${paths.size}   (expected 20 — a drop means keys were lost)`);
console.log(diverged === 0 ? '  all fields uniform ✓' : `  ⚠️ ${diverged} path(s) diverged`);

await prisma.$disconnect();

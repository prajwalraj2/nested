/**
 * Which domains and pages use a given icon?
 * ============================================================================
 *
 *     node scripts/find-icon-usage.mjs youtube
 *     node scripts/find-icon-usage.mjs            (lists every icon with a count)
 *
 * Needed because replacing an icon's ARTWORK means adding a new file and re-pointing the rows
 * that used the old one — and there is no screen in the admin that answers "who uses this?".
 * Without this you would open all 41 domains and 1,216 pages to find four of them.
 *
 * READ-ONLY. It never writes to the database.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = process.cwd();

// Load .env by hand — this is a plain node script, not Next.js, so nothing loads it for us.
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const require = createRequire(pathToFileURL(path.join(ROOT, 'package.json')).href);
const { PrismaClient } = require(path.join(ROOT, 'src', 'generated', 'prisma'));
const prisma = new PrismaClient();

// Always say WHICH database this is. The same icon can have different usage on development and
// production, and acting on the wrong answer is how rows get missed.
console.log(`database: ${process.env.DATABASE_URL.match(/@([^/]*)\//)[1]}\n`);

const wanted = process.argv[2];

if (!wanted) {
  // No argument: summarise every icon actually in use, most-used first.
  const domains = await prisma.domain.findMany({ where: { icon: { not: null } }, select: { icon: true } });
  const pages = await prisma.page.findMany({ where: { icon: { not: null } }, select: { icon: true } });

  const counts = new Map();
  for (const r of [...domains, ...pages]) counts.set(r.icon, (counts.get(r.icon) ?? 0) + 1);

  if (counts.size === 0) {
    console.log('No domain or page has an icon set yet.');
  } else {
    console.log('icon                          uses');
    console.log('----------------------------  ----');
    for (const [icon, n] of [...counts].sort((a, b) => b[1] - a[1])) {
      console.log(`${icon.padEnd(28)}  ${n}`);
    }
  }

  // Files on disk that nothing points at — safe to delete, and worth knowing about.
  const onDisk = fs.readdirSync(path.join(ROOT, 'public', 'icons'))
    .filter((f) => f.endsWith('.svg'))
    .map((f) => f.replace(/\.svg$/, ''));
  const unused = onDisk.filter((id) => !counts.has(id));
  console.log(`\nin public/icons/ but unused: ${unused.length ? unused.join(', ') : 'none'}`);

  await prisma.$disconnect();
  process.exit(0);
}

// An icon id was given: list every row pointing at it.
const domains = await prisma.domain.findMany({
  where: { icon: wanted },
  select: { name: true, slug: true },
  orderBy: { name: 'asc' },
});

const pages = await prisma.page.findMany({
  where: { icon: wanted },
  select: { title: true, slug: true, domain: { select: { name: true, slug: true } } },
  orderBy: { title: 'asc' },
});

console.log(`icon "${wanted}" — ${domains.length} domain(s), ${pages.length} page(s)\n`);

if (domains.length) {
  console.log('DOMAINS  (edit at /admin/domains)');
  for (const d of domains) console.log(`  ${d.name}   /domain/${d.slug}`);
  console.log('');
}

if (pages.length) {
  console.log('PAGES  (edit at /admin/pages — pick the domain first)');
  for (const p of pages) console.log(`  ${p.title}   in ${p.domain.name}  (/${p.slug})`);
  console.log('');
}

if (!domains.length && !pages.length) {
  console.log('Nothing uses it. The file can be replaced or deleted freely.');
}

// Does the file even exist? A row can point at a deleted icon; the site then shows no icon.
const file = path.join(ROOT, 'public', 'icons', `${wanted}.svg`);
console.log(fs.existsSync(file)
  ? `file: public/icons/${wanted}.svg exists`
  : `⚠️  public/icons/${wanted}.svg DOES NOT EXIST — the rows above show no icon at all.`);

await prisma.$disconnect();

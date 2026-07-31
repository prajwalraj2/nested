import Link from 'next/link';
import { Globe, FileText, Table2, type LucideIcon } from 'lucide-react';

/**
 * Recent activity (Phase G-2).
 * ============================================================================
 *
 * ⚠️ THIS PANEL USED TO SHOW FABRICATED DATA.
 *
 * The previous version rendered a module-level `DEMO_ACTIVITIES` array — invented entries
 * with invented timestamps, presented identically to real records. A dashboard reading
 * "created YouTube Channel page in Graphic Designing — 30 minutes ago" when nothing of the
 * sort had happened is worse than an empty panel: this is the one part of the screen whose
 * entire job is to report what changed, and it was reporting fiction. Its own comment said
 * "replace with real data later".
 *
 * It now receives real rows, resolved by the page from `updatedAt` on `Domain`, `Page` and
 * `Table`. Those columns only exist because of #3/5b — before that migration this panel
 * could not have been built honestly, which is presumably why it was stubbed.
 *
 * ⚠️ `updatedAt` means "last touched", so a creation and an edit are indistinguishable from
 * the column alone. The label therefore says **"Updated"** rather than guessing — claiming
 * "Created" for an edit would repeat the original sin in a subtler form.
 */

export type ActivityEntry = {
  id: string;
  kind: 'domain' | 'page' | 'table';
  title: string;
  /** Secondary context, e.g. the domain a page belongs to. */
  context?: string | null;
  /** ISO string — serialised by the server component that fetched it. */
  timestamp: string;
  href: string;
};

type ActivityFeedProps = {
  activities: ActivityEntry[];
};

const KIND_ICON: Record<ActivityEntry['kind'], LucideIcon> = {
  domain: Globe,
  page: FileText,
  table: Table2,
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No recent changes.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {activities.map(entry => {
        const Icon = KIND_ICON[entry.kind];
        return (
          <li key={`${entry.kind}-${entry.id}`} className="flex items-start gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
              <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              {/* Every entry links to the thing it describes — the old demo rows led nowhere. */}
              <Link
                href={entry.href}
                className="block truncate text-sm font-medium text-foreground hover:underline"
              >
                {entry.title}
              </Link>
              <p className="truncate text-xs text-muted-foreground">
                Updated {formatRelativeTime(entry.timestamp)}
                {entry.context ? ` · ${entry.context}` : ''}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * "2 hours ago" style formatting.
 *
 * ⚠️ Runs on the SERVER, so it is computed once at render rather than ticking. Fine for a
 * dashboard — but a page left open will show an increasingly stale "2 minutes ago". Worth
 * knowing before reusing this elsewhere.
 */
function formatRelativeTime(timestamp: string): string {
  const then = new Date(timestamp).getTime();
  if (Number.isNaN(then)) return 'recently';

  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;

  return new Date(then).toLocaleDateString();
}

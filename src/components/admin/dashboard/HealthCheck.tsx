import Link from 'next/link';
import { CheckCircle2, AlertTriangle, XCircle, Info, ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * System health panel (Phase G-2).
 * ============================================================================
 *
 * The check LOGIC below is unchanged — publishing status, content coverage, content
 * volume. Three things about how it was *presented* were wrong, and are fixed here:
 *
 *   1. ⚠️ **"System Operational" was hardcoded.** A green "All core systems are running
 *      smoothly" banner rendered unconditionally, directly above a list that could be
 *      showing errors. The panel could simultaneously claim everything was fine and that
 *      content coverage was critically low. The banner is now DERIVED from the worst item.
 *
 *   2. ⚠️ **The "Quick Fixes" buttons did nothing.** They were `<button>` elements with no
 *      `onClick` and no link — the same dead-control pattern as #22.5. Each action string
 *      already implied a destination ("Review unpublished domains →"), so they are now
 *      real links to the screen that fixes the problem.
 *
 *   3. **"Performance Optimal"** was a hardcoded success row measuring nothing. Reporting
 *      health you have not checked is worse than reporting none, because it trains the
 *      reader to ignore the panel. Removed.
 */

type HealthStatus = 'success' | 'warning' | 'error' | 'info';

type HealthItem = {
  status: HealthStatus;
  title: string;
  description: string;
  /** Where to go to fix it. Renders as a link only when present. */
  action?: { label: string; href: string };
};

type HealthCheckProps = {
  stats: {
    totalDomains: number;
    unpublishedDomains: number;
    totalPages: number;
    pagesWithContent: number;
    pagesWithoutContent: number;
    totalContentBlocks: number;
  };
};

/** Icon and tint per status. Tokens where possible; the semantic hues are intentional. */
const STATUS_STYLE: Record<HealthStatus, { icon: LucideIcon; className: string }> = {
  // `dark:` variants because these are the one place a fixed hue is meaningful — a
  // warning must read as a warning in both themes, and the 600/400 pair is the same
  // approach DataTable already uses for its status colours.
  success: { icon: CheckCircle2, className: 'text-green-600 dark:text-green-400' },
  warning: { icon: AlertTriangle, className: 'text-amber-600 dark:text-amber-400' },
  error: { icon: XCircle, className: 'text-red-600 dark:text-red-400' },
  info: { icon: Info, className: 'text-blue-600 dark:text-blue-400' },
};

export function HealthCheck({ stats }: HealthCheckProps) {
  const items = getHealthItems(stats);

  /**
   * Overall status = the worst individual status. Derived, never asserted.
   *
   * `error` outranks `warning`, which outranks everything else. Without this the summary
   * and the detail could disagree, which is exactly what the old hardcoded banner did.
   */
  const worst: HealthStatus = items.some(i => i.status === 'error')
    ? 'error'
    : items.some(i => i.status === 'warning')
      ? 'warning'
      : 'success';

  const summary = {
    success: { title: 'All checks passing', description: 'No issues need attention.' },
    warning: { title: 'Needs attention', description: 'Some checks reported warnings.' },
    error: { title: 'Action required', description: 'One or more checks failed.' },
    info: { title: 'Getting started', description: 'Add content to begin.' },
  }[worst];

  const SummaryIcon = STATUS_STYLE[worst].icon;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
        <SummaryIcon
          className={`mt-0.5 size-5 shrink-0 ${STATUS_STYLE[worst].className}`}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="font-medium text-foreground">{summary.title}</p>
          <p className="text-sm text-muted-foreground">{summary.description}</p>
        </div>
      </div>

      <ul className="space-y-3">
        {items.map((item, i) => {
          const { icon: Icon, className } = STATUS_STYLE[item.status];
          return (
            <li key={`${item.title}-${i}`} className="flex items-start gap-3">
              <Icon className={`mt-0.5 size-4 shrink-0 ${className}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
                {/* Now a real link — see note 2 at the top of this file. */}
                {item.action && (
                  <Link
                    href={item.action.href}
                    className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    {item.action.label}
                    <ArrowRight className="size-3" aria-hidden="true" />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Derive the health items from the dashboard statistics.
 *
 * Thresholds are unchanged from the original: 100% coverage is success, ≥80% is a warning,
 * below that is an error.
 */
function getHealthItems(stats: HealthCheckProps['stats']): HealthItem[] {
  const items: HealthItem[] = [];

  // --- publishing ------------------------------------------------------------------
  if (stats.unpublishedDomains === 0) {
    items.push({
      status: 'success',
      title: 'All domains published',
      description: `${stats.totalDomains} domains are live and accessible.`,
    });
  } else {
    items.push({
      status: 'warning',
      title: `${stats.unpublishedDomains} unpublished domain${stats.unpublishedDomains !== 1 ? 's' : ''}`,
      description: 'Some domains are not yet visible to visitors.',
      action: { label: 'Review domains', href: '/admin/domains' },
    });
  }

  // --- content coverage --------------------------------------------------------------
  const coverage =
    stats.totalPages > 0 ? Math.round((stats.pagesWithContent / stats.totalPages) * 100) : 100;

  if (coverage === 100) {
    items.push({
      status: 'success',
      title: 'All pages have content',
      description: 'Every page has content assigned.',
    });
  } else if (coverage >= 80) {
    items.push({
      status: 'warning',
      title: `${coverage}% content complete`,
      description: `${stats.pagesWithoutContent} page${stats.pagesWithoutContent !== 1 ? 's' : ''} need content.`,
      action: { label: 'Add content', href: '/admin/pages' },
    });
  } else {
    items.push({
      status: 'error',
      title: 'Low content coverage',
      description: `${stats.pagesWithoutContent} pages are missing content.`,
      action: { label: 'Review pages', href: '/admin/pages' },
    });
  }

  // --- content volume ----------------------------------------------------------------
  if (stats.totalContentBlocks === 0) {
    items.push({
      status: 'info',
      title: 'No content blocks yet',
      description: 'Start adding content to bring your pages to life.',
      action: { label: 'Open rich text', href: '/admin/rich-text' },
    });
  } else if (stats.totalContentBlocks < 10) {
    items.push({
      status: 'info',
      title: 'Building content',
      description: `${stats.totalContentBlocks} content blocks created so far.`,
    });
  } else {
    items.push({
      status: 'success',
      title: 'Rich content system',
      description: `${stats.totalContentBlocks} content blocks across your pages.`,
    });
  }

  return items;
}

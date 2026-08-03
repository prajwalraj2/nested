import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * A single dashboard metric (Phase G-2).
 * ============================================================================
 *
 * Rebuilt on shadcn `Card`. The previous version was a hand-rolled
 * `bg-white rounded-lg border border-gray-200 p-6` — a fixed light surface that could not
 * follow the theme shipped in #21, with 11 hardcoded colour classes in 69 lines.
 *
 * ⚠️ `icon` is now a lucide COMPONENT, not an emoji string. Emoji cannot inherit
 * `currentColor`, so they ignored the theme entirely — the same reason the sidebar icons
 * were replaced in G-1. Typing it as `LucideIcon` also makes an invalid icon a compile
 * error rather than a character that silently renders as a box on some platforms.
 */
type StatsCardProps = {
  title: string;
  /**
   * Widened from `number` in G-5b: the table editor shows a "Last updated" date, which is
   * already formatted by the time it reaches here. Numbers still get thousands separators
   * (see the render), strings are printed verbatim.
   */
  value: number | string;
  icon: LucideIcon;
  /** Secondary context, e.g. "34 published". */
  description: string;
  /** Growth indicator such as "+12%". `null` renders no badge at all. */
  trend?: string | null;
};

export function StatsCard({ title, value, icon: Icon, description, trend }: StatsCardProps) {
  /**
   * Direction drives the badge colour. Read from the leading character rather than parsing
   * a number, because the value arrives pre-formatted as a string ("+12%", "0%").
   *
   * `default` / `destructive` / `secondary` are shadcn's own variants, so they carry the
   * theme's semantic colours instead of the old hardcoded `bg-green-100 text-green-700`.
   */
  const trendVariant = trend?.startsWith('+')
    ? 'default'
    : trend?.startsWith('-')
      ? 'destructive'
      : 'secondary';

  return (
    <Card>
      {/*
        Title row: label left, icon right. That is the conventional stat-tile arrangement —
        the eye lands on the number first, and the icon acts as a quiet identifier rather
        than competing with it. The old version put a 2xl emoji *before* the title, which
        made the icon the loudest thing in the card.
      */}
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          {/* `toLocaleString` so 1197 reads as 1,197 — kept from the original. */}
          <span className="text-2xl font-bold text-foreground">
            {/*
              `toLocaleString()` only for numbers — it groups thousands (1198 → "1,198"),
              which is the point. Calling it on a string is a no-op that would quietly
              suggest formatting is happening when it is not.
            */}
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
          {trend && (
            <Badge variant={trendVariant} className="text-xs">
              {trend}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

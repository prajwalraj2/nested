import {
  Image as ImageIcon,
  LayoutDashboard,
  FolderTree,
  Globe,
  FileText,
  Columns3,
  Table2,
  FileType2,
  // ⚠️ Also used for `roadmap` in PageTree's CONTENT_TYPE_ICONS and SectionEditor's
  // PageTypeIcon — one content type, one glyph, wherever it appears in the admin.
  Route,
  // ⚠️ Public product board — a list of things in flight.
  ClipboardList,
  // ⚠️ Matches the public header's Submit button, so the screen that reviews
  // submissions is recognisably about the same thing as the one that creates them.
  Inbox,
  // ⚠️ The same glyph the public header uses for the Feedback link, so the two screens that
  // concern the same queue are recognisably about the same thing.
  MessageSquare,
  Users,
  type LucideIcon,
} from 'lucide-react'

/**
 * Admin navigation — the single source of truth for the sidebar AND the breadcrumb.
 * ============================================================================
 *
 * WHY ONE FILE FOR BOTH (Phase G-1)
 * ---------------------------------
 * Before this, the sidebar held a `NAVIGATION_ITEMS` array and `AdminHeader` held a
 * separate `PAGE_INFO` map — two hand-maintained lists of the same routes. They had
 * already drifted: `PAGE_INFO` still described `/admin/editor` ("Content › Editor"), a
 * route that does not exist, and its breadcrumbs claimed a middle segment
 * ("Structure", "Content", "System") that is a sidebar *grouping*, not a URL segment,
 * so the trail implied a page you cannot navigate to.
 *
 * Deriving both from this one list means adding a screen updates the nav and the
 * breadcrumb together, and a route that does not exist cannot be described.
 *
 * ⚠️ ICONS ARE lucide, NOT EMOJI. The old nav used 📊 📂 🌐 — those render differently on
 * every OS, cannot inherit `currentColor`, and so ignore the theme entirely. That last
 * point matters now that #21 shipped dark mode.
 */

export type AdminNavItem = {
  /** Exact route. Also the key used to match the active item. */
  href: string
  label: string
  icon: LucideIcon
  /** Shown as a tooltip when the sidebar is collapsed to its icon rail. */
  description: string
}

export type AdminNavGroup = {
  /** `null` renders the items with no group heading — used for Dashboard alone. */
  label: string | null
  items: AdminNavItem[]
}

/**
 * ⚠️ "Add New Admin" (`/admin/users/new`) is deliberately NOT here.
 *
 * It was the one nav entry that is an **action** rather than a **place**. Creating a user
 * belongs on the Users screen, next to the list of users that already exist — which is
 * also where you would look to check whether the person is already an admin. It returns
 * as a button in G-8.
 */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: null,
    items: [
      {
        href: '/admin',
        label: 'Dashboard',
        icon: LayoutDashboard,
        description: 'Overview and statistics',
      },
    ],
  },
  {
    label: 'Structure',
    items: [
      {
        href: '/admin/categories',
        label: 'Categories',
        icon: FolderTree,
        description: 'Manage domain categories',
      },
      {
        href: '/admin/domains',
        label: 'Domains',
        icon: Globe,
        description: 'Manage domains',
      },
      {
        href: '/admin/pages',
        label: 'Pages',
        icon: FileText,
        description: 'Manage page hierarchy',
      },
    ],
  },
  {
    label: 'Content',
    items: [
      {
        href: '/admin/sections',
        label: 'Section Layout',
        icon: Columns3,
        description: 'Configure page sections',
      },
      {
        href: '/admin/tables',
        label: 'Tables',
        icon: Table2,
        description: 'Manage data tables',
      },
      {
        href: '/admin/rich-text',
        label: 'Rich Text',
        icon: FileType2,
        description: 'Create and edit rich content',
      },
      {
        /*
          ⚠️ Content, not System — the OPPOSITE call to Images, deliberately.

          Images live under System because one image is referenced by rows across many tables in
          many domains: a shared resource whose main screen exists for maintenance. A roadmap is
          the content OF exactly one page. Filing it under System would imply it floats free of
          the page tree, which is precisely the misunderstanding 33.2(a) exists to prevent.
        */
        href: '/admin/roadmaps',
        label: 'Roadmaps',
        icon: Route,
        description: 'Build step-by-step learning paths',
      },
      {
        /*
          ⚠️ Content, not System — the opposite call to Submissions and Feedback, deliberately.

          Those two are queues of things OTHER PEOPLE sent, worked through and cleared. The
          changelog is a public page WE author, card by card, exactly like Rich Text and Roadmaps.
          What it describes happens to be work rather than a subject, but the act is the same one.
        */
        href: '/admin/changelog',
        label: 'Changelog',
        icon: ClipboardList,
        description: 'The public product board',
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        /*
          ⚠️ System, not Content. Images are a SHARED RESOURCE referenced by rows across many
          tables — one image serves rows in several domains — rather than content belonging to
          a page. Filing it under Content would imply it sits inside one, and the screen's main
          job (finding what nothing uses any more) is maintenance, not authoring.
        */
        href: '/admin/images',
        label: 'Images',
        icon: ImageIcon,
        description: 'Pictures used beside table rows',
      },
      {
        /*
          ⚠️ Sits directly above Feedback because the two are the same KIND of screen: a queue of
          things other people sent, worked through and cleared. Neither is content we author, which
          is what everything under the Content group has in common.
        */
        href: '/admin/submissions',
        label: 'Submissions',
        icon: Inbox,
        description: 'Tool suggestions and domain requests from visitors',
      },
      {
        /*
          ⚠️ System, not Content — and the distinction is the same one Images turns on. Everything
          under Content is something WE author. Feedback is a queue of things OTHER PEOPLE sent us:
          it is worked through and cleared, not written. Filing it beside Rich Text would imply it
          is a kind of page.
        */
        href: '/admin/feedback',
        label: 'Feedback',
        icon: MessageSquare,
        description: 'Bug reports and suggestions from visitors',
      },
      {
        href: '/admin/users',
        label: 'Admin Users',
        icon: Users,
        description: 'Manage admin accounts',
      },
    ],
  },
]

/** Flat view, for lookups that do not care about grouping. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV.flatMap(g => g.items)

/**
 * Is this nav item the one currently open?
 *
 * ⚠️ `/admin` must match EXACTLY. A `startsWith` test would mark Dashboard active on every
 * single admin route, since they all begin with `/admin` — which is what the old sidebar
 * avoided by special-casing it, and is easy to reintroduce when adding an item.
 *
 * Every other item uses a prefix match so detail routes keep their parent highlighted:
 * `/admin/tables/abc123` keeps **Tables** lit rather than leaving nothing selected.
 */
export function isAdminNavItemActive(href: string, pathname: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Build the breadcrumb trail for a pathname.
 *
 * @param pathname   e.g. `/admin/tables/abc123`
 * @param recordName optional resolved name for the final segment — so a detail page reads
 *                   `Admin › Tables › Logo Makers` instead of exposing a raw id. The old
 *                   header had no concept of this, so the table editor gave no indication
 *                   of which table you were in.
 *
 * ⚠️ The old `PAGE_INFO` breadcrumbs inserted the sidebar's group name as a middle crumb
 * ("Admin › Content › Tables"). That reads like a page and is not one — there is no
 * `/admin/content` route — so it is dropped here. Crumbs map to real routes only.
 */
export function buildAdminBreadcrumb(
  pathname: string,
  recordName?: string | null
): Array<{ label: string; href: string | null }> {
  const crumbs: Array<{ label: string; href: string | null }> = [
    { label: 'Admin', href: '/admin' },
  ]

  if (pathname === '/admin') {
    // Dashboard IS /admin — a second crumb pointing at the same URL would be noise.
    return [{ label: 'Admin', href: null }]
  }

  // The deepest nav item this route belongs to, e.g. /admin/tables for /admin/tables/new.
  const section = ADMIN_NAV_ITEMS
    .filter(i => i.href !== '/admin' && isAdminNavItemActive(i.href, pathname))
    .sort((a, b) => b.href.length - a.href.length)[0]

  if (!section) return crumbs

  const isSectionRoot = pathname === section.href
  crumbs.push({ label: section.label, href: isSectionRoot ? null : section.href })

  if (isSectionRoot) return crumbs

  // Anything beyond the section root: a known sub-route label, or the record's name.
  const rest = pathname.slice(section.href.length + 1)
  if (rest === 'new') {
    crumbs.push({ label: 'New', href: null })
  } else if (recordName) {
    crumbs.push({ label: recordName, href: null })
  } else {
    // Fall back to a readable label rather than printing a raw id. `edit/<id>` -> "Edit".
    const first = rest.split('/')[0]
    crumbs.push({ label: first === 'edit' ? 'Edit' : 'Details', href: null })
  }

  return crumbs
}

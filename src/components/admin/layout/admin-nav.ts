import {
  LayoutDashboard,
  FolderTree,
  Globe,
  FileText,
  Columns3,
  Table2,
  FileType2,
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
    ],
  },
  {
    label: 'System',
    items: [
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

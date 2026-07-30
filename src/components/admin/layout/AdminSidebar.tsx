'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ExternalLink, Settings, LogOut, ChevronsUpDown } from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import LogoutButton from '@/components/auth/LogoutButton';
import { ADMIN_NAV, isAdminNavItemActive } from './admin-nav';

/**
 * Admin sidebar — rebuilt on the shadcn sidebar primitive (Phase G-1).
 * ============================================================================
 *
 * WHAT THIS REPLACES
 * ------------------
 * A hand-rolled `<div className="w-64 bg-gray-900 text-white">`. Three structural
 * problems, not cosmetic ones (#21 Phase 2 / #22):
 *
 *   1. **Hardcoded dark.** `bg-gray-900 text-white` is a fixed theme — which is why the
 *      admin panel already looked half-dark next to `AdminLayout`'s `bg-gray-50` page.
 *      Now `bg-sidebar` / `text-sidebar-foreground`, both of which `globals.css` already
 *      defines for light AND dark.
 *   2. **No responsive handling at all.** Fixed `w-64`, no collapse, no mobile treatment.
 *      The primitive gives an icon rail on desktop and a `Sheet` drawer on mobile.
 *   3. **Nav duplicated with the header** — see the note in `admin-nav.ts`.
 *
 * This is a rewrite of markup, not of behaviour: the same destinations, the same
 * active-route logic, the same logout.
 *
 * ⚠️ `collapsible="icon"` requires every `SidebarMenuButton` to carry a `tooltip`, or the
 * collapsed rail becomes unlabelled icons with no way to tell them apart. The tooltip only
 * renders while collapsed, so it costs nothing when expanded.
 */
export function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const name = session?.user?.name || 'Admin';
  const email = session?.user?.email || '';
  // `?.[0]` rather than `charAt(0)` so an empty name cannot throw.
  const initial = (name?.[0] || 'A').toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {/*
              `size="lg"` matches the footer's user block, so header and footer read as a
              matched pair framing the nav. `asChild` makes the whole row one link.
            */}
            <SidebarMenuButton size="lg" asChild tooltip="ATNO Admin">
              <Link href="/admin">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Settings className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">ATNO Admin</span>
                  <span className="truncate text-xs opacity-70">Content Management</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {ADMIN_NAV.map((group, i) => (
          // Keyed by label; the one unlabelled group (Dashboard) falls back to its index.
          <SidebarGroup key={group.label ?? `group-${i}`}>
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(item => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      // Prefix match for everything except /admin — see admin-nav.ts.
                      isActive={isAdminNavItemActive(item.href, pathname)}
                      tooltip={item.description}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {/* Leaves the CMS for the live site — hence the external-link affordance. */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Open the public site">
              <Link href="/domain" target="_blank">
                <ExternalLink />
                <span>View site</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/*
            Theme toggle lives here, not in the header.

            It is a PREFERENCE, not a page action — grouping it with the user block leaves
            the header free for actions belonging to the page you are on. This is the same
            `ThemeToggle` shipped for the public site in #21 Phase 1, and its provider is
            mounted in the ROOT layout, so it already worked here; this only gives it a
            home in the admin shell.

            ⚠️ Hidden when collapsed rather than squeezed into the rail: it is a
            self-contained button with its own sizing and would not align with the
            icon-only rows around it.
          */}
          <SidebarMenuItem>
            <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 group-data-[collapsible=icon]:hidden">
              <span className="text-sm">Theme</span>
              <ThemeToggle />
            </div>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" tooltip={email || name}>
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">{initial}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{name}</span>
                    <span className="truncate text-xs opacity-70">{email}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56"
                // `side="top"` because this trigger sits at the very bottom of the
                // viewport — a menu opening downward would be clipped off-screen.
                side="top"
                align="start"
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="grid text-sm">
                    <span className="font-medium">{name}</span>
                    <span className="text-xs text-muted-foreground">{email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {/*
                  `disabled` with an explicit "Soon" — the pattern the old header already
                  used correctly, and the honest alternative to a placeholder that looks
                  like a working feature (#22.2's "Coming Soon" panels were the bad kind).
                */}
                <DropdownMenuItem disabled>
                  <Settings className="mr-2 size-4" />
                  Account settings
                  <span className="ml-auto text-xs opacity-60">Soon</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  {/* The same LogoutButton the old header used — behaviour unchanged. */}
                  <LogoutButton
                    variant="ghost"
                    className="w-full justify-start px-2 font-normal"
                  >
                    <LogOut className="mr-2 size-4" />
                    Sign out
                  </LogoutButton>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {/*
        The draggable edge that toggles collapse. Without it the only control is the header
        trigger, which is easy to miss — and on a wide editor screen collapsing is the whole
        reason the rail exists.
      */}
      <SidebarRail />
    </Sidebar>
  );
}

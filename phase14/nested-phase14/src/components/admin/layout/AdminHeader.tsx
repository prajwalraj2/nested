'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import LogoutButton from '@/components/auth/LogoutButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { User, Settings, LogOut } from 'lucide-react';

/**
 * Admin Header Component
 * 
 * Displays the top header bar with:
 * - Current page title and breadcrumbs
 * - Quick action buttons
 * - User info and settings (future)
 * 
 * The header adapts based on the current admin page
 */

// Map of routes to their display information for header & breadcrumbs
const PAGE_INFO: Record<string, { title: string; description: string; breadcrumbs: string[] }> = {
  '/admin': {
    title: 'Dashboard',
    description: 'Overview of your content management system',
    breadcrumbs: ['Admin', 'Dashboard']
  },
  '/admin/categories': {
    title: 'Domain Categories',
    description: 'Manage your domain categories and organization',
    breadcrumbs: ['Admin', 'Structure', 'Categories']
  },
  '/admin/domains': {
    title: 'Domains',
    description: 'Manage your content domains',
    breadcrumbs: ['Admin', 'Structure', 'Domains']
  },
  '/admin/pages': {
    title: 'Pages',
    description: 'Manage your page hierarchy and structure', 
    breadcrumbs: ['Admin', 'Structure', 'Pages']
  },
  '/admin/content': {
    title: 'Content Editor',
    description: 'Edit and manage your page content',
    breadcrumbs: ['Admin', 'Content', 'Editor']
  },
  '/admin/sections': {
    title: 'Section Layout',
    description: 'Configure page sections and layout',
    breadcrumbs: ['Admin', 'Content', 'Sections']
  },
  '/admin/tables': {
    title: 'Tables',
    description: 'Manage data tables and schemas',
    breadcrumbs: ['Admin', 'Content', 'Tables']
  },
  '/admin/rich-text': {
    title: 'Rich Text',
    description: 'Create and edit rich content',
    breadcrumbs: ['Admin', 'Content', 'Rich Text']
  },
  '/admin/users': {
    title: 'User Management',
    description: 'Manage admin users and permissions',
    breadcrumbs: ['Admin', 'System', 'Users']
  },
  '/admin/users/new': {
    title: 'Create New User',
    description: 'Add a new administrator account',
    breadcrumbs: ['Admin', 'System', 'Users', 'New']
  }
};

export function AdminHeader() {
  // Get current pathname to determine page info
  const pathname = usePathname();
  const { data: session } = useSession();
  
  // Get page information or fallback to default
  const pageInfo = PAGE_INFO[pathname] || {
    title: 'Admin',
    description: 'Content Management System',
    breadcrumbs: ['Admin']
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        
        {/* Left side: Page title and breadcrumbs */}
        <div className="flex-1">
          
          {/* Breadcrumb navigation */}
          <nav className="text-sm text-gray-500 mb-1">
            {pageInfo.breadcrumbs.map((crumb, index) => (
              <span key={crumb}>
                {index > 0 && <span className="mx-2">›</span>}
                <span className={index === pageInfo.breadcrumbs.length - 1 ? 'text-gray-900 font-medium' : ''}>
                  {crumb}
                </span>
              </span>
            ))}
          </nav>
          
          {/* Page title and description */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {pageInfo.title}
            </h1>
            <p className="text-gray-600 mt-1">
              {pageInfo.description}
            </p>
          </div>
          
        </div>

        {/* Right side: Actions and user info */}
        <div className="flex items-center space-x-4">
          
          {/* Quick actions - will vary by page */}
          <QuickActions pathname={pathname} />
          
          {/* User Info & Logout */}
          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2 h-10">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {session?.user?.name?.charAt(0)?.toUpperCase() || session?.user?.email?.charAt(0)?.toUpperCase() || 'A'}
                  </div>
                  <div className="text-left hidden md:block">
                    <div className="text-sm font-medium text-gray-900">
                      {session?.user?.name || 'Admin User'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {session?.user?.email}
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem disabled>
                  <User className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="font-medium">{session?.user?.name || 'Admin User'}</span>
                    <span className="text-xs text-gray-500">{session?.user?.email}</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <Settings className="mr-2 h-4 w-4" />
                  Account Settings
                  <span className="ml-auto text-xs text-gray-400">Soon</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <LogoutButton 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start cursor-pointer"
                    showIcon={true}
                  >
                    Sign Out
                  </LogoutButton>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
        </div>
        
      </div>
    </header>
  );
}

/**
 * Quick Actions Component
 * 
 * Displays contextual action buttons based on current page
 * Each admin page can have its own relevant quick actions
 */
type QuickActionsProps = {
  pathname: string;
};

function QuickActions({ pathname }: QuickActionsProps) {
  // Define quick actions for each page
  const getQuickActions = () => {
    switch (pathname) {
      case '/admin':
        return (
          <>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
              + New Domain
            </button>
            <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
              + New Page
            </button>
          </>
        );
        
      case '/admin/categories':
        return (
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
            + New Category
          </button>
        );
        
      case '/admin/domains':
        return (
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
            + New Domain
          </button>
        );
        
      case '/admin/pages':
        return (
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
            + New Page
          </button>
        );
        
      case '/admin/content':
        return (
          <>
            <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer">
              + Add Block
            </button>
            <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
              Preview
            </button>
          </>
        );
        
      case '/admin/users':
        return (
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
            + New Admin
          </button>
        );
        
      case '/admin/tables':
        return (
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
            + New Table
          </button>
        );
        
      case '/admin/rich-text':
        return (
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
            + New Content
          </button>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center space-x-3">
      {getQuickActions()}
    </div>
  );
}

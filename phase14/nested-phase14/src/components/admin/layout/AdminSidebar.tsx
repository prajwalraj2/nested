'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Admin Sidebar Navigation Component
 * 
 * Provides navigation menu for all admin sections:
 * - Dashboard (overview and stats)
 * - Structure Management (categories, domains, pages)  
 * - Content Management (content editing, future tools)
 * - System Settings (future features)
 * 
 * Features:
 * - Active page highlighting
 * - Grouped navigation sections
 * - Future-ready structure for new features
 */

// Navigation menu configuration
const NAVIGATION_ITEMS = [
  // Main dashboard
  {
    label: 'Dashboard',
    href: '/admin',
    icon: '📊',
    description: 'Overview and statistics'
  },
  
  // Structure management section  
  {
    label: 'Categories',
    href: '/admin/categories', 
    icon: '📂',
    description: 'Manage domain categories',
    section: 'structure'
  },
  {
    label: 'Domains',
    href: '/admin/domains',
    icon: '🌐', 
    description: 'Manage domains',
    section: 'structure'
  },
  {
    label: 'Pages',
    href: '/admin/pages',
    icon: '📄',
    description: 'Manage page hierarchy', 
    section: 'structure'
  },
  
  // Content management section
  {
    label: 'Section Layout',
    href: '/admin/sections',
    icon: '🎯',
    description: 'Configure page sections',
    section: 'content' 
  },
  {
    label: 'Tables',
    href: '/admin/tables',
    icon: '📊',
    description: 'Manage data tables',
    section: 'content' 
  },
  {
    label: 'Rich Text',
    href: '/admin/rich-text',
    icon: '📄',
    description: 'Create and edit rich content',
    section: 'content' 
  },
  
  // User management section
  {
    label: 'Admin Users',
    href: '/admin/users',
    icon: '👥',
    description: 'Manage admin accounts',
    section: 'system'
  },
  {
    label: 'Add New Admin',
    href: '/admin/users/new',
    icon: '➕',
    description: 'Create new admin user',
    section: 'system'
  },
  
  // Future features (commented out for now)
  // {
  //   label: 'Advanced Tables',
  //   href: '/admin/advanced-tables',
  //   icon: '📈',
  //   description: 'Advanced table analytics',
  //   section: 'content'
  // },
  // {
  //   label: 'Rich Text',
  //   href: '/admin/editor',
  //   icon: '✍️', 
  //   description: 'Lexical editor management',
  //   section: 'content'
  // },
];

export function AdminSidebar() {
  // Get current pathname to highlight active navigation item
  const pathname = usePathname();
  console.log("pathname", pathname);
  
  // Group navigation items by section for better organization
  const structureItems = NAVIGATION_ITEMS.filter(item => item.section === 'structure');
  const contentItems = NAVIGATION_ITEMS.filter(item => item.section === 'content'); 
  const systemItems = NAVIGATION_ITEMS.filter(item => item.section === 'system');
  const mainItems = NAVIGATION_ITEMS.filter(item => !item.section);

  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col">
      
      {/* Sidebar Header */}
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold text-white">
          ⚙️ Admin Panel
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Content Management System
        </p>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto p-4">
        
        {/* Main Dashboard */}
        <div className="mb-6">
          {mainItems.map((item) => (
            <NavigationLink 
              key={item.href}
              item={item} 
              isActive={pathname === item.href}
            />
          ))}
        </div>

        {/* Structure Management Section */}
        {structureItems.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Structure
            </h3>
            {structureItems.map((item) => (
              <NavigationLink
                key={item.href}
                item={item}
                isActive={pathname.startsWith(item.href)}
              />
            ))}
          </div>
        )}

        {/* Content Management Section */}
        {contentItems.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Content
            </h3>
            {contentItems.map((item) => (
              <NavigationLink
                key={item.href} 
                item={item}
                isActive={pathname.startsWith(item.href)}
              />
            ))}
          </div>
        )}

        {/* System Management Section */}
        {systemItems.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              User Management
            </h3>
            {systemItems.map((item) => (
              <NavigationLink
                key={item.href} 
                item={item}
                isActive={pathname.startsWith(item.href)}
              />
            ))}
          </div>
        )}

      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-gray-700">
        <Link 
          href="/domain"
          className="flex items-center text-sm text-gray-400 hover:text-white transition-colors"
        >
          <span className="mr-2">🔙</span>
          Back to Website
        </Link>
      </div>
      
    </div>
  );
}

/**
 * Individual Navigation Link Component
 * 
 * Renders a single navigation item with:
 * - Icon and label
 * - Active state styling
 * - Hover effects
 * - Accessibility attributes
 */
type NavigationLinkProps = {
  item: {
    label: string;
    href: string;
    icon: string;
    description: string;
  };
  isActive: boolean;
};

function NavigationLink({ item, isActive }: NavigationLinkProps) {
  return (
    <Link
      href={item.href}
      className={`
        flex items-center p-3 rounded-lg transition-colors mb-1
        ${isActive 
          ? 'bg-blue-600 text-white' 
          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
        }
      `}
      title={item.description}
    >
      <span className="text-lg mr-3">{item.icon}</span>
      <div>
        <div className="font-medium">{item.label}</div>
        {/* Show description on hover or when active for better UX */}
        <div className="text-xs opacity-75 mt-0.5">
          {item.description}
        </div>
      </div>
    </Link>
  );
}

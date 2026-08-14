import { ReactNode } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';

/**
 * Main Admin Layout Component
 * 
 * Provides the overall structure for admin pages:
 * - Left sidebar: Navigation menu
 * - Top header: Page title, user actions, breadcrumbs
 * - Main content area: Admin page content
 * 
 * Layout Structure:
 * ┌─────────────┬─────────────────────┐
 * │   Sidebar   │      Header         │
 * │             ├─────────────────────┤
 * │             │                     │
 * │   (Fixed)   │   Main Content      │
 * │             │   (Scrollable)      │
 * │             │                     │
 * └─────────────┴─────────────────────┘
 */

type AdminLayoutProps = {
  children: ReactNode;
};

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Layout Container */}
      <div className="flex h-screen">
        
        {/* Left Sidebar - Fixed width navigation */}
        <AdminSidebar />
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* Top Header - Fixed height */}
          <AdminHeader />
          
          {/* Page Content - Scrollable */}
          <main className="flex-1 overflow-y-auto bg-white">
            <div className="p-6">
              {children}
            </div>
          </main>
          
        </div>

        
      </div>
    </div>
  );
}

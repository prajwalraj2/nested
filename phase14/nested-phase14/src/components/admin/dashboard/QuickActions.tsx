import Link from 'next/link';

/**
 * Quick Actions Component
 * 
 * Provides easy access to common admin tasks from the dashboard.
 * Each action is a button/link that takes the user directly to
 * the relevant admin section for that task.
 * 
 * Actions include:
 * - Creating new domains, pages, categories
 * - Accessing content editor
 * - Viewing system reports
 */

// Define all available quick actions
const QUICK_ACTIONS = [
  {
    title: 'Create New Domain',
    description: 'Add a new content domain to your system',
    icon: '🌐',
    href: '/admin/domains',  // Will go to domain creation page
    color: 'blue',
    primary: true
  },
  {
    title: 'Create New Page',
    description: 'Add a new page to an existing domain',
    icon: '📄',
    href: '/admin/pages',    // Will go to page creation
    color: 'green'
  },
  {
    title: 'Manage Categories',
    description: 'Organize your domain categories',
    icon: '📂', 
    href: '/admin/categories',
    color: 'purple'
  },
  {
    title: 'Edit Content',
    description: 'Update content blocks on your pages',
    icon: '📝',
    href: '/admin/content',
    color: 'orange'
  },
  {
    title: 'View All Domains',
    description: 'Browse and manage all your domains',
    icon: '👁️',
    href: '/admin/domains',
    color: 'gray'
  },
  {
    title: 'System Overview',
    description: 'View detailed system statistics',
    icon: '📊',
    href: '/admin', // Stay on dashboard but scroll to stats
    color: 'indigo'
  }
];

export function QuickActions() {
  return (
    <div className="space-y-4">
      
      {/* Primary Action - Most important action prominently displayed */}
      {QUICK_ACTIONS.filter(action => action.primary).map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="block w-full p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <div className="flex items-center">
            <span className="text-2xl mr-3">{action.icon}</span>
            <div>
              <h4 className="font-semibold">{action.title}</h4>
              <p className="text-sm text-blue-100 mt-1">{action.description}</p>
            </div>
          </div>
        </Link>
      ))}

      {/* Secondary Actions - Grid of smaller action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
        {QUICK_ACTIONS.filter(action => !action.primary).map((action) => (
          <QuickActionButton key={action.href} action={action} />
        ))}
      </div>
      
    </div>
  );
}

/**
 * Individual Quick Action Button
 * 
 * Renders a single action button with appropriate styling
 * based on the action's color and importance.
 */
type QuickActionButtonProps = {
  action: {
    title: string;
    description: string;
    icon: string;
    href: string;
    color: string;
  };
};

function QuickActionButton({ action }: QuickActionButtonProps) {
  // Define color schemes for different action types
  const colorClasses = {
    blue: 'border-blue-200 text-blue-700 hover:bg-blue-50',
    green: 'border-green-200 text-green-700 hover:bg-green-50',
    purple: 'border-purple-200 text-purple-700 hover:bg-purple-50',
    orange: 'border-orange-200 text-orange-700 hover:bg-orange-50',
    gray: 'border-gray-200 text-gray-700 hover:bg-gray-50',
    indigo: 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'
  };

  const colorClass = colorClasses[action.color as keyof typeof colorClasses] || colorClasses.gray;

  return (
    <Link
      href={action.href}
      className={`
        block p-3 border rounded-lg transition-colors
        ${colorClass}
      `}
    >
      <div className="flex items-start">
        <span className="text-lg mr-2 mt-0.5">{action.icon}</span>
        <div>
          <h4 className="font-medium text-sm">{action.title}</h4>
          <p className="text-xs opacity-75 mt-1">{action.description}</p>
        </div>
      </div>
    </Link>
  );
}

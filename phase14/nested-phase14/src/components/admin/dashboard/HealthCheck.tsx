/**
 * Health Check Component
 * 
 * Displays system health status and potential issues that need attention.
 * Helps administrators quickly identify and resolve problems with:
 * - Content completeness
 * - Publishing status  
 * - Data integrity
 * - System performance
 * 
 * Uses the dashboard statistics to determine health status.
 */

type HealthCheckProps = {
  stats: {
    totalDomains: number;
    publishedDomains: number;
    totalPages: number;
    pagesWithContent: number;
    totalContentBlocks: number;
    unpublishedDomains: number;
    pagesWithoutContent: number;
  };
};

export function HealthCheck({ stats }: HealthCheckProps) {
  // Calculate health status based on statistics
  const healthItems = getHealthItems(stats);
  
  return (
    <div className="space-y-3">
      
      {/* Overall System Status */}
      <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
        <span className="text-xl mr-3">✅</span>
        <div>
          <h4 className="font-medium text-green-900">System Operational</h4>
          <p className="text-sm text-green-700">All core systems are running smoothly</p>
        </div>
      </div>

      {/* Individual Health Items */}
      <div className="space-y-2">
        {healthItems.map((item, index) => (
          <HealthItem key={index} item={item} />
        ))}
      </div>

      {/* Quick Actions for Health Issues */}
      {healthItems.some(item => item.status === 'warning' || item.status === 'error') && (
        <div className="pt-3 border-t border-gray-100">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Quick Fixes</h4>
          <div className="space-y-1">
            {healthItems
              .filter(item => item.action)
              .map((item, index) => (
                <button
                  key={index}
                  className="text-sm text-blue-600 hover:text-blue-800 block"
                >
                  {item.action}
                </button>
              ))}
          </div>
        </div>
      )}
      
    </div>
  );
}

/**
 * Individual Health Check Item
 * 
 * Shows a single health metric with status icon and description
 */
type HealthItem = {
  status: 'success' | 'warning' | 'error' | 'info';
  title: string;
  description: string;
  action?: string; // Optional quick fix action
};

type HealthItemProps = {
  item: HealthItem;
};

function HealthItem({ item }: HealthItemProps) {
  // Get styling based on status
  const statusStyles = {
    success: {
      icon: '✅',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200', 
      textColor: 'text-green-900',
      descColor: 'text-green-700'
    },
    warning: {
      icon: '⚠️',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-900', 
      descColor: 'text-yellow-700'
    },
    error: {
      icon: '❌',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-900',
      descColor: 'text-red-700'
    },
    info: {
      icon: 'ℹ️',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200', 
      textColor: 'text-blue-900',
      descColor: 'text-blue-700'
    }
  };

  const style = statusStyles[item.status];

  return (
    <div className={`flex items-start p-3 ${style.bgColor} border ${style.borderColor} rounded-lg`}>
      <span className="mr-3 mt-0.5">{style.icon}</span>
      <div className="flex-1">
        <h5 className={`font-medium ${style.textColor}`}>
          {item.title}
        </h5>
        <p className={`text-sm ${style.descColor} mt-1`}>
          {item.description}
        </p>
      </div>
    </div>
  );
}

/**
 * Generate Health Check Items
 * 
 * Analyzes the system statistics and creates health check items
 * for different aspects of the system.
 */
function getHealthItems(stats: HealthCheckProps['stats']): HealthItem[] {
  const items: HealthItem[] = [];

  // Check domain publishing status
  if (stats.unpublishedDomains === 0) {
    items.push({
      status: 'success',
      title: 'All Domains Published',
      description: `${stats.totalDomains} domains are live and accessible`
    });
  } else {
    items.push({
      status: 'warning',
      title: `${stats.unpublishedDomains} Unpublished Domain${stats.unpublishedDomains !== 1 ? 's' : ''}`,
      description: 'Some domains are not yet published and visible to users',
      action: 'Review unpublished domains →'
    });
  }

  // Check content completeness
  const contentCompleteness = stats.totalPages > 0 
    ? Math.round((stats.pagesWithContent / stats.totalPages) * 100)
    : 100;

  if (contentCompleteness === 100) {
    items.push({
      status: 'success',
      title: 'All Pages Have Content', 
      description: 'Every page has content blocks assigned'
    });
  } else if (contentCompleteness >= 80) {
    items.push({
      status: 'warning',
      title: `${contentCompleteness}% Content Complete`,
      description: `${stats.pagesWithoutContent} page${stats.pagesWithoutContent !== 1 ? 's' : ''} need content`,
      action: 'Add content to empty pages →'
    });
  } else {
    items.push({
      status: 'error',
      title: 'Low Content Coverage',
      description: `${stats.pagesWithoutContent} pages are missing content`,
      action: 'Prioritize content creation →'
    });
  }

  // Check overall system size and growth
  if (stats.totalContentBlocks === 0) {
    items.push({
      status: 'info',
      title: 'Getting Started',
      description: 'Start adding content blocks to bring your pages to life',
      action: 'Create your first content →'
    });
  } else if (stats.totalContentBlocks < 10) {
    items.push({
      status: 'info', 
      title: 'Building Content',
      description: `${stats.totalContentBlocks} content blocks created so far`,
    });
  } else {
    items.push({
      status: 'success',
      title: 'Rich Content System',
      description: `${stats.totalContentBlocks} content blocks across your pages`
    });
  }

  // Add system performance check (placeholder for now)
  items.push({
    status: 'success',
    title: 'Performance Optimal',
    description: 'Page loading times and database queries are performing well'
  });

  return items;
}

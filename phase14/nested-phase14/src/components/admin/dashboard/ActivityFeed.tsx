/**
 * Activity Feed Component
 * 
 * Displays recent system activity and changes.
 * For now, shows static demo data, but designed to be 
 * easily enhanced with real activity tracking later.
 * 
 * Future enhancements:
 * - Real database activity logging  
 * - User attribution (who made what changes)
 * - Timestamps and filtering
 * - Activity categories and icons
 */

// Demo activity data - replace with real data later
const DEMO_ACTIVITIES = [
  {
    id: 1,
    action: 'created',
    target: 'YouTube Channel page',
    domain: 'Graphic Designing',
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    icon: '📺',
    type: 'page'
  },
  {
    id: 2,
    action: 'updated',
    target: 'Web Development domain',
    domain: 'Web Development', 
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    icon: '🌐',
    type: 'domain'
  },
  {
    id: 3,
    action: 'added content to',
    target: 'Design Software page',
    domain: 'Graphic Designing',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago  
    icon: '📝',
    type: 'content'
  },
  {
    id: 4,
    action: 'published',
    target: 'UI/UX Designing domain',
    domain: 'UI/UX Designing',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    icon: '✅',
    type: 'domain'
  },
  {
    id: 5,
    action: 'created',
    target: 'Client Management page',
    domain: 'Graphic Designing', 
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
    icon: '📄',
    type: 'page'
  },
  {
    id: 6,
    action: 'organized',
    target: 'Skill Development category',
    domain: null, // Category actions don't belong to specific domains
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
    icon: '📂',
    type: 'category'
  }
];

export function ActivityFeed() {
  return (
    <div className="space-y-4">
      
      {/* Activity List */}
      <div className="space-y-3">
        {DEMO_ACTIVITIES.slice(0, 8).map((activity) => (
          <ActivityItem key={activity.id} activity={activity} />
        ))}
      </div>

      {/* Show More Button */}
      <div className="pt-4 border-t border-gray-100">
        <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
          View All Activity →
        </button>
      </div>
      
    </div>
  );
}

/**
 * Individual Activity Item
 * 
 * Renders a single activity entry with:
 * - Icon representing the activity type
 * - Description of what happened
 * - Timestamp (relative format like "2 hours ago")
 * - Domain context if applicable
 */
type ActivityItemProps = {
  activity: {
    id: number;
    action: string;
    target: string;
    domain: string | null;
    timestamp: Date;
    icon: string;
    type: string;
  };
};

function ActivityItem({ activity }: ActivityItemProps) {
  return (
    <div className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
      
      {/* Activity Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <span className="text-lg">{activity.icon}</span>
      </div>

      {/* Activity Content */}
      <div className="flex-1 min-w-0">
        
        {/* Activity Description */}
        <p className="text-sm text-gray-900">
          <span className="font-medium capitalize">{activity.action}</span>
          {' '}
          <span className="text-blue-600 font-medium">{activity.target}</span>
          {activity.domain && (
            <span className="text-gray-600">
              {' in '} 
              <span className="font-medium">{activity.domain}</span>
            </span>
          )}
        </p>

        {/* Timestamp */}
        <p className="text-xs text-gray-500 mt-1">
          {formatRelativeTime(activity.timestamp)}
        </p>
        
      </div>

      {/* Activity Type Badge */}
      <div className="flex-shrink-0">
        <span className={`
          px-2 py-1 text-xs rounded-full font-medium
          ${getTypeBadgeColor(activity.type)}
        `}>
          {activity.type}
        </span>
      </div>
      
    </div>
  );
}

/**
 * Format timestamp as relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(timestamp: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - timestamp.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) {
    return 'Just now';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
  } else {
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
  }
}

/**
 * Get color classes for activity type badges
 */
function getTypeBadgeColor(type: string): string {
  const colorMap = {
    page: 'bg-blue-100 text-blue-700',
    domain: 'bg-green-100 text-green-700', 
    content: 'bg-orange-100 text-orange-700',
    category: 'bg-purple-100 text-purple-700'
  };
  
  return colorMap[type as keyof typeof colorMap] || 'bg-gray-100 text-gray-700';
}

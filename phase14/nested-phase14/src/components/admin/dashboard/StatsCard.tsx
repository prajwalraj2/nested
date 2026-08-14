/**
 * Statistics Card Component
 * 
 * Displays a key metric in a card format with:
 * - Large number value
 * - Descriptive title and icon  
 * - Additional context description
 * - Optional growth trend indicator
 * 
 * Used on dashboard to show system statistics like
 * total domains, pages, content blocks, etc.
 */

type StatsCardProps = {
  title: string;           // Main card title (e.g., "Total Domains")
  value: number;          // The main statistic number to display
  icon: string;           // Emoji icon for visual identification
  description: string;    // Additional context (e.g., "5 published")
  trend?: string | null;  // Growth trend (e.g., "+12%") - optional
};

export function StatsCard({ 
  title, 
  value, 
  icon, 
  description, 
  trend 
}: StatsCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      
      {/* Card Header: Icon and Title */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <span className="text-2xl mr-3">{icon}</span>
          <h3 className="font-medium text-gray-900">{title}</h3>
        </div>
        
        {/* Optional Growth Trend Badge */}
        {trend && (
          <span className={`
            px-2 py-1 text-xs rounded-full font-medium
            ${trend.startsWith('+') 
              ? 'bg-green-100 text-green-700' 
              : trend.startsWith('-')
              ? 'bg-red-100 text-red-700'
              : 'bg-gray-100 text-gray-700'
            }
          `}>
            {trend}
          </span>
        )}
      </div>

      {/* Main Value Display */}
      <div className="mb-2">
        <span className="text-3xl font-bold text-gray-900">
          {value.toLocaleString()}
        </span>
      </div>

      {/* Description/Context */}
      <p className="text-sm text-gray-600">
        {description}
      </p>
      
    </div>
  );
}

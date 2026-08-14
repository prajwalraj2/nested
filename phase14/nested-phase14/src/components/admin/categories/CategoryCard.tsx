'use client';

/**
 * Category Card Component
 * 
 * Displays an individual category in the admin interface with:
 * - Category icon, name, and domain count
 * - Status indicator (active/inactive)
 * - Management actions (edit, delete, move, reorder)
 * - Domain count and published status
 * - Drag handle for future reordering functionality
 * 
 * Designed to match the appearance of categories on the main site
 * while providing admin-specific controls
 */

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  columnPosition: number;
  categoryOrder: number;
  isActive: boolean;
  domainCount: number;
  publishedDomains: number;
};

type CategoryCardProps = {
  category: Category;
  position: number; // Position within the column (1, 2, 3...)
  onEdit: () => void;
  onDelete: () => void;
  onMove?: (direction: 'up' | 'down') => void; // For future reordering
};

export function CategoryCard({ 
  category, 
  position, 
  onEdit, 
  onDelete,
  onMove 
}: CategoryCardProps) {
  return (
    <div className={`
      relative bg-white border rounded-lg p-4 transition-all duration-200
      ${category.isActive 
        ? 'border-gray-200 hover:border-blue-300 hover:shadow-md' 
        : 'border-gray-200 bg-gray-50 opacity-75'
      }
    `}>
      
      {/* Status Badge */}
      <div className="absolute top-2 right-2">
        <StatusBadge isActive={category.isActive} />
      </div>

      {/* Drag Handle (Future Feature) */}
      <div className="absolute left-2 top-2 opacity-30 hover:opacity-60 cursor-grab">
        <span className="text-gray-400 text-sm">⋮⋮</span>
      </div>

      {/* Category Content */}
      <div className="pt-2 pl-4">
        
        {/* Category Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center">
            {/* Category Icon */}
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
              {category.icon ? (
                <span className="text-lg">{category.icon}</span>
              ) : (
                <span className="text-gray-400">📁</span>
              )}
            </div>
            
            {/* Category Info */}
            <div>
              <h4 className={`font-medium ${category.isActive ? 'text-gray-900' : 'text-gray-600'}`}>
                {category.name}
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                /{category.slug}
              </p>
            </div>
          </div>

          {/* Position Indicator */}
          <div className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
            #{position}
          </div>
        </div>

        {/* Domain Statistics */}
        <div className="mb-4">
          <DomainStats
            totalDomains={category.domainCount}
            publishedDomains={category.publishedDomains}
          />
        </div>

        {/* Description (if available) */}
        {category.description && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 line-clamp-2">
              {category.description}
            </p>
          </div>
        )}

        {/* Management Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          
          {/* Reorder Actions */}
          <div className="flex items-center space-x-1">
            {/* Move Up Button */}
            {position > 1 && onMove && (
              <button
                onClick={() => onMove('up')}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                title="Move up"
              >
                ↑
              </button>
            )}
            
            {/* Move Down Button */}
            {onMove && (
              <button
                onClick={() => onMove('down')}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                title="Move down"
              >
                ↓
              </button>
            )}
          </div>

          {/* Main Actions */}
          <div className="flex items-center space-x-2">
            
            {/* Edit Button */}
            <button
              onClick={onEdit}
              className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
              title="Edit category"
            >
              Edit
            </button>

            {/* Delete Button */}
            <button
              onClick={onDelete}
              className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
              title="Delete category"
            >
              Delete
            </button>

            {/* More Actions Dropdown (Future) */}
            <button
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
              title="More actions"
            >
              ⋯
            </button>
            
          </div>
        </div>
        
      </div>
    </div>
  );
}

/**
 * Status Badge Component
 * Shows active/inactive status with appropriate styling
 */
type StatusBadgeProps = {
  isActive: boolean;
};

function StatusBadge({ isActive }: StatusBadgeProps) {
  if (isActive) {
    return (
      <div className="flex items-center text-xs text-green-600">
        <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
        Active
      </div>
    );
  }

  return (
    <div className="flex items-center text-xs text-gray-500">
      <span className="w-2 h-2 bg-gray-400 rounded-full mr-1"></span>
      Inactive
    </div>
  );
}

/**
 * Domain Statistics Component
 * Shows domain count and published status
 */
type DomainStatsProps = {
  totalDomains: number;
  publishedDomains: number;
};

function DomainStats({ totalDomains, publishedDomains }: DomainStatsProps) {
  if (totalDomains === 0) {
    return (
      <div className="text-xs text-gray-500">
        <span className="inline-flex items-center">
          <span className="mr-1">📊</span>
          No domains assigned
        </span>
      </div>
    );
  }

  const unpublishedDomains = totalDomains - publishedDomains;

  return (
    <div className="flex items-center space-x-3 text-xs">
      
      {/* Total Domains */}
      <div className="flex items-center text-gray-600">
        <span className="mr-1">🌐</span>
        <span>{totalDomains} domain{totalDomains !== 1 ? 's' : ''}</span>
      </div>

      {/* Published Status */}
      {publishedDomains > 0 && (
        <div className="flex items-center text-green-600">
          <span className="mr-1">✅</span>
          <span>{publishedDomains} published</span>
        </div>
      )}

      {/* Unpublished Warning */}
      {unpublishedDomains > 0 && (
        <div className="flex items-center text-orange-600">
          <span className="mr-1">⚠️</span>
          <span>{unpublishedDomains} draft</span>
        </div>
      )}
      
    </div>
  );
}

'use client';
import { FolderOpen } from 'lucide-react';

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
  onEdit: () => void;
  onDelete: () => void;
};

/**
 * ⚠️ THREE PROPS AND CONTROLS REMOVED HERE. All of them promised things that did not exist.
 *
 * - **`position`** was the ARRAY INDEX of the card within its column, rendered as `#2`. It was
 *   not `categoryOrder`, which is the number that actually decides the layout — so "Other"
 *   displayed as **#2** while sitting on **row 4**. Now the real row is shown, because it is
 *   now an editable field and the card is where you read it back.
 *
 * - **`onMove`** with its ↑/↓ buttons: `CategoryList` never passed it, so `onMove &&` was
 *   always false and the buttons never rendered at all. Dead code behind a dead prop. The Row
 *   dropdown replaces the intent, and does it across columns rather than only within one.
 *
 * - **the `⋯` "More actions" button**: no `onClick`, no handler, nothing. It rendered, it was
 *   clickable, and it did nothing — the fourth instance of that pattern this phase.
 *
 * - **the `⋮⋮` drag handle**: `cursor-grab` and a hover state, on an element with no drag
 *   behaviour anywhere near it. Grepped again to be sure: no `draggable`, no `onDragStart`, no
 *   dnd library in the project. It advertised a feature that has never existed — the same lie
 *   the panel subtitle told until G-6a.
 */
export function CategoryCard({
  category,
  onEdit,
  onDelete
}: CategoryCardProps) {
  return (
    <div className={`
      relative bg-card border rounded-lg p-4 transition-all duration-200
      ${category.isActive 
        ? 'hover:border-muted-foreground/40 hover:shadow-md' 
        : 'bg-muted/50 opacity-75'
      }
    `}>
      
      {/* Status Badge */}
      <div className="absolute top-2 right-2">
        <StatusBadge isActive={category.isActive} />
      </div>

      {/* Category Content */}
      {/* `pl-4` dropped along with the drag handle it was reserving space for. */}
      <div className="pt-2">
        
        {/* Category Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center">
            {/* Category Icon */}
            <div className="shrink-0 w-10 h-10 bg-muted rounded-lg flex items-center justify-center mr-3">
              {category.icon ? (
                <span className="text-lg">{category.icon}</span>
              ) : (
                <FolderOpen className="text-muted-foreground size-4" aria-hidden="true" />
              )}
            </div>
            
            {/* Category Info */}
            <div>
              <h4 className={`font-medium ${category.isActive ? '' : 'text-muted-foreground'}`}>
                {category.name}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                /{category.slug}
              </p>
            </div>
          </div>

          {/*
            The REAL stored row, not the card's index in a list. This is the number the public
            page groups by, so it is the one worth surfacing — and now the one you can edit.
          */}
          <div className="text-xs text-muted-foreground bg-muted shrink-0 px-2 py-1 rounded">
            Row {category.categoryOrder}
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
            <p className="text-sm text-muted-foreground line-clamp-2">
              {category.description}
            </p>
          </div>
        )}

        {/* Management Actions — only the two that do something. */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t">
          <button
            onClick={onEdit}
            className="px-3 py-1 text-xs font-medium hover:bg-muted rounded transition-colors"
            title="Edit category"
          >
            Edit
          </button>

          <button
            onClick={onDelete}
            className="px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 rounded transition-colors"
            title="Delete category"
          >
            Delete
          </button>
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
      <div className="flex items-center text-xs text-muted-foreground">
        <span className="w-2 h-2 bg-primary rounded-full mr-1"></span>
        Active
      </div>
    );
  }

  return (
    <div className="flex items-center text-xs text-muted-foreground">
      <span className="w-2 h-2 bg-muted-foreground rounded-full mr-1"></span>
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
      <div className="text-xs text-muted-foreground">
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
      <div className="flex items-center text-muted-foreground">
        <span className="mr-1">🌐</span>
        <span>{totalDomains} domain{totalDomains !== 1 ? 's' : ''}</span>
      </div>

      {/* Published Status */}
      {publishedDomains > 0 && (
        <div className="flex items-center text-muted-foreground">
          <span className="mr-1">✅</span>
          <span>{publishedDomains} published</span>
        </div>
      )}

      {/* Unpublished Warning */}
      {unpublishedDomains > 0 && (
        <div className="flex items-center text-muted-foreground">
          <span className="mr-1">⚠️</span>
          <span>{unpublishedDomains} draft</span>
        </div>
      )}
      
    </div>
  );
}

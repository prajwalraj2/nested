// src/types/table.ts

/**
 * TypeScript definitions for the Table Management System
 * 
 * These types define the structure for:
 * - Table schemas (column definitions)
 * - Table data (row content)
 * - Table settings (configuration)
 * - CSV processing
 * - UI components
 */

// =============================================================================
// Core Table Types
// =============================================================================

export type ColumnType = 
  | 'text'        // Simple text
  | 'badge'       // Status badges with colors
  | 'link'        // Clickable links
  | 'description' // Long text with truncation
  | 'image'       // Images/logos
  | 'number'      // Formatted numbers
  | 'date'        // Formatted dates
  | 'email'       // Email addresses
  | 'phone'       // Phone numbers
  | 'currency'    // Currency values
  | 'rating'      // Star ratings
  | 'boolean';    // True/false values

export type TableColumn = {
  id: string;                    // "col_1", "col_2", etc.
  name: string;                  // "Product Name", "Status", etc.
  type: ColumnType;              // Column data type
  sortable: boolean;             // Can this column be sorted?
  filterable: boolean;           // Can this column be filtered?
  searchable: boolean;           // Is this column searchable?
  width?: number;                // Column width in pixels
  minWidth?: number;             // Minimum width
  maxWidth?: number;             // Maximum width
  align?: 'left' | 'center' | 'right';
  required?: boolean;            // Is this column required?
  defaultValue?: unknown;        // Default value for new rows
  validation?: ValidationRule[]; // Validation rules
  meta?: ColumnMeta;             // Additional column metadata
};

export type ColumnMeta = {
  // For badge columns
  badgeColors?: Record<string, string>; // { "success": "green", "error": "red" }
  
  // For link columns
  linkTemplate?: string;         // URL template: "https://example.com/{id}"
  openInNewTab?: boolean;
  
  /*
    ── Row images (K-5c) ────────────────────────────────────────────────────────
    ⚠️ An image is a COMPANION to a column, not a column of its own.

    §29.6(d): a dedicated image column would sit near-empty and need hiding on mobile, so the
    thumbnail renders INSIDE the name cell, before the text. `imageColumn` names the row field
    holding the image KEY — e.g. a "Channel Name" column with `imageColumn: 'logo'` renders
    `row.logo`'s picture beside the channel's name.

    The field holds a `TableImage.key`, never a URL. Reuse (1.68x measured) and provider
    portability both depend on that indirection — see the `TableImage` model.
  */
  /** Row field holding the image key, e.g. `"logo"`. Absent means this column has no image. */
  imageColumn?: string;
  /**
   * ⚠️ 1:1 only, on the user's instruction. `cover` (2:3, for book jackets) is implemented and
   * commented out in `DataTable` — enabling it forces taller rows, so shape and density are
   * coupled and it was deferred rather than merely unbuilt.
   */
  imageShape?: 'circle' | 'square';

  /*
    ── Row tags (N-3) ───────────────────────────────────────────────────────────
    ⚠️ A TAG IS A COMPANION TO A COLUMN, EXACTLY LIKE AN IMAGE — not a column of its own.

    The user expects 3–4 tagged rows per table, so a dedicated `Tags` column would be empty on
    ~90% of rows and need hiding on mobile: verbatim the argument §29.6(d) used to reject a
    dedicated image column. So the pill renders INSIDE the cell, above the image and text, and
    `tagField` names the row field holding the free text.
  */
  /** Row field holding the tag text, e.g. `"col_1__tag"`. Absent means this column has no tags. */
  tagField?: string;
  /**
   * Tag text -> a `BadgeColor` name.
   *
   * ⚠️ STORED, NOT COMPUTED, AND THAT IS THE WHOLE POINT. `assignBadgeColors` allocates by
   * SORTED POSITION among distinct values, so adding "Best Value" would silently push
   * "Recommended" to a different colour. Acceptable for a data badge; wrong for a repeated brand
   * signal that a reader learns to recognise. Same shape as `badgeColors` above, and
   * `resolveBadgeColor` already prefers a stored value over a computed one.
   *
   * ⚠️ A tag absent from this map renders `slate` — neutral, never unstyled — so tags work
   * before any colour has been chosen.
   */
  tagColors?: Record<string, string>;

  /** @deprecated Unused — `image` was declared as a column type and never rendered (#29.1). */
  imageSize?: 'small' | 'medium' | 'large';
  /** @deprecated Unused. A missing image renders nothing, never a placeholder. */
  fallbackImage?: string;
  
  // For number/currency columns
  format?: string;               // Number format
  currency?: string;             // Currency code (USD, EUR, etc.)
  
  // For date columns
  dateFormat?: string;           // Date display format
  showRelative?: boolean;        // Show "2 days ago" format
  
  // For description columns
  maxLength?: number;            // Max characters before truncation
  
  // For rating columns
  maxRating?: number;            // Max rating (default: 5)
  
  // For select/badge columns
  options?: Array<{
    value: string;
    label: string;
    color?: string;
  }>;
};

export type ValidationRule = {
  type: 'required' | 'min' | 'max' | 'pattern' | 'email' | 'url' | 'custom';
  value?: unknown;
  message: string;
};

export type TableSchema = {
  columns: TableColumn[];
  version: number;               // Schema version for migrations
  createdAt: string;
  updatedAt: string;
};

// =============================================================================
// Table Data Types
// =============================================================================

export type TableRow = {
  id: string;                    // Unique row identifier
  [columnId: string]: unknown;   // Dynamic column data
};

/**
 * Image key -> URL, for the keys a single table actually references (K-5c).
 *
 * ⚠️ Resolved SERVER-SIDE and sent with the table, rather than letting the browser look each
 * key up. A table with 40 rows would otherwise make 40 requests to translate names into URLs,
 * and the renderer would have to handle "not resolved yet" on every cell.
 *
 * Only the keys present in this table are included — not the whole library.
 */
export type TableImageMap = Record<string, string>;

export type TableData = {
  rows: TableRow[];
  metadata?: {
    totalRows: number;
    lastUpdated: string;
    importSource?: 'csv' | 'manual' | 'api';
    checksum?: string;           // Data integrity check
  };
};

// =============================================================================
// Table Settings Types
// =============================================================================

export type TableSettings = {
  pagination: {
    enabled: boolean;
    pageSize: number;              // 10, 25, 50, 100
    showSizeSelector: boolean;
    showInfo: boolean;             // Show "1-10 of 100 rows"
  };
  sorting: {
    enabled: boolean;
    defaultSort?: string;          // Column ID
    defaultDirection?: 'asc' | 'desc';
    multiSort: boolean;            // Allow multiple column sorting
  };
  filtering: {
    enabled: boolean;
    globalSearch: boolean;
    columnFilters: boolean;
    advancedFilters: boolean;      // Date ranges, number ranges, etc.
  };
  responsive: {
    enabled: boolean;
    breakpoint: 'sm' | 'md' | 'lg';
    stackColumns: boolean;
    hideColumns: string[];         // Columns to hide on mobile
  };
  export: {
    enabled: boolean;
    formats: ('csv' | 'json' | 'excel' | 'pdf')[];
  };
  ui: {
    density: 'compact' | 'normal' | 'comfortable';
    showBorders: boolean;
    alternatingRows: boolean;
    stickyHeader: boolean;
  };
};

// =============================================================================
// Database Model Types (from Prisma)
// =============================================================================

export type Table = {
  id: string;
  name: string;
  pageId: string;
  schema: TableSchema;
  data: TableData;
  settings?: TableSettings;
  createdAt: Date;
  updatedAt: Date;
};

export type TableWithPage = Table & {
  page: {
    id: string;
    title: string;
    slug: string;
    contentType: string;
    domain: {
      id: string;
      name: string;
      slug: string;
    };
  };
};

// =============================================================================
// CSV Processing Types
// =============================================================================

export type CSVParseResult = {
  success: boolean;
  data?: unknown[][];            // Raw CSV data
  headers?: string[];            // Column headers
  rowCount?: number;
  errors?: string[];
  warnings?: string[];
};

export type CSVValidationResult = {
  isValid: boolean;
  errors: Array<{
    row: number;
    column: string;
    message: string;
    value: unknown;
  }>;
  warnings: Array<{
    row: number;
    column: string;
    message: string;
    value: unknown;
  }>;
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    emptyRows: number;
  };
};

export type CSVImportPreview = {
  schema: TableSchema;
  data: TableData;
  validation: CSVValidationResult;
  mapping: Record<string, string>; // CSV header -> Column ID mapping
};

// =============================================================================
// UI Component Types
// =============================================================================

export type TableViewMode = 'table' | 'grid' | 'list';

export type SortingState = Array<{
  id: string;
  desc: boolean;
}>;

export type FilterState = {
  globalFilter: string;
  columnFilters: Array<{
    id: string;
    value: unknown;
  }>;
};

export type TableAction = {
  id: string;
  label: string;
  icon?: string;
  onClick: (rows: TableRow[]) => void;
  disabled?: boolean;
  bulk?: boolean;                // Can be applied to multiple rows
};

// =============================================================================
// Admin Interface Types
// =============================================================================

export type TableCreationStep = 'select-page' | 'define-schema' | 'upload-data' | 'preview' | 'complete';

export type TableCreationState = {
  step: TableCreationStep;
  selectedDomain?: {
    id: string;
    name: string;
    slug: string;
  };
  selectedPage?: {
    id: string;
    title: string;
    slug: string;
    contentType: string;
  };
  tableSchema?: TableSchema;
  tableData?: TableData;
  tableSettings?: TableSettings;
  csvFile?: File;
  errors: string[];
  isLoading: boolean;
};

// =============================================================================
// API Types
// =============================================================================

export type CreateTableRequest = {
  name: string;
  pageId: string;
  schema: TableSchema;
  data: TableData;
  settings?: TableSettings;
};

export type UpdateTableRequest = Partial<CreateTableRequest> & {
  id: string;
};

export type TableListResponse = {
  tables: TableWithPage[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters?: {
    domain?: string;
    search?: string;
  };
};

// =============================================================================
// Utility Types
// =============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type TableError = {
  code: string;
  message: string;
  field?: string;
  context?: unknown;
};

export type TableStats = {
  totalTables: number;
  totalRows: number;
  totalDomains: number;
  recentActivity: Array<{
    action: string;
    tableName: string;
    timestamp: string;
    user?: string;
  }>;
};

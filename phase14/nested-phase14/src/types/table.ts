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
  
  // For image columns
  imageSize?: 'small' | 'medium' | 'large';
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

// src/lib/table-utils.ts

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { 
  TableSchema, 
  TableColumn, 
  TableData, 
  TableRow, 
  ColumnType,
  TableSettings,
  ValidationRule
} from '@/types/table';
import { ALL_COUNTRIES } from '@/lib/countries';

/**
 * Utility Functions for Table Management System
 * 
 * This file contains helper functions for:
 * - Table schema operations
 * - Data validation and transformation
 * - CSV processing utilities
 * - Default configurations
 * - Type checking and validation
 */

// =============================================================================
// Styling Utilities
// =============================================================================

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// =============================================================================
// Default Configurations
// =============================================================================

export const DEFAULT_TABLE_SETTINGS: TableSettings = {
  pagination: {
    enabled: true,
    pageSize: 25,
    showSizeSelector: true,
    showInfo: true,
  },
  sorting: {
    enabled: true,
    /*
      ⚠️ WAS `false`, ON ALL 654 TABLES, AND WAS NEVER A DECISION (K-4b).

      Same situation as `ui.alternatingRows` in K-2: one distinct value across every table,
      stamped once at creation by `DEFAULT_TABLE_SETTINGS`, never edited because no screen
      writes it. K-2 proved the whole blob is boilerplate.

      Left as `false` it would have made the K-4b Sort panel single-rule — and a sort panel
      that cannot express "Pricing first, then Name inside it" is the header click with
      extra steps, since one-column sorting already works by clicking a header.

      The 654 stored rows were updated to match, for the same reason as K-2: a default only
      applies where a stored value is absent, so leaving `false` in the data would have
      disabled the feature regardless of what this line says.
    */
    multiSort: true,
  },
  filtering: {
    enabled: true,
    globalSearch: true,
    columnFilters: true,
    advancedFilters: false,
  },
  responsive: {
    enabled: true,
    breakpoint: 'md',
    stackColumns: false,
    hideColumns: [],
  },
  export: {
    /*
      ⚠️ LEFT `true` — AND AN EARLIER CLAIM OF MINE ABOUT THIS WAS WRONG.

      §29.2 recorded `src/lib/export-table.ts` as "71 lines, imported by nothing". It is
      not: `TableEditor` and `TablesManager` both import `downloadTableExport`. The audit
      grep excluded any line matching `lib/export-table`, which also excluded the very
      `from '@/lib/export-table'` lines it was looking for. **An exclusion pattern that
      matches the import path cannot find imports.**

      So export exists, in the admin, and works. The user's decision (#29.6f) is that it
      does not belong on **public** pages — which is already the case, because no public
      surface has ever rendered an export control.

      Flipping this to `false` would have been actively misleading: `TablePreview` renders
      it as an "Enabled / Disabled" badge in the creation wizard, while admin export runs
      unconditionally without consulting it. The badge would have claimed export was off
      while the button next to it kept working.
    */
    enabled: true,
    formats: ['csv', 'json'],
  },
  ui: {
    density: 'normal',
    showBorders: true,
    /*
      ⚠️ WAS `true`, AND HAD NEVER BEEN IMPLEMENTED (K-2).

      K-2 makes the renderer obey these settings, so leaving this `true` would have striped
      every row of all 654 tables — a site-wide visual change nobody asked for, justified by
      a value nobody chose.

      **The whole settings blob was boilerplate.** All 20 fields held exactly one distinct
      value across all 654 tables, written once at table creation and never edited, because
      no screen writes them. `export.enabled: true` sitting beside a decision NOT to have
      export is the clearest proof.

      Striping is implemented and works — set this `true` on a table and it stripes. The
      default is `false` because a single ground with hairline rules is what the tables
      already look like, and what Notion, the shadcn demo and Port all do.
    */
    alternatingRows: false,
    stickyHeader: true,
  },
};

/**
 * Merge a stored settings blob over the defaults (K-2).
 * ============================================================================
 *
 * ⚠️ WHY A HAND-WRITTEN MERGE AND NOT `{ ...DEFAULT, ...stored }`.
 *
 * A spread is SHALLOW. `TableSettings` is two levels deep, so spreading a stored blob that
 * happens to contain only `{ ui: { density: 'compact' } }` would replace the whole `ui`
 * object — silently dropping `showBorders` and `stickyHeader` to `undefined`, which read as
 * "off". A partial save in the K-6 editor would then turn features off that nobody touched.
 *
 * ⚠️ `??` throughout, NEVER `||`. Every field here is a boolean or a number, so `false` and
 * `0` are legitimate values. `stored.ui.showBorders || true` would make `false` impossible
 * to express — the same class of bug as #28, where `||` could not distinguish "no value"
 * from "deliberately null".
 */
export function resolveTableSettings(stored?: unknown): TableSettings {
  // Anything at all can be in a Json column; narrow before reaching into it.
  const s = (stored ?? {}) as Partial<TableSettings>;
  const d = DEFAULT_TABLE_SETTINGS;

  return {
    pagination: {
      enabled: s.pagination?.enabled ?? d.pagination.enabled,
      pageSize: s.pagination?.pageSize ?? d.pagination.pageSize,
      showSizeSelector: s.pagination?.showSizeSelector ?? d.pagination.showSizeSelector,
      showInfo: s.pagination?.showInfo ?? d.pagination.showInfo,
    },
    sorting: {
      enabled: s.sorting?.enabled ?? d.sorting.enabled,
      defaultSort: s.sorting?.defaultSort ?? d.sorting.defaultSort,
      defaultDirection: s.sorting?.defaultDirection ?? d.sorting.defaultDirection,
      multiSort: s.sorting?.multiSort ?? d.sorting.multiSort,
    },
    filtering: {
      enabled: s.filtering?.enabled ?? d.filtering.enabled,
      globalSearch: s.filtering?.globalSearch ?? d.filtering.globalSearch,
      columnFilters: s.filtering?.columnFilters ?? d.filtering.columnFilters,
      advancedFilters: s.filtering?.advancedFilters ?? d.filtering.advancedFilters,
    },
    responsive: {
      enabled: s.responsive?.enabled ?? d.responsive.enabled,
      breakpoint: s.responsive?.breakpoint ?? d.responsive.breakpoint,
      stackColumns: s.responsive?.stackColumns ?? d.responsive.stackColumns,
      hideColumns: s.responsive?.hideColumns ?? d.responsive.hideColumns,
    },
    export: {
      enabled: s.export?.enabled ?? d.export.enabled,
      formats: s.export?.formats ?? d.export.formats,
    },
    ui: {
      density: s.ui?.density ?? d.ui.density,
      showBorders: s.ui?.showBorders ?? d.ui.showBorders,
      alternatingRows: s.ui?.alternatingRows ?? d.ui.alternatingRows,
      stickyHeader: s.ui?.stickyHeader ?? d.ui.stickyHeader,
    },
  };
}

/**
 * Row padding per density (K-2, #29.5).
 *
 * ⚠️ THIS IS THE FIX FOR "SOME TABLES HAVE ROW HEIGHT VERY LESS".
 *
 * Row height was previously whatever the content made it: cells are `p-2`, so a plain-text
 * table sat near 36px while one containing a badge or the description popover ran taller.
 * It was never a per-table setting — **nothing controlled it at all**, while
 * `settings.ui.density` sat in the type and in every stored blob, unread.
 *
 * Padding rather than a fixed `height`: a fixed height clips content that does not fit,
 * whereas symmetric padding sets a floor and lets an unusually tall cell grow.
 */
export const DENSITY_ROW_PADDING: Record<TableSettings['ui']['density'], string> = {
  compact: 'py-1',      //  4px — dense scanning, ~28px rows
  normal: 'py-2.5',     // 10px — the default, ~40px rows
  comfortable: 'py-4',  // 16px — ~52px rows, and what image cells will want in K-5c
};

export const COLUMN_TYPE_OPTIONS: Array<{
  value: ColumnType;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    value: 'text',
    label: 'Text',
    description: 'Simple text content',
    icon: '📝',
  },
  {
    value: 'badge',
    label: 'Badge',
    description: 'Status badges with colors',
    icon: '🏷️',
  },
  {
    value: 'link',
    label: 'Link',
    description: 'Clickable links',
    icon: '🔗',
  },
  {
    value: 'description',
    label: 'Description',
    description: 'Long text with truncation',
    icon: '📄',
  },
  {
    value: 'number',
    label: 'Number',
    description: 'Formatted numbers',
    icon: '🔢',
  },
  {
    value: 'currency',
    label: 'Currency',
    description: 'Monetary values',
    icon: '💰',
  },
  {
    value: 'date',
    label: 'Date',
    description: 'Formatted dates',
    icon: '📅',
  },
  {
    value: 'email',
    label: 'Email',
    description: 'Email addresses',
    icon: '📧',
  },
  {
    value: 'image',
    label: 'Image',
    description: 'Images and logos',
    icon: '🖼️',
  },
  {
    value: 'boolean',
    label: 'Boolean',
    description: 'True/false values',
    icon: '☑️',
  },
];

// =============================================================================
// Schema Generation Utilities
// =============================================================================

export function generateColumnId(index: number): string {
  return `col_${index + 1}`;
}

export function createDefaultColumn(name: string, type: ColumnType = 'text'): TableColumn {
  return {
    id: generateColumnId(0), // Will be updated when added to schema
    name: name.trim(),
    type,
    sortable: true,
    filterable: true,
    searchable: type === 'text' || type === 'description' || type === 'email',
    required: false,
    align: type === 'number' || type === 'currency' ? 'right' : 'left',
    validation: [],
  };
}

export function createTableSchema(columns: Omit<TableColumn, 'id'>[]): TableSchema {
  return {
    columns: columns.map((col, index) => ({
      ...col,
      id: generateColumnId(index),
    })),
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// =============================================================================
// Data Validation Utilities
// =============================================================================

export function validateColumnValue(value: unknown, column: TableColumn): string[] {
  const errors: string[] = [];
  
  // Check required fields
  if (column.required && (value === null || value === undefined || value === '')) {
    errors.push(`${column.name} is required`);
    return errors; // Don't validate further if required field is empty
  }
  
  // Skip validation for empty optional fields
  if (!column.required && (value === null || value === undefined || value === '')) {
    return errors;
  }
  
  // Type-specific validation
  switch (column.type) {
    case 'email':
      if (typeof value === 'string' && !isValidEmail(value)) {
        errors.push(`${column.name} must be a valid email address`);
      }
      break;
      
    case 'number':
    case 'currency':
      if (isNaN(Number(value))) {
        errors.push(`${column.name} must be a valid number`);
      }
      break;
      
    case 'date':
      if (typeof value === 'string' && !isValidDate(value)) {
        errors.push(`${column.name} must be a valid date`);
      }
      break;
      
    case 'boolean':
      if (typeof value !== 'boolean' && !['true', 'false', '1', '0'].includes(String(value).toLowerCase())) {
        errors.push(`${column.name} must be a boolean value`);
      }
      break;
  }
  
  // Custom validation rules
  if (column.validation) {
    for (const rule of column.validation) {
      const error = validateRule(value, rule, column.name);
      if (error) {
        errors.push(error);
      }
    }
  }
  
  return errors;
}

function validateRule(value: unknown, rule: ValidationRule, fieldName: string): string | null {
  switch (rule.type) {
    case 'required':
      if (value === null || value === undefined || value === '') {
        return rule.message || `${fieldName} is required`;
      }
      break;
      
    case 'min':
      if (typeof rule.value === 'number') {
        if (typeof value === 'string' && value.length < rule.value) {
          return rule.message || `${fieldName} must be at least ${rule.value} characters`;
        }
        if (typeof value === 'number' && value < rule.value) {
          return rule.message || `${fieldName} must be at least ${rule.value}`;
        }
      }
      break;
      
    case 'max':
      if (typeof rule.value === 'number') {
        if (typeof value === 'string' && value.length > rule.value) {
          return rule.message || `${fieldName} must be no more than ${rule.value} characters`;
        }
        if (typeof value === 'number' && value > rule.value) {
          return rule.message || `${fieldName} must be no more than ${rule.value}`;
        }
      }
      break;
      
    case 'pattern':
      if (typeof rule.value === 'string' && typeof value === 'string' && !new RegExp(rule.value).test(value)) {
        return rule.message || `${fieldName} format is invalid`;
      }
      break;
      
    case 'email':
      if (typeof value === 'string' && !isValidEmail(value)) {
        return rule.message || `${fieldName} must be a valid email address`;
      }
      break;
      
    case 'url':
      if (typeof value === 'string' && !isValidUrl(value)) {
        return rule.message || `${fieldName} must be a valid URL`;
      }
      break;
  }
  
  return null;
}

// =============================================================================
// Data Transformation Utilities
// =============================================================================

/**
 * Everything a CSV column may be mapped onto (K-5c).
 * ============================================================================
 *
 * ⚠️ NOT JUST `schema.columns`. A row image lives in a field named by `meta.imageColumn`,
 * which is deliberately NOT a column — so a list of columns cannot express "put this CSV
 * column's values into the image field", and `transformCsvToTableData` would silently drop
 * a header mapped there.
 *
 * That is the same rebuild-by-field-list shape that has now bitten this project six times
 * (icon through five lists in Phase J, status in I-1, the row dialog in K-5c). Exporting one
 * list of targets means the import UI and the transform read from the same place and cannot
 * disagree about what exists.
 */
export type ImportTarget = {
  /** Row field to write into — a column id, or an image field name. */
  id: string;
  /** What the person choosing sees. */
  label: string;
  kind: 'column' | 'image';
};

export function getImportTargets(schema: TableSchema): ImportTarget[] {
  const targets: ImportTarget[] = [];

  for (const column of schema.columns) {
    targets.push({ id: column.id, label: `${column.name} (${column.type})`, kind: 'column' });

    // Immediately after its column, so the pair reads together in the dropdown.
    if (column.meta?.imageColumn) {
      targets.push({
        id: column.meta.imageColumn,
        // Says what to put in it. "Course Name image" alone would leave someone guessing
        // whether it wants a URL, a filename or a key.
        label: `${column.name} — image key`,
        kind: 'image',
      });
    }
  }

  return targets;
}

export function transformCsvToTableData(
  csvData: unknown[][],
  schema: TableSchema,
  headerMapping: Record<string, string>
): TableData {
  const [headers, ...rows] = csvData;

  /** Image fields are legitimate targets even though they are not columns — see above. */
  const imageFields = new Set(
    schema.columns
      .map(col => col.meta?.imageColumn)
      .filter((f): f is string => typeof f === 'string' && f.length > 0)
  );
  
  // Check if CSV has targetCountries column (case-insensitive)
  const targetCountriesHeaderIndex = headers.findIndex(header => 
    String(header).toLowerCase().replace(/\s/g, '') === 'targetcountries'
  );
  
  const transformedRows: TableRow[] = rows.map((row, index) => {
    const tableRow: TableRow = {
      id: `row_${index + 1}_${Date.now()}`,
    };
    
    /*
      Map CSV columns onto their targets.

      ⚠️ A target is not necessarily a COLUMN. Image fields are valid targets too, and the
      previous version looked every mapping up in `schema.columns` and skipped what it could
      not find — so a header mapped to an image field was discarded without a word.
    */
    headers.forEach((header, colIndex) => {
      const headerStr = String(header);
      const targetId = headerMapping[headerStr];
      if (!targetId || row[colIndex] === undefined) return;

      const column = schema.columns.find(col => col.id === targetId);
      if (column) {
        tableRow[targetId] = transformValue(row[colIndex], column.type);
        return;
      }

      if (imageFields.has(targetId)) {
        /*
          An image key is stored as a plain trimmed string — never passed through
          `transformValue`, which types by COLUMN and would have nothing to type this by.
          An empty cell writes an empty string rather than being skipped, so a CSV can
          deliberately clear an image the same way the picker's × does.
        */
        tableRow[targetId] = String(row[colIndex] ?? '').trim();
      }
    });
    
    // Handle targetCountries column
    // If CSV has targetCountries column, use its value
    if (targetCountriesHeaderIndex !== -1) {
      const targetCountriesValue = row[targetCountriesHeaderIndex];
      const valueStr = targetCountriesValue ? String(targetCountriesValue).trim() : '';
      tableRow[TARGET_COUNTRIES_COLUMN_ID] = valueStr || ALL_COUNTRIES;
    } else {
      // If CSV doesn't have targetCountries column, default to ALL
      tableRow[TARGET_COUNTRIES_COLUMN_ID] = ALL_COUNTRIES;
    }
    
    return tableRow;
  });
  
  return {
    rows: transformedRows,
    metadata: {
      totalRows: transformedRows.length,
      lastUpdated: new Date().toISOString(),
      importSource: 'csv',
    },
  };
}

export function transformValue(value: unknown, type: ColumnType): unknown {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  switch (type) {
    case 'number':
    case 'currency':
      const num = Number(value);
      return isNaN(num) ? null : num;
      
    case 'boolean':
      if (typeof value === 'boolean') return value;
      const str = String(value).toLowerCase();
      return ['true', '1', 'yes', 'y'].includes(str);
      
    case 'date':
      const date = new Date(value as string | number | Date);
      return isNaN(date.getTime()) ? null : date.toISOString();
      
    default:
      return String(value);
  }
}

// =============================================================================
// Validation Utilities
// =============================================================================

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidDate(date: string): boolean {
  const parsedDate = new Date(date);
  return !isNaN(parsedDate.getTime());
}

// =============================================================================
// Table Data Utilities
// =============================================================================

export function generateRowId(): string {
  return `row_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createEmptyRow(schema: TableSchema): TableRow {
  const row: TableRow = {
    id: generateRowId(),
  };
  
  schema.columns.forEach(column => {
    row[column.id] = column.defaultValue ?? null;
  });
  
  return row;
}

export function getTableStats(data: TableData): {
  totalRows: number;
  completedRows: number;
  emptyRows: number;
  lastUpdated: string;
} {
  const totalRows = data.rows.length;
  const emptyRows = data.rows.filter(row => 
    Object.keys(row).filter(key => key !== 'id').every(key => 
      row[key] === null || row[key] === undefined || row[key] === ''
    )
  ).length;
  
  return {
    totalRows,
    completedRows: totalRows - emptyRows,
    emptyRows,
    lastUpdated: data.metadata?.lastUpdated || new Date().toISOString(),
  };
}

// =============================================================================
// Export Utilities
// =============================================================================

export function exportTableToCsv(data: TableData, schema: TableSchema): string {
  const headers = schema.columns.map(col => col.name);
  const csvRows = [
    headers.join(','),
    ...data.rows.map(row => 
      schema.columns.map(col => {
        const value = row[col.id] ?? '';
        // Escape commas and quotes in CSV
        return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
          ? `"${value.replace(/"/g, '""')}"` 
          : value;
      }).join(',')
    )
  ];
  
  return csvRows.join('\n');
}

export function exportTableToJson(data: TableData, schema: TableSchema): string {
  const exportData = {
    schema: {
      columns: schema.columns.map(col => ({
        id: col.id,
        name: col.name,
        type: col.type,
      })),
      version: schema.version,
    },
    data: data.rows,
    metadata: data.metadata,
    exportedAt: new Date().toISOString(),
  };
  
  return JSON.stringify(exportData, null, 2);
}

// =============================================================================
// Geo-Targeting / Country Filtering Utilities
// =============================================================================

/**
 * The system column ID for target countries
 * This column is automatically added to all tables for country-based filtering
 */
export const TARGET_COUNTRIES_COLUMN_ID = 'targetCountries';

/**
 * Creates the targetCountries system column definition
 * This column is:
 * - Automatically added to all table schemas
 * - Cannot be removed by admin
 * - Hidden from public view
 * - Defaults to "ALL" (visible to everyone)
 */
export function createTargetCountriesColumn(): TableColumn {
  return {
    id: TARGET_COUNTRIES_COLUMN_ID,
    name: 'Target Countries',
    type: 'text',
    sortable: false,
    filterable: false,
    searchable: false,
    required: false,
    align: 'left',
    validation: [],
    // Custom properties for system columns
    isSystem: true,      // System column - can't be removed
    isHidden: true,      // Don't show in public UI
    defaultValue: ALL_COUNTRIES,
  } as TableColumn & { isSystem?: boolean; isHidden?: boolean; defaultValue?: string };
}

/**
 * Ensures the targetCountries column exists in a table schema
 * If not present, it's added as the last column
 * 
 * @param schema - The table schema to check/modify
 * @returns The schema with targetCountries column guaranteed
 */
export function ensureTargetCountriesColumn(schema: TableSchema): TableSchema {
  const hasTargetCountries = schema.columns.some(
    col => col.id === TARGET_COUNTRIES_COLUMN_ID
  );
  
  if (!hasTargetCountries) {
    return {
      ...schema,
      columns: [...schema.columns, createTargetCountriesColumn()],
      updatedAt: new Date().toISOString(),
    };
  }
  
  return schema;
}

/**
 * Ensures each row has a targetCountries value
 * If missing or empty, defaults to "ALL"
 * 
 * @param rows - Array of table rows
 * @returns Rows with guaranteed targetCountries values
 */
export function ensureRowsHaveTargetCountries(rows: TableRow[]): TableRow[] {
  return rows.map(row => {
    const targetCountries = row[TARGET_COUNTRIES_COLUMN_ID];
    
    // If missing, empty, or whitespace only, default to ALL
    if (!targetCountries || String(targetCountries).trim() === '') {
      return {
        ...row,
        [TARGET_COUNTRIES_COLUMN_ID]: ALL_COUNTRIES,
      };
    }
    
    return row;
  });
}

/**
 * Filters table rows based on user's country
 * A row is visible if:
 * - targetCountries is "ALL" or contains "ALL"
 * - targetCountries contains the user's country code
 * 
 * @param rows - Array of table rows
 * @param userCountry - User's country code (e.g., "IN", "US")
 * @returns Filtered rows visible to the user
 */
export function filterRowsByCountry(rows: TableRow[], userCountry: string): TableRow[] {
  return rows.filter(row => {
    const targetCountries = row[TARGET_COUNTRIES_COLUMN_ID];
    
    // If no targetCountries, show to everyone (default behavior)
    if (!targetCountries) {
      return true;
    }
    
    const targetStr = String(targetCountries).trim().toUpperCase();
    
    // If "ALL", show to everyone
    if (targetStr === ALL_COUNTRIES) {
      return true;
    }
    
    // Handle comma-separated values: "IN,US,GB"
    if (targetStr.includes(',')) {
      const countries = targetStr.split(',').map(c => c.trim());
      return countries.includes(ALL_COUNTRIES) || countries.includes(userCountry.toUpperCase());
    }
    
    // Single country check
    return targetStr === userCountry.toUpperCase();
  });
}

// =============================================================================
// Display order (N-2)
// =============================================================================

/**
 * The admin-controlled row order.
 *
 * ⚠️ SECOND INSTANCE OF THE `targetCountries` PATTERN, deliberately — a real column in the schema,
 * added automatically, stripped before the public sees it. Not a companion field like a row image,
 * because unlike an image this has to be editable in the admin grid and mappable from a CSV header
 * by the ordinary route.
 *
 * ⚠️ WHY A COLUMN AND NOT JUST THE ARRAY ORDER. The array order IS already the display order, so
 * the concept needs no storage at all — but a CSV cannot express "put me third" without a value to
 * write, and a re-import would silently discard whatever the admin had arranged. The column is what
 * survives an import.
 */
export const DISPLAY_ORDER_COLUMN_ID = 'displayOrder';

/**
 * Every column that exists for the admin and must NEVER reach the public payload.
 *
 * ⚠️ A LIST, NOT TWO HARD-CODED CHECKS — and that is the whole reason it exists. `getPublicSchema`
 * and `getPublicRows` named `targetCountries` inline, in two separate places. Adding `displayOrder`
 * meant either four edits or one list, and the failure mode of missing one is SILENT: the column
 * simply appears on 656 public pages and nothing errors.
 *
 * ⚠️ ADD A SYSTEM COLUMN HERE AND BOTH STRIPPERS PICK IT UP. That is the only place it needs saying.
 */
export const SYSTEM_COLUMN_IDS: readonly string[] = [
  TARGET_COUNTRIES_COLUMN_ID,
  DISPLAY_ORDER_COLUMN_ID,
];

/**
 * The displayOrder system column.
 *
 * ⚠️ `type: 'number'` EARNS SOMETHING CONCRETE: `transformValue` already coerces a CSV cell to a
 * number for this type and yields `null` for an empty one — exactly the semantics wanted, where
 * blank means "no opinion" rather than zero. **No special-case CSV code was needed as a result**,
 * unlike `targetCountries`, which needs its own header lookup because it must default to `ALL`.
 */
export function createDisplayOrderColumn(): TableColumn {
  return {
    id: DISPLAY_ORDER_COLUMN_ID,
    name: 'Display Order',
    type: 'number',
    /*
      All three false: this column is stripped before it reaches the public table, so these only
      ever matter to the admin grid — where sorting BY the order column would be circular.
    */
    sortable: false,
    filterable: false,
    searchable: false,
    required: false,
    align: 'left',
    validation: [],
    isSystem: true,
    isHidden: true,
  } as TableColumn & { isSystem?: boolean; isHidden?: boolean };
}

/** Guarantees the displayOrder column exists, appended last. */
export function ensureDisplayOrderColumn(schema: TableSchema): TableSchema {
  if (schema.columns.some(col => col.id === DISPLAY_ORDER_COLUMN_ID)) return schema;

  return {
    ...schema,
    /*
      ⚠️ APPENDED LAST, WHICH ALSO MAKES THE CSV AUTO-MAPPER SAFER. `autoMapColumns` uses `.find()`
      — first match wins — on a substring test, so a real column called "Order Type" is matched by
      a CSV header of "Order" BEFORE this one. That is the right precedence: a column the admin
      created beats a system column they did not.
    */
    columns: [...schema.columns, createDisplayOrderColumn()],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Sort rows into the admin's chosen order.
 *
 * ⚠️ STABLE, WITH BLANKS LAST. Both halves were asked for explicitly.
 *
 *   • **Ties keep their existing relative position.** Two rows both numbered `1` render in the
 *     order they already occupy — deterministic, identical on every load. Ties were accepted
 *     explicitly on the grounds that the order between them does not matter.
 *     ⚠️ "Existing position" means position in the STORED ARRAY, so deleting and re-adding a row
 *     moves it to the end and can flip a tie. Distinct numbers are the fix when it matters.
 *
 *   • **No value sorts LAST, not first.** A blank means "no opinion" — but `Number(null)` is `0`,
 *     which would sort every unnumbered row ABOVE everything deliberately placed. That inversion
 *     is the bug this function exists to avoid, and it is why the guard is explicit instead of
 *     relying on numeric coercion.
 *
 * ⚠️ `Array.prototype.sort` is stable by specification (ES2019 onward), so the tie behaviour above
 * is a language guarantee rather than an implementation detail worth re-testing per engine.
 *
 * ⚠️ NON-MUTATING. `getPublicTable` holds rows that came out of a cross-request cache, and sorting
 * one of those in place would reorder the cached value for every later reader.
 */
export function sortRowsByDisplayOrder(rows: TableRow[]): TableRow[] {
  const rank = (row: TableRow): number => {
    const raw = row[DISPLAY_ORDER_COLUMN_ID];
    if (raw === null || raw === undefined || raw === '') return Number.POSITIVE_INFINITY;
    const n = Number(raw);
    // A non-numeric value is "no opinion" too, not 0 — same reason as a blank.
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
  };

  return [...rows].sort((a, b) => rank(a) - rank(b));
}

/**
 * Renumber every row sequentially from 1, in its current array position.
 *
 * ⚠️ THE WHOLE TABLE, NEVER A SWAP OF TWO ROWS. Swapping assumes contiguous numbers, and they are
 * not: a CSV can arrive as 1, 5, 9, and deleting a row leaves a gap. With gaps a swap can move a
 * row past two neighbours at once or appear to do nothing, and it degrades further with every edit.
 * Same conclusion `renumber()` in `roadmap-tree.ts` reached for roadmap nodes and the changelog.
 *
 * ⚠️ 1-BASED, unlike `renumber()`. These values are typed by a person into a spreadsheet, and a
 * column of positions starting at 0 invites an off-by-one every time it is edited by hand.
 *
 * ⚠️ IT DESTROYS DELIBERATE TIES, and that is the accepted trade. Pressing a move button is a
 * statement that the exact sequence matters; if two rows should share a number, set it in the CSV
 * and do not reorder them by hand afterwards.
 */
export function renumberDisplayOrder(rows: TableRow[]): TableRow[] {
  return rows.map((row, index) => ({ ...row, [DISPLAY_ORDER_COLUMN_ID]: index + 1 }));
}

/**
 * Removes every system column from a schema for public display.
 *
 * The data is still used — `targetCountries` to filter, `displayOrder` to sort — but neither is
 * something a visitor should see or be able to sort by.
 */
export function getPublicSchema(schema: TableSchema): TableSchema {
  return {
    ...schema,
    columns: schema.columns.filter(col => !SYSTEM_COLUMN_IDS.includes(col.id)),
  };
}

/**
 * Removes every system field from rows for public display.
 *
 * ⚠️ CALL THIS **LAST**, AFTER FILTERING AND SORTING. Both of those read a system field, so
 * stripping first removes the key the next step needs — and the symptom is an unsorted table rather
 * than an error. `getPublicTable` states the ordering at its call site.
 */
export function getPublicRows(rows: TableRow[]): TableRow[] {
  return rows.map(row => {
    const publicRow: TableRow = { ...row };
    for (const id of SYSTEM_COLUMN_IDS) delete publicRow[id];
    return publicRow;
  });
}

/**
 * Shared Types for Services Layer
 * 
 * These types are used across all services and provide consistent
 * data structures for the application.
 */

import type { 
  Domain, 
  DomainCategory, 
  Page, 
  ContentBlock,
  Table,
  RichTextContent
} from '@/generated/prisma';

// ============================================
// Domain Types
// ============================================

/**
 * Domain with its category information
 */
export type DomainWithCategory = Domain & {
  category: DomainCategory | null;
};

/**
 * Domain with pages (for domain detail pages)
 */
export type DomainWithPages = Domain & {
  category?: DomainCategory | null;
  pages: PageBasic[];
};

/**
 * Minimal domain info for navigation
 */
export type DomainBasic = {
  id: string;
  name: string;
  slug: string;
  pageType: string;
  isPublished: boolean;
  targetCountries: string[];
  orderInCategory: number;
  categoryId: string | null;
};

// ============================================
// Page Types
// ============================================

/**
 * Page with all content relations
 */
export type PageWithContent = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  sections?: any; // JSON field for section configuration
  parentId: string | null;
  domainId: string;
  order: number;
  targetCountries: string[];
  content: ContentBlockBasic[];
  subPages: PageBasic[];
  richTextContent?: RichTextContentBasic | null;
};

/**
 * Minimal page info for listings and navigation
 */
export type PageBasic = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  parentId: string | null;
  order?: number;
  targetCountries?: string[];
};

/**
 * Content block with essential fields
 */
export type ContentBlockBasic = {
  id: string;
  type: string;
  content: any;
  order: number;
};

/**
 * Rich text content with essential fields
 */
export type RichTextContentBasic = {
  id: string;
  htmlContent: string;
  title: string | null;
  wordCount: number;
  updatedAt: Date;
};

/**
 * Child page for section organization
 */
export type ChildPage = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  parentId: string | null;
};

// ============================================
// Category Types
// ============================================

/**
 * Category with full details
 */
export type CategoryFull = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  columnPosition: number;
  categoryOrder: number;
  isActive: boolean;
};

// ============================================
// Navigation Types
// ============================================

/**
 * Breadcrumb item
 */
export type BreadcrumbItem = {
  label: string;
  url: string;
  type: 'root' | 'domain' | 'page';
  contentType?: string;
};

/**
 * Header data structure (domains grouped by category)
 */
export type HeaderData = {
  columnData: {
    [key: number]: {
      category: CategoryFull;
      domains: {
        id: string;
        name: string;
        slug: string;
        url: string;
      }[];
    }[];
  };
  totalDomains: number;
  totalCategories: number;
};

/**
 * Sidebar domain with pages
 */
export type SidebarDomain = {
  id: string;
  name: string;
  slug: string;
  pageType: string;
  url: string;
  pages: SidebarPage[];
  categoryId: string | null;
  categoryOrder: number;
  columnPosition: number;
};

/**
 * Sidebar page
 */
export type SidebarPage = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  parentId: string | null;
  order: number;
  url: string;
};

/**
 * Sidebar data structure
 */
export type SidebarData = {
  domains: SidebarDomain[];
  categories: CategoryFull[];
};

/**
 * Page sidebar section
 */
export type PageSidebarSection = {
  title: string;
  column: number;
  order: number;
  pages: PageSidebarPage[];
};

/**
 * Page sidebar page
 */
export type PageSidebarPage = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  parentId: string | null;
  order: number;
  url: string;
  hasChildren: boolean;
  children: PageSidebarPage[];
};

/**
 * Page sidebar data structure
 */
export type PageSidebarData = {
  type: 'direct_domain' | 'hierarchical_page';
  domain: {
    name: string;
    slug: string;
  };
  page?: {
    name: string;
    slug: string;
  };
  sections: PageSidebarSection[];
};

/**
 * Combined page context - all navigation data in one
 */
export type PageContextData = {
  header: HeaderData;
  sidebar: SidebarData;
  pageSidebar: PageSidebarData | null;
  breadcrumb: {
    items: BreadcrumbItem[];
  };
  currentPage?: {
    id: string;
    title: string;
    contentType: string;
  };
};

// ============================================
// Table Types
// ============================================

/**
 * Table with page info
 */
export type TableWithPage = {
  id: string;
  name: string;
  pageId: string;
  schema: any;
  data: any;
  settings: any;
  updatedAt: Date;
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


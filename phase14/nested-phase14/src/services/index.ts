/**
 * Services Layer - Central Export
 * 
 * This file re-exports all services for easy importing:
 * 
 * @example
 * import { DomainService, PageService } from '@/services';
 */

export { CategoryService } from './category.service';
export { DomainService } from './domain.service';
export { PageService } from './page.service';
export { TableService } from './table.service';
export { NavigationService } from './navigation.service';

// Re-export types
export type {
  // Domain types
  DomainWithCategory,
  DomainWithPages,
  DomainBasic,
  
  // Page types
  PageWithContent,
  PageBasic,
  ContentBlockBasic,
  RichTextContentBasic,
  ChildPage,
  
  // Category types
  CategoryFull,
  
  // Navigation types
  BreadcrumbItem,
  HeaderData,
  SidebarData,
  SidebarDomain,
  SidebarPage,
  PageSidebarData,
  PageSidebarSection,
  PageSidebarPage,
  PageContextData,
  
  // Table types
  TableWithPage,
} from './types';


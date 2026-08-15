// src/components/admin/sections/SectionEditor.tsx

'use client';

import { useState, useEffect } from 'react';
import {
  FileText,
  FolderTree,
  LayoutList,
  Palette,
  PenLine,
  Route,
  Table2,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Visual Section Configuration Editor
 * 
 * Provides an intuitive interface for organizing child pages into 3-column sections:
 * - Visual representation of the 3-column layout
 * - Drag-and-drop functionality (future enhancement)
 * - Form-based section management
 * - Live preview of the configuration
 * - Save/cancel operations
 * 
 * Current implementation uses forms, but can be enhanced with drag-and-drop later.
 */

// Type definitions
type Domain = {
  id: string;
  name: string;
  slug: string;
  pageType: string;
};

type SectionablePage = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  sections?: any;
  subPages: ChildPage[];
};

type ChildPage = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
};

type Section = {
  title: string;
  column: number;
  order: number;
  pageIds: string[];
};

type SectionEditorProps = {
  page: SectionablePage;
  domain: Domain;
  onSectionsUpdate: (sections: Section[]) => Promise<void>;
  isLoading: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
};

export function SectionEditor({
  page,
  domain,
  onSectionsUpdate,
  isLoading,
  saveStatus
}: SectionEditorProps) {
  
  // State management
  const [sections, setSections] = useState<Section[]>([]);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [selectedColumn, setSelectedColumn] = useState(1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Initialize sections from page data
  useEffect(() => {
    if (page.sections && Array.isArray(page.sections)) {
      setSections(page.sections);
    } else {
      setSections([]);
    }
    setHasUnsavedChanges(false);
  }, [page]);

  // Get unorganized pages (not assigned to any section)
  const getUnorganizedPages = (): ChildPage[] => {
    const assignedPageIds = sections.flatMap(section => section.pageIds);
    return page.subPages.filter(childPage => !assignedPageIds.includes(childPage.id));
  };

  // Add new section
  const addSection = () => {
    if (!newSectionTitle.trim()) return;
    
    const newSection: Section = {
      title: newSectionTitle.trim(),
      column: selectedColumn,
      order: sections.filter(s => s.column === selectedColumn).length + 1,
      pageIds: []
    };
    
    setSections(prev => [...prev, newSection]);
    setNewSectionTitle('');
    setHasUnsavedChanges(true);
  };

  // Remove section
  const removeSection = (sectionIndex: number) => {
    setSections(prev => prev.filter((_, index) => index !== sectionIndex));
    setHasUnsavedChanges(true);
  };

  // Add page to section
  const addPageToSection = (sectionIndex: number, pageId: string) => {
    setSections(prev => prev.map((section, index) => 
      index === sectionIndex 
        ? { ...section, pageIds: [...section.pageIds, pageId] }
        : section
    ));
    setHasUnsavedChanges(true);
  };

  // Remove page from section
  const removePageFromSection = (sectionIndex: number, pageId: string) => {
    setSections(prev => prev.map((section, index) => 
      index === sectionIndex 
        ? { ...section, pageIds: section.pageIds.filter(id => id !== pageId) }
        : section
    ));
    setHasUnsavedChanges(true);
  };

  // Move section to different column
  const moveSectionToColumn = (sectionIndex: number, newColumn: number) => {
    setSections(prev => prev.map((section, index) => 
      index === sectionIndex 
        ? { ...section, column: newColumn }
        : section
    ));
    setHasUnsavedChanges(true);
  };

  // Save sections
  const handleSave = async () => {
    await onSectionsUpdate(sections);
    setHasUnsavedChanges(false);
  };

  // Reset changes
  const handleReset = () => {
    if (page.sections && Array.isArray(page.sections)) {
      setSections(page.sections);
    } else {
      setSections([]);
    }
    setHasUnsavedChanges(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Editor Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">
            Step 2: Configure Sections for "{page.title}"
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Organize {page.subPages.length} child pages into 3-column sections
          </p>
        </div>
        
        {/* Save Status Indicator */}
        <div className="flex items-center space-x-2">
          {saveStatus === 'saving' && (
            <div className="flex items-center text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
              Saving...
            </div>
          )}
          {saveStatus === 'saved' && (
            <div className="flex items-center text-muted-foreground">
              <span className="mr-2">✅</span>
              Saved successfully
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="flex items-center text-destructive">
              <span className="mr-2">❌</span>
              Error saving
            </div>
          )}
          {hasUnsavedChanges && saveStatus === 'idle' && (
            <div className="text-muted-foreground text-sm">
              • Unsaved changes
            </div>
          )}
        </div>
      </div>

      {/* Add New Section Form */}
      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="font-medium mb-3">Add New Section</h4>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Section title (e.g., 'Skill Development')"
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
            className="border-input bg-background focus:ring-ring flex-1 rounded-md border p-2 focus:ring-2"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                addSection();
              }
            }}
          />
          {/*
            ⚠️ A native `<select>` became a shadcn `Select` (requested after G-6c).

            Radix requires a STRING `value`, so the number is stringified going in and parsed
            coming out — the state stays a number because `addSection` and the section model
            both expect one.
          */}
          <Select
            value={String(selectedColumn)}
            onValueChange={(value) => setSelectedColumn(Number(value))}
          >
            <SelectTrigger className="w-36 shrink-0" aria-label="Column">
              {/* Explicit children so the label is correct before hydration — Radix otherwise
                  resolves it from Portal-mounted items (the G-3c trap). */}
              <SelectValue>Column {selectedColumn}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Column 1</SelectItem>
              <SelectItem value="2">Column 2</SelectItem>
              <SelectItem value="3">Column 3</SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={addSection}
            disabled={!newSectionTitle.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Section
          </button>
        </div>
      </div>

      {/* 3-Column Layout Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map(columnNumber => (
          <ColumnEditor
            key={columnNumber}
            columnNumber={columnNumber}
            sections={sections.filter(s => s.column === columnNumber)}
            allPages={page.subPages}
            unorganizedPages={getUnorganizedPages()}
            onAddPageToSection={addPageToSection}
            onRemovePageFromSection={removePageFromSection}
            onRemoveSection={removeSection}
            onMoveSectionToColumn={moveSectionToColumn}
            getSectionIndex={(section) => sections.findIndex(s => s === section)}
          />
        ))}
      </div>

      {/* Unorganized Pages */}
      {getUnorganizedPages().length > 0 && (
        <div className="bg-muted/50 rounded-lg border p-4">
          <h4 className="font-medium mb-3">
            📄 Unorganized Pages ({getUnorganizedPages().length})
          </h4>
          <p className="text-muted-foreground text-sm mb-3">
            These pages are not assigned to any section yet:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {getUnorganizedPages().map(childPage => (
              <div key={childPage.id} className="bg-card flex items-center justify-between rounded border p-2">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <PageTypeIcon contentType={childPage.contentType} />
                  <span className="truncate">{childPage.title}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between border-t pt-4">
        <button
          onClick={handleReset}
          disabled={!hasUnsavedChanges || isLoading}
          className="text-muted-foreground hover:bg-muted rounded-md border px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset Changes
        </button>
        <button
          onClick={handleSave}
          disabled={!hasUnsavedChanges || isLoading}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

    </div>
  );
}

/**
 * Column Editor Component
 * Manages sections within a single column
 */
type ColumnEditorProps = {
  columnNumber: number;
  sections: Section[];
  allPages: ChildPage[];
  unorganizedPages: ChildPage[];
  onAddPageToSection: (sectionIndex: number, pageId: string) => void;
  onRemovePageFromSection: (sectionIndex: number, pageId: string) => void;
  onRemoveSection: (sectionIndex: number) => void;
  onMoveSectionToColumn: (sectionIndex: number, newColumn: number) => void;
  getSectionIndex: (section: Section) => number;
};

function ColumnEditor({
  columnNumber,
  sections,
  allPages,
  unorganizedPages,
  onAddPageToSection,
  onRemovePageFromSection,
  onRemoveSection,
  onMoveSectionToColumn,
  getSectionIndex
}: ColumnEditorProps) {
  
  return (
    <div className="bg-card rounded-lg border p-4">
      <h4 className="mb-4 flex items-center font-medium">
        📂 Column {columnNumber}
        <span className="ml-2 text-sm text-muted-foreground">
          ({sections.length} sections)
        </span>
      </h4>
      
      {sections.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <div className="text-2xl mb-2">📋</div>
          <div className="text-sm">No sections in this column</div>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((section) => {
            const sectionIndex = getSectionIndex(section);
            return (
              <SectionCard
                key={sectionIndex}
                section={section}
                sectionIndex={sectionIndex}
                allPages={allPages}
                unorganizedPages={unorganizedPages}
                currentColumn={columnNumber}
                onAddPageToSection={onAddPageToSection}
                onRemovePageFromSection={onRemovePageFromSection}
                onRemoveSection={onRemoveSection}
                onMoveSectionToColumn={onMoveSectionToColumn}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Individual Section Card Component
 */
type SectionCardProps = {
  section: Section;
  sectionIndex: number;
  allPages: ChildPage[];
  unorganizedPages: ChildPage[];
  currentColumn: number;
  onAddPageToSection: (sectionIndex: number, pageId: string) => void;
  onRemovePageFromSection: (sectionIndex: number, pageId: string) => void;
  onRemoveSection: (sectionIndex: number) => void;
  onMoveSectionToColumn: (sectionIndex: number, newColumn: number) => void;
};

function SectionCard({
  section,
  sectionIndex,
  allPages,
  unorganizedPages,
  currentColumn,
  onAddPageToSection,
  onRemovePageFromSection,
  onRemoveSection,
  onMoveSectionToColumn
}: SectionCardProps) {
  
  const [isAddingPage, setIsAddingPage] = useState(false);
  
  // Get page objects for this section
  const sectionPages = section.pageIds
    .map(pageId => allPages.find(p => p.id === pageId))
    .filter(Boolean) as ChildPage[];

  return (
    <div className="bg-muted/50 rounded border p-3">
      
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3">
        <h5 className="font-medium">{section.title}</h5>
        <div className="flex items-center space-x-1">
          {/* Move to Column Buttons */}
          {[1, 2, 3].filter(col => col !== currentColumn).map(col => (
            <button
              key={col}
              onClick={() => onMoveSectionToColumn(sectionIndex, col)}
              title={`Move to Column ${col}`}
              className="hover:bg-muted rounded px-2 py-1 text-xs"
            >
              →{col}
            </button>
          ))}
          {/* Delete Section */}
          <button
            onClick={() => onRemoveSection(sectionIndex)}
            title="Delete Section"
            className="text-destructive hover:bg-destructive/10 rounded p-1"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Section Pages */}
      <div className="space-y-2 mb-3">
        {sectionPages.map(page => (
          <div key={page.id} className="bg-card flex items-center justify-between rounded border p-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <PageTypeIcon contentType={page.contentType} />
              <span className="truncate">{page.title}</span>
            </span>
            <button
              onClick={() => onRemovePageFromSection(sectionIndex, page.id)}
              className="text-destructive hover:bg-destructive/10 rounded p-1"
              title="Remove from section"
            >
              ✕
            </button>
          </div>
        ))}
        
        {sectionPages.length === 0 && (
          <div className="text-muted-foreground py-2 text-center text-sm">
            No pages in this section
          </div>
        )}
      </div>

      {/* Add Page to Section */}
      {unorganizedPages.length > 0 && (
        <div>
          {!isAddingPage ? (
            <button
              onClick={() => setIsAddingPage(true)}
              className="hover:bg-muted w-full rounded-md border p-2 text-sm"
            >
              + Add Page
            </button>
          ) : (
            <div className="space-y-2">
              {/*
                ⚠️ Was a native `<select>` whose `value` was never set — it relied on the
                browser resetting to the placeholder `<option value="">` after each pick.

                A `Command` list rather than a `Select`, because this can hold **864 child
                pages** (the "Child pages" figure on this screen), and picking one out of an
                unsearchable dropdown of that length is not workable. Typing filters it.
              */}
              <Command className="rounded-md border">
                <CommandInput placeholder="Search pages…" className="h-9" />
                <CommandList className="max-h-48">
                  <CommandEmpty>No unassigned page found.</CommandEmpty>
                  <CommandGroup>
                    {unorganizedPages.map((page) => (
                      <CommandItem
                        key={page.id}
                        value={`${page.title} ${page.slug}`}
                        onSelect={() => {
                          onAddPageToSection(sectionIndex, page.id);
                          setIsAddingPage(false);
                        }}
                      >
                        {/* A lucide icon by content type, replacing `getPageIcon()`'s emoji. */}
                        <PageTypeIcon contentType={page.contentType} />
                        <span className="min-w-0 flex-1 truncate">{page.title}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setIsAddingPage(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Helper function to get icon for page content type
 */
/**
 * A page's content type as an icon.
 *
 * ⚠️ Replaces `getPageIcon()`, which returned an **emoji string** (📊 📝 📂 📋 📄 🎨). Emoji
 * cannot inherit `currentColor`, so they ignored the theme, and they render at a different size
 * and baseline per platform.
 *
 * These are the same icons `PageTree` uses for the same content types (G-4c), so a "table" page
 * looks identical wherever it appears in the admin.
 */
function PageTypeIcon({ contentType }: { contentType: string }) {
  const icons: Record<string, LucideIcon> = {
    table: Table2,
    rich_text: PenLine,
    subcategory_list: FolderTree,
    section_based: LayoutList,
    narrative: FileText,
    mixed_content: Palette,
    // ⚠️ Must match PageTree's CONTENT_TYPE_ICONS — that is the point of the note above.
    roadmap: Route,
  };

  const Icon = icons[contentType] ?? FileText;
  return <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />;
}

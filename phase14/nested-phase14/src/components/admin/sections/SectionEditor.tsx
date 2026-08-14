// src/components/admin/sections/SectionEditor.tsx

'use client';

import { useState, useEffect } from 'react';

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
          <h3 className="text-lg font-medium text-gray-900">
            Step 2: Configure Sections for "{page.title}"
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Organize {page.subPages.length} child pages into 3-column sections
          </p>
        </div>
        
        {/* Save Status Indicator */}
        <div className="flex items-center space-x-2">
          {saveStatus === 'saving' && (
            <div className="flex items-center text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              Saving...
            </div>
          )}
          {saveStatus === 'saved' && (
            <div className="flex items-center text-green-600">
              <span className="mr-2">✅</span>
              Saved successfully
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="flex items-center text-red-600">
              <span className="mr-2">❌</span>
              Error saving
            </div>
          )}
          {hasUnsavedChanges && saveStatus === 'idle' && (
            <div className="text-orange-600 text-sm">
              • Unsaved changes
            </div>
          )}
        </div>
      </div>

      {/* Add New Section Form */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Add New Section</h4>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Section title (e.g., 'Skill Development')"
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
            className="flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                addSection();
              }
            }}
          />
          <select
            value={selectedColumn}
            onChange={(e) => setSelectedColumn(Number(e.target.value))}
            className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={1}>Column 1</option>
            <option value={2}>Column 2</option>
            <option value={3}>Column 3</option>
          </select>
          <button
            onClick={addSection}
            disabled={!newSectionTitle.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
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
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-800 mb-3">
            📄 Unorganized Pages ({getUnorganizedPages().length})
          </h4>
          <p className="text-sm text-yellow-700 mb-3">
            These pages are not assigned to any section yet:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {getUnorganizedPages().map(childPage => (
              <div key={childPage.id} className="flex items-center justify-between bg-white p-2 rounded border">
                <span className="text-sm">
                  {getPageIcon(childPage.contentType)} {childPage.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between pt-4 border-t border-gray-200">
        <button
          onClick={handleReset}
          disabled={!hasUnsavedChanges || isLoading}
          className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset Changes
        </button>
        <button
          onClick={handleSave}
          disabled={!hasUnsavedChanges || isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <h4 className="font-medium text-gray-900 mb-4 flex items-center">
        📂 Column {columnNumber}
        <span className="ml-2 text-sm text-gray-500">
          ({sections.length} sections)
        </span>
      </h4>
      
      {sections.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
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
    <div className="border border-gray-300 rounded p-3 bg-gray-50">
      
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3">
        <h5 className="font-medium text-gray-900">{section.title}</h5>
        <div className="flex items-center space-x-1">
          {/* Move to Column Buttons */}
          {[1, 2, 3].filter(col => col !== currentColumn).map(col => (
            <button
              key={col}
              onClick={() => onMoveSectionToColumn(sectionIndex, col)}
              title={`Move to Column ${col}`}
              className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-100 rounded"
            >
              →{col}
            </button>
          ))}
          {/* Delete Section */}
          <button
            onClick={() => onRemoveSection(sectionIndex)}
            title="Delete Section"
            className="text-red-600 hover:bg-red-100 p-1 rounded"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Section Pages */}
      <div className="space-y-2 mb-3">
        {sectionPages.map(page => (
          <div key={page.id} className="flex items-center justify-between bg-white p-2 rounded border text-sm">
            <span>
              {getPageIcon(page.contentType)} {page.title}
            </span>
            <button
              onClick={() => onRemovePageFromSection(sectionIndex, page.id)}
              className="text-red-600 hover:bg-red-100 p-1 rounded"
              title="Remove from section"
            >
              ✕
            </button>
          </div>
        ))}
        
        {sectionPages.length === 0 && (
          <div className="text-center py-2 text-gray-500 text-sm">
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
              className="w-full text-sm text-blue-600 border border-blue-300 rounded p-2 hover:bg-blue-50"
            >
              + Add Page
            </button>
          ) : (
            <div className="space-y-2">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    onAddPageToSection(sectionIndex, e.target.value);
                    setIsAddingPage(false);
                  }
                }}
                className="w-full text-sm p-2 border border-gray-300 rounded"
              >
                <option value="">Select a page...</option>
                {unorganizedPages.map(page => (
                  <option key={page.id} value={page.id}>
                    {getPageIcon(page.contentType)} {page.title}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setIsAddingPage(false)}
                className="w-full text-sm text-gray-600 border border-gray-300 rounded p-1 hover:bg-gray-50"
              >
                Cancel
              </button>
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
function getPageIcon(contentType: string): string {
  const icons: Record<string, string> = {
    'table': '📊',
    'rich_text': '📝',
    'subcategory_list': '📂',
    'section_based': '📋',
    'narrative': '📄',
    'mixed_content': '🎨'
  };
  return icons[contentType] || '📄';
}

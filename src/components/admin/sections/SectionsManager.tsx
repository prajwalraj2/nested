// src/components/admin/sections/SectionsManager.tsx

'use client';

import { useState } from 'react';
import { LayoutPanelTop } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DomainPageSelector } from './DomainPageSelector';
import { SectionEditor } from './SectionEditor';

/**
 * Main Sections Manager Component
 * 
 * Orchestrates the entire section configuration workflow:
 * 1. Domain and page selection
 * 2. Section configuration editing
 * 3. Preview and saving
 * 
 * State management for the entire sections interface
 */

// Type definitions for better TypeScript support
type Domain = {
  id: string;
  name: string;
  slug: string;
  pageType: string;
  pages: SectionablePage[];
};

type SectionablePage = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  sections?: any;
  subPages: ChildPage[];
  _count: {
    subPages: number;
  };
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

type SectionsManagerProps = {
  domains: Domain[];
};

export function SectionsManager({ domains }: SectionsManagerProps) {
  // State management
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [selectedPage, setSelectedPage] = useState<SectionablePage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Handler functions
  const handleDomainChange = (domain: Domain | null) => {
    setSelectedDomain(domain);
    setSelectedPage(null); // Reset page selection when domain changes
  };

  const handlePageChange = (page: SectionablePage | null) => {
    setSelectedPage(page);
  };

  const handleSectionsUpdate = async (sections: Section[]) => {
    if (!selectedPage) return;
    
    setIsLoading(true);
    setSaveStatus('saving');
    
    try {
      const response = await fetch(`/api/admin/sections/${selectedPage.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sections }),
      });

      if (!response.ok) {
        throw new Error('Failed to save sections');
      }

      // Update local state
      setSelectedPage(prev => prev ? {
        ...prev,
        sections
      } : null);

      setSaveStatus('saved');
      
      // Reset save status after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
      
    } catch (error) {
      console.error('Error saving sections:', error);
      setSaveStatus('error');
      
      // Reset error status after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    /*
      ⚠️ `bg-white rounded-lg border-gray-200` → `Card`. Same white-sheet-on-a-dark-page
      problem as `TablesManager` (G-5a(ii)) and `CategoryList` (G-6a).

      ⚠️ The inner "🎯 Section Configuration" heading and its subtitle are gone: the page above
      now renders `AdminPageHeader` with the same information, so the screen had **two titles
      stacked**. Exactly the duplication found in `TablesManager` in G-5a(ii) — the third time a
      shell and its child both claimed the page title.
    */
    <Card>
      <CardContent className="space-y-6">
        <DomainPageSelector
          domains={domains}
          selectedDomain={selectedDomain}
          selectedPage={selectedPage}
          onDomainChange={handleDomainChange}
          onPageChange={handlePageChange}
        />

        {selectedPage ? (
          <div className="border-t pt-6">
            <SectionEditor
              page={selectedPage}
              domain={selectedDomain!}
              onSectionsUpdate={handleSectionsUpdate}
              isLoading={isLoading}
              saveStatus={saveStatus}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 border-t py-12 text-center">
            <LayoutPanelTop className="text-muted-foreground size-8" aria-hidden="true" />
            <p className="font-medium">Select a page to configure</p>
            <p className="text-muted-foreground max-w-md text-sm">
              Choose a domain and one of its section-based pages above to start organising its
              child pages into columns.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

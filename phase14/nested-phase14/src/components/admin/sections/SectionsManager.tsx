// src/components/admin/sections/SectionsManager.tsx

'use client';

import { useState } from 'react';
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
    <div className="bg-white rounded-lg border border-gray-200">
      
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          🎯 Section Configuration
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Select a section-based page and configure how its child pages are organized into sections.
        </p>
      </div>

      {/* Main Content */}
      <div className="p-6">
        
        {/* Step 1: Domain and Page Selection */}
        <div className="mb-8">
          <DomainPageSelector
            domains={domains}
            selectedDomain={selectedDomain}
            selectedPage={selectedPage}
            onDomainChange={handleDomainChange}
            onPageChange={handlePageChange}
          />
        </div>

        {/* Step 2: Section Configuration Editor */}
        {selectedPage && (
          <div className="border-t border-gray-200 pt-8">
            <SectionEditor
              page={selectedPage}
              domain={selectedDomain!}
              onSectionsUpdate={handleSectionsUpdate}
              isLoading={isLoading}
              saveStatus={saveStatus}
            />
          </div>
        )}

        {/* Empty State */}
        {!selectedPage && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Select a Page to Configure
            </h3>
            <p className="text-gray-600">
              Choose a domain and section-based page above to start organizing its child pages into sections.
            </p>
          </div>
        )}

      </div>

    </div>
  );
}

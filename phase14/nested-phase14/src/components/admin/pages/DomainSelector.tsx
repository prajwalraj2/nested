'use client';

import { useState } from 'react';

/**
 * Domain Selector Component
 * 
 * Simple dropdown for selecting domains in page management.
 * Shows domain type, publication status, and category.
 */

type Domain = {
  id: string;
  name: string;
  slug: string;
  pageType: string;
  isPublished: boolean;
  category: {
    id: string;
    name: string;
    icon: string | null;
  } | null;
};

type DomainSelectorProps = {
  domains: Domain[];
  selectedDomain: Domain | null;
  onDomainChange: (domain: Domain) => void;
};

export function DomainSelector({ domains, selectedDomain, onDomainChange }: DomainSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (domains.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-2xl mb-2">🌐</div>
        <div className="text-sm">No domains available</div>
        <div className="text-xs mt-1">Create a domain first</div>
      </div>
    );
  }

  return (
    <div className="relative">
      
      {/* Selected Domain Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg text-left bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <div className="flex items-center space-x-3">
          {selectedDomain ? (
            <>
              {/* Domain Info */}
              <div className="flex items-center space-x-2">
                {selectedDomain.category?.icon && (
                  <span className="text-lg">{selectedDomain.category.icon}</span>
                )}
                <div>
                  <div className="font-medium text-gray-900">
                    {selectedDomain.name}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center space-x-2">
                    <span>/domain/{selectedDomain.slug}</span>
                    <span>•</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      selectedDomain.pageType === 'direct' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {selectedDomain.pageType === 'direct' ? '🎯 Direct' : '🏗️ Hierarchical'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      selectedDomain.isPublished 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {selectedDomain.isPublished ? '✅ Live' : '📝 Draft'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* No Selection */}
              <div className="flex items-center space-x-2">
                <span className="text-gray-400 text-lg">🌐</span>
                <div>
                  <div className="font-medium text-gray-700">Select a Domain</div>
                  <div className="text-xs text-gray-500">Choose a domain to manage its pages</div>
                </div>
              </div>
            </>
          )}
        </div>
        
        <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          
          {/* Domains List */}
          {domains.map((domain) => (
            <button
              key={domain.id}
              onClick={() => {
                onDomainChange(domain);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 last:border-b-0 ${
                selectedDomain?.id === domain.id ? 'bg-blue-50 border-blue-100' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {domain.category?.icon && (
                    <span className="text-base">{domain.category.icon}</span>
                  )}
                  <div>
                    <div className="font-medium text-gray-900">
                      {domain.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      /domain/{domain.slug}
                    </div>
                    {domain.category && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {domain.category.name}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-1">
                  {/* Domain Type */}
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    domain.pageType === 'direct' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {domain.pageType === 'direct' ? '🎯' : '🏗️'}
                  </span>
                  
                  {/* Publication Status */}
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    domain.isPublished 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {domain.isPublished ? '✅' : '📝'}
                  </span>
                </div>
              </div>
            </button>
          ))}
          
        </div>
      )}
      
      {/* Selected Domain Details */}
      {selectedDomain && (
        <div className="mt-4 bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              {selectedDomain.category?.icon && (
                <span className="text-xl mt-1">{selectedDomain.category.icon}</span>
              )}
              <div>
                <h4 className="font-semibold text-blue-900">
                  {selectedDomain.name}
                </h4>
                <div className="text-sm text-blue-800 space-y-1 mt-1">
                  <div><strong>Category:</strong> {selectedDomain.category?.name || 'Uncategorized'}</div>
                  <div><strong>Type:</strong> {selectedDomain.pageType === 'direct' 
                    ? 'Direct (Auto __main__ page)' 
                    : 'Hierarchical (No auto pages)'
                  }</div>
                  <div><strong>Status:</strong> {selectedDomain.isPublished ? 'Published (Live)' : 'Draft (Hidden)'}</div>
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-xs text-blue-600 font-mono bg-blue-100 px-2 py-1 rounded">
                /domain/{selectedDomain.slug}
              </div>
            </div>
          </div>
          
          {/* Domain Type Explanation */}
          <div className="mt-3 pt-3 border-t border-blue-200">
            <div className="text-xs text-blue-800">
              {selectedDomain.pageType === 'direct' ? (
                <>
                  <strong>📌 Direct Domain Behavior:</strong> When you create pages, they will automatically 
                  use the hidden "__main__" page as their parent. URLs will be clean like /domain/{selectedDomain.slug}/your-page
                </>
              ) : (
                <>
                  <strong>📌 Hierarchical Domain Behavior:</strong> You can create top-level categories 
                  that connect directly to the domain, then build nested pages under them.
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}

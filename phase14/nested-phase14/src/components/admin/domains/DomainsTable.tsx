'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DomainForm } from './DomainForm';

/**
 * Domains Table Component
 * 
 * Displays domains in a comprehensive table with:
 * - Domain name, slug, and preview links
 * - Category information with visual indicators
 * - Page type and publication status
 * - Page count and content indicators
 * - Management actions (edit, delete, publish/unpublish)
 * - Responsive design and mobile optimization
 * - Bulk selection capabilities (future feature)
 * 
 * Table Structure:
 * ┌─ Domain Name ─┬─ Category ─┬─ Type ─┬─ Status ─┬─ Pages ─┬─ Actions ─┐
 * │ 🖌️ Graphic... │ Design     │ Direct │ Live   │ 5      │ [E][D][P] │
 * │ 🌐 Web Dev...  │ Tech       │ Hier   │ Draft  │ 12     │ [E][D][P] │
 * └───────────────┴────────────┴────────┴────────┴────────┴───────────┘
 */

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  columnPosition: number;
};

type Domain = {
  id: string;
  name: string;
  slug: string;
  pageType: string;
  isPublished: boolean;
  orderInCategory: number;
  targetCountries?: string[];
  createdAt: Date;
  category: Category | null;
  pageCount: number;
  previewUrl: string;
};

type DomainsTableProps = {
  domains: Domain[];
  categories: Category[];
};

export function DomainsTable({ domains, categories }: DomainsTableProps) {
  // State for managing domain operations
  const [editingDomain, setEditingDomain] = useState<string | null>(null);
  const [deletingDomain, setDeletingDomain] = useState<string | null>(null);
  const [publishingDomain, setPublishingDomain] = useState<string | null>(null);

  // Find the domain being edited
  const domainToEdit = editingDomain 
    ? domains.find(domain => domain.id === editingDomain) 
    : null;

  return (
    <div className="space-y-4">
      
      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full">
          
          {/* Table Header */}
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Domain
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pages
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          
          {/* Table Body */}
          <tbody className="bg-white divide-y divide-gray-200">
            {domains.length > 0 ? (
              domains.map((domain) => (
                <DomainTableRow
                  key={domain.id}
                  domain={domain}
                  onEdit={() => setEditingDomain(domain.id)}
                  onDelete={() => setDeletingDomain(domain.id)}
                  onPublishToggle={() => setPublishingDomain(domain.id)}
                  isPublishing={publishingDomain === domain.id}
                />
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="text-4xl">🌐</div>
                    <h3 className="text-lg font-medium text-gray-900">No domains found</h3>
                    <p className="text-gray-500">
                      Create your first domain or adjust your filters to see results.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
          
        </table>
      </div>

      {/* Edit Domain Modal */}
      {editingDomain && domainToEdit && (
        <EditDomainModal
          domain={{
            id: domainToEdit.id,
            name: domainToEdit.name,
            slug: domainToEdit.slug,
            pageType: domainToEdit.pageType,
            categoryId: domainToEdit.category?.id || '',
            orderInCategory: domainToEdit.orderInCategory,
            isPublished: domainToEdit.isPublished,
            targetCountries: domainToEdit.targetCountries || ['ALL']
          }}
          categories={categories}
          onSuccess={() => {
            setEditingDomain(null);
            window.location.reload(); // Refresh to show changes
          }}
          onCancel={() => setEditingDomain(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingDomain && (
        <DeleteConfirmationModal
          domainId={deletingDomain}
          domainName={domains.find(d => d.id === deletingDomain)?.name || 'Unknown'}
          onConfirm={() => handleDeleteDomain(deletingDomain)}
          onCancel={() => setDeletingDomain(null)}
        />
      )}
      
    </div>
  );
}

/**
 * Individual Domain Table Row Component
 */
type DomainTableRowProps = {
  domain: Domain;
  onEdit: () => void;
  onDelete: () => void;
  onPublishToggle: () => void;
  isPublishing: boolean;
};

function DomainTableRow({ domain, onEdit, onDelete, onPublishToggle, isPublishing }: DomainTableRowProps) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      
      {/* Domain Name and Preview */}
      <td className="px-6 py-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <span className="text-lg">
              {domain.name.match(/[^\w\s]/) ? domain.name.match(/[^\w\s]/)?.[0] : '🌐'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {domain.name}
              </h3>
              <Link
                href={domain.previewUrl}
                target="_blank"
                className="text-blue-600 hover:text-blue-800 text-xs"
                title="Preview domain"
              >
                🔗
              </Link>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              /domain/{domain.slug}
            </p>
          </div>
        </div>
      </td>

      {/* Category */}
      <td className="px-6 py-4">
        {domain.category ? (
          <div className="flex items-center space-x-2">
            {domain.category.icon && (
              <span className="text-sm">{domain.category.icon}</span>
            )}
            <span className="text-sm text-gray-900">{domain.category.name}</span>
            <span className="text-xs text-gray-400">
              (Col {domain.category.columnPosition})
            </span>
          </div>
        ) : (
          <span className="text-sm text-gray-500 italic">No category</span>
        )}
      </td>

      {/* Page Type */}
      <td className="px-6 py-4">
        <span className={`
          inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
          ${domain.pageType === 'direct' 
            ? 'bg-blue-100 text-blue-800' 
            : 'bg-purple-100 text-purple-800'
          }
        `}>
          {domain.pageType === 'direct' ? '🎯 Direct' : '🏗️ Hierarchical'}
        </span>
      </td>

      {/* Publication Status */}
      <td className="px-6 py-4">
        <div className="flex items-center space-x-2">
          <span className={`
            inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
            ${domain.isPublished 
              ? 'bg-green-100 text-green-800' 
              : 'bg-yellow-100 text-yellow-800'
            }
          `}>
            {domain.isPublished ? '✅ Live' : '📝 Draft'}
          </span>
        </div>
      </td>

      {/* Page Count */}
      <td className="px-6 py-4">
        <div className="flex items-center space-x-1">
          <span className="text-sm font-medium text-gray-900">
            {domain.pageCount}
          </span>
          <span className="text-xs text-gray-500">
            page{domain.pageCount !== 1 ? 's' : ''}
          </span>
        </div>
      </td>

      {/* Actions */}
      <td className="px-6 py-4">
        <div className="flex items-center space-x-2">
          
          {/* Edit Button */}
          <button
            onClick={onEdit}
            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
            title="Edit domain"
          >
            ✏️
          </button>

          {/* Publish/Unpublish Toggle */}
          <button
            onClick={onPublishToggle}
            disabled={isPublishing}
            className={`
              p-1 rounded transition-colors
              ${domain.isPublished 
                ? 'text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50' 
                : 'text-green-600 hover:text-green-800 hover:bg-green-50'
              }
              ${isPublishing ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            title={domain.isPublished ? 'Unpublish domain' : 'Publish domain'}
          >
            {isPublishing ? '⏳' : (domain.isPublished ? '👁️‍🗨️' : '🚀')}
          </button>

          {/* Delete Button */}
          <button
            onClick={onDelete}
            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
            title="Delete domain"
          >
            🗑️
          </button>

          {/* More Actions Menu */}
          <div className="relative">
            <button
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors"
              title="More actions"
            >
              ⋯
            </button>
            {/* TODO: Add dropdown menu for additional actions */}
          </div>
          
        </div>
      </td>
    </tr>
  );
}

/**
 * Edit Domain Modal
 * Shows the domain form in edit mode within a modal overlay
 */
type EditDomainModalProps = {
  domain: {
    id: string;
    name: string;
    slug: string;
    pageType: string;
    categoryId: string;
    orderInCategory: number;
    isPublished: boolean;
    targetCountries?: string[];
  };
  categories: Category[];
  onSuccess: () => void;
  onCancel: () => void;
};

function EditDomainModal({ domain, categories, onSuccess, onCancel }: EditDomainModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                Edit Domain
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Update domain information and settings
              </p>
            </div>
            
            {/* Close Button */}
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close"
            >
              <span className="text-xl text-gray-400">×</span>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="px-6 py-6">
          <DomainForm
            categories={categories}
            domain={domain}
            onSuccess={onSuccess}
            onCancel={onCancel}
          />
        </div>
        
      </div>
    </div>
  );
}

/**
 * Delete Confirmation Modal
 * Confirms domain deletion with warning about pages
 */
type DeleteConfirmationModalProps = {
  domainId: string;
  domainName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

function DeleteConfirmationModal({ domainId, domainName, onConfirm, onCancel }: DeleteConfirmationModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-mx mx-4">
        <div className="flex items-center mb-4">
          <span className="text-2xl mr-3">⚠️</span>
          <h3 className="text-lg font-semibold text-gray-900">
            Delete Domain
          </h3>
        </div>
        
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete "<strong>{domainName}</strong>"? This action cannot be undone. 
          All pages and content associated with this domain will also be deleted.
        </p>
        
        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete Domain
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Handle domain deletion
 * TODO: Implement actual API call
 */
async function handleDeleteDomain(domainId: string) {
  try {
    const response = await fetch(`/api/admin/domains/${domainId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete domain');
    }
    
    // Success - refresh page to show changes
    window.location.reload();
    
  } catch (error) {
    console.error('Error deleting domain:', error);
    alert('Failed to delete domain. Please try again.');
  }
}

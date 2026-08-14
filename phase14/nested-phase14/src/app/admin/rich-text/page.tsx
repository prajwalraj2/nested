// src/app/admin/rich-text/page.tsx

import { RichTextManager } from '@/components/admin/rich-text/RichTextManager';

/**
 * Main Rich Text Management Page
 * 
 * Features:
 * - Domain selection dropdown
 * - Automatic page filtering (contentType = "rich_text")
 * - List view of rich text pages
 * - Quick edit access for each page
 * - Create new rich text content
 */

export default function RichTextAdminPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📝 Rich Text Content Management
          </h1>
          <p className="text-gray-600">
            Create and manage HTML content for rich text pages across all domains.
          </p>
        </div>

        {/* Main Management Interface */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <RichTextManager />
        </div>
      </div>
    </div>
  );
}

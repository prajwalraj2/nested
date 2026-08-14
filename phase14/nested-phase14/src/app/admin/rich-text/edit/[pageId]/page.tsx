// src/app/admin/rich-text/edit/[pageId]/page.tsx

import { HtmlEditor } from '@/components/admin/rich-text/HtmlEditor';

interface PageParams {
  params: Promise<{
    pageId: string;
  }>;
}

/**
 * Rich Text HTML Editor Page
 * 
 * Features:
 * - Load existing content for the specified page
 * - Large HTML textarea for direct editing
 * - Auto-save functionality
 * - Live preview option
 * - Word count and content statistics
 * - Quick formatting helpers
 */

export default async function RichTextEditorPage({ params }: PageParams) {
  const { pageId } = await params;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <a 
              href="/admin/rich-text" 
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <span>←</span>
              <span>Back to Rich Text Management</span>
            </a>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ✏️ HTML Content Editor
          </h1>
          <p className="text-gray-600">
            Edit HTML content directly with full control over styling and layout.
          </p>
        </div>

        {/* Editor Interface */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <HtmlEditor pageId={pageId} />
        </div>
      </div>
    </div>
  );
}

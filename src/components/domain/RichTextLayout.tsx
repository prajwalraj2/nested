// components/domain/RichTextLayout.tsx

import Link from 'next/link';

type Domain = {
  id: string;
  name: string;
  slug: string;
};

type RichTextContent = {
  id: string;
  htmlContent: string;
  title: string | null;
  wordCount: number;
  updatedAt: Date;
};

type Page = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  richTextContent?: RichTextContent | null;
};

type RichTextLayoutProps = {
  page: Page;
  domain: Domain;
};

export function RichTextLayout({ page, domain }: RichTextLayoutProps) {
  const hasContent = page.richTextContent?.htmlContent;
  
  return (
    
    <div className="min-h-screen bg-[#2f2f2f] text-white">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
            <span>{domain.name}</span>
            <span>/</span>
            <span className="text-white">{page.title}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">{page.title}</h1>
            <Link 
              href={`/admin/rich-text/edit/${page.id}`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
            >
              ✏️ Edit Content
            </Link>
          </div>
        </div>

        {/* Rich Text Content */}
        <div className="bg-[#3a3a3a] rounded-lg border border-gray-600">
          {hasContent ? (
            <>
              {/* Content Header */}
              {page.richTextContent?.title && (
                <div className="p-6 pb-0">
                  <h2 className="text-2xl font-semibold text-blue-400 mb-4">
                    {page.richTextContent.title}
                  </h2>
                </div>
              )}
              
              {/* Main Content */}
              <div className="p-8">
                <div 
                  className="rich-text-content prose prose-invert max-w-none [&>div]:space-y-4"
                  dangerouslySetInnerHTML={{ 
                    __html: page.richTextContent!.htmlContent 
                  }}
                />
              </div>

              {/* Content Footer */}
              <div className="px-8 pb-6">
                <div className="flex items-center justify-between pt-6 border-t border-gray-600">
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span>📊 {page.richTextContent!.wordCount} words</span>
                    <span>•</span>
                    <span>🕒 Updated {page.richTextContent!.updatedAt.toLocaleDateString()}</span>
                  </div>
                  <Link 
                    href={`/admin/rich-text/edit/${page.id}`}
                    className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                  >
                    ✏️ Edit
                  </Link>
                </div>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="p-12 text-center">
              <div className="text-gray-400 text-6xl mb-4">📝</div>
              <h2 className="text-xl font-semibold text-gray-300 mb-3">
                No Content Yet
              </h2>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                This rich text page is ready for content. Click the button below 
                to start adding your HTML content with full styling control.
              </p>
              <Link 
                href={`/admin/rich-text/edit/${page.id}`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <span>✨</span>
                <span>Add Content</span>
              </Link>
            </div>
          )}
        </div>

        {/* Page Info */}
        <div className="mt-8 p-4 bg-gray-800 rounded text-xs text-gray-400">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="text-gray-500">Page ID:</span>
              <div className="font-mono">{page.id}</div>
            </div>
            <div>
              <span className="text-gray-500">Content Type:</span>
              <div className="capitalize">{page.contentType.replace('_', ' ')}</div>
            </div>
            <div>
              <span className="text-gray-500">Domain:</span>
              <div>{domain.slug}</div>
            </div>
            <div>
              <span className="text-gray-500">Status:</span>
              <div className={hasContent ? 'text-green-400' : 'text-orange-400'}>
                {hasContent ? '✅ Has Content' : '📝 Empty'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
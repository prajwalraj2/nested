// components/domain/RichTextLayout.tsx

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
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <h1 className="text-3xl font-bold text-foreground">{page.title}</h1>
        <div className="border-b border-gray-300 mb-10 mt-1" style={{ borderBottomWidth: '1px' }}></div>

        {/* Rich Text Content */}
        <div className="border border-border rounded-lg p-8 bg-gray-100">
          {hasContent ? (
            <div className="prose prose-neutral dark:prose-invert max-w-none">
              <div 
                className="rich-text-content [&>div]:space-y-4"
                dangerouslySetInnerHTML={{ 
                  __html: page.richTextContent!.htmlContent 
                }}
              />
            </div>
          ) : (
            /* Empty State */
            <div className="py-12 text-center">
              <div className="text-6xl mb-4">📝</div>
              <h2 className="text-xl font-semibold text-foreground mb-3">
                Data Coming Soon
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                We are working on getting the right data.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

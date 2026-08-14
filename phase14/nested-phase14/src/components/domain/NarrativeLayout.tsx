// src/components/domain/NarrativeLayout.tsx

import Link from 'next/link';

// Types
type DomainWithPages = {
  id: string;
  name: string;
  slug: string;
  pageType: string;
  pages: any[];
};

type PageWithContent = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  content: any[];
  subPages: any[];
};

// Narrative Layout (traditional pages)
export function NarrativeLayout({ page, domain }: {
  page: PageWithContent;
  domain: DomainWithPages;
}) {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-6">{page.title}</h1>
        
        <div className="prose prose-lg max-w-none">
          {page.content.map((block: any) => (
            <ContentRenderer key={block.id} block={block} />
          ))}
        </div>

        {/* Child Pages */}
        {page.subPages.length > 0 && (
          <div className="mt-12 border-t border-slate-200 pt-8">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">
              Related Pages
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {page.subPages.map((subPage: any) => (
                <Link
                  key={subPage.id}
                  href={`/domain/${domain.slug}/${page.slug}/${subPage.slug}`}
                  className="block p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all"
                >
                  <h3 className="font-semibold text-slate-800">{subPage.title}</h3>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Content Renderer for individual blocks
function ContentRenderer({ block }: { block: any }) {
  switch (block.type) {
    case 'HEADING':
      return <h2 className="text-2xl font-bold text-slate-800 mb-4">{block.content.text}</h2>;
    
    case 'PARAGRAPH':
      return <p className="text-slate-700 leading-relaxed mb-4">{block.content.text}</p>;
    
    case 'BULLETLIST':
      return (
        <ul className="list-disc list-inside space-y-2 text-slate-700 mb-4">
          {block.content.items?.map((item: string, index: number) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      );
    
    case 'LINK_BUTTON':
      return (
        <Link 
          href={block.content.url || '#'} 
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 shadow-sm hover:shadow-md mb-4"
        >
          {block.content.text}
        </Link>
      );

    case 'QUOTE':
      return (
        <blockquote className="border-l-4 border-blue-500 pl-6 py-4 bg-blue-50 rounded-r-lg mb-4">
          <p className="text-slate-800 italic text-lg">{block.content.text}</p>
          {block.content.author && (
            <cite className="block mt-2 text-slate-600 text-sm">— {block.content.author}</cite>
          )}
        </blockquote>
      );

    case 'IMAGE':
      return (
        <div className="mb-6">
          <img 
            src={block.content.url} 
            alt={block.content.alt || ''} 
            className="max-w-full h-auto rounded-lg shadow-sm"
          />
          {block.content.caption && (
            <p className="text-sm text-slate-600 mt-2 text-center italic">
              {block.content.caption}
            </p>
          )}
        </div>
      );
    
    default:
      return (
        <div className="text-slate-500 bg-slate-100 p-4 rounded border-dashed border-2 mb-4">
          <p className="text-sm">Unsupported content type: <strong>{block.type}</strong></p>
        </div>
      );
  }
}

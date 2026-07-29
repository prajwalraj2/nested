// components/domain/TableLayout.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { DataTable } from '@/components/table/DataTable';
import { Skeleton } from '@/components/ui/skeleton';
// Synchronous, validated cookie reader — NOT the useUserCountry() hook. Same reasoning
// as buildPageContextUrl in src/hooks/usePageContext.ts: the hook returns
// DEFAULT_COUNTRY on first render and corrects itself in an effect, so a fetch built
// from it would either use the wrong country or fire twice. `document.cookie` is
// synchronous, so the very first request already carries the right value.
import { getUserCountryFromCookie } from '@/hooks/useUserCountry';
import type { TableSchema, TableData, ColumnType } from '@/types/table';

/**
 * Build the table-data URL with the visitor's country in the QUERY STRING.
 *
 * ⚠️ THE `country` PARAM IS WHAT MAKES THE RESPONSE CACHEABLE — it is not cosmetic.
 *
 * The route sends shared CDN cache headers only when it sees a recognised `country` in
 * the URL. Omit it and the route falls back to reading the cookie, which it must then
 * mark `private, no-store`, because a cookie-derived response cannot be shared between
 * visitors. Correct either way — just uncached, which for the ~666 table pages means a
 * function invocation plus a database round trip on every single view.
 *
 * `getUserCountryFromCookie` validates against SUPPORTED_COUNTRIES, so a junk cookie
 * value degrades to DEFAULT_COUNTRY rather than minting a useless cache entry.
 */
function buildTableDataUrl(pageId: string): string {
  const country = getUserCountryFromCookie(
    typeof document === 'undefined' ? null : document.cookie
  );
  return `/api/domain/tables/by-page/${pageId}?country=${encodeURIComponent(country)}`;
}

type Domain = {
  id: string;
  name: string;
  slug: string;
};

type Page = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  content: any[];
  subPages: any[];
};

type TableWithData = {
  id: string;
  name: string;
  schema: TableSchema;
  data: TableData;
  settings?: any;
};

type TableLayoutProps = {
  page: Page;
  domain: Domain;
};

export function TableLayout({ page, domain }: TableLayoutProps) {
  const [tableData, setTableData] = useState<TableWithData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch table data for this page
  useEffect(() => {
    async function fetchTableData() {
      try {
        setIsLoading(true);
        setError(null);

        // `country` is passed EXPLICITLY in the URL so the response is CDN-cacheable —
        // see buildTableDataUrl above for why that matters.
        const response = await fetch(buildTableDataUrl(page.id));


        if (!response.ok) {
          if (response.status === 404) {
            setError('No table found for this page');
          } else {
            setError('Failed to load table data');
          }
          return;
        }

        const result = await response.json();
        setTableData(result.table);

      } catch (err) {
        console.error('Error fetching table data:', err);
        setError('Failed to load table data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTableData();
  }, [page.id]); 


  
  // Loading state - with skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <h1 className="text-3xl font-bold text-foreground">{page.title}</h1>
          <div className="border-b border-gray-300 mb-6 mt-1" style={{ borderBottomWidth: '1px' }}></div>

          {/* Table skeleton */}
          <div className="rounded-lg border border-border overflow-hidden">
            {/* Toolbar skeleton */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-[200px]" />
                  <Skeleton className="h-9 w-32" />
                </div>
                <Skeleton className="h-9 w-20" />
              </div>
            </div>
            
            {/* Table columns header skeleton */}
            <div className="border-b border-border bg-muted/50">
              <div className="flex items-center p-3 gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            
            {/* Table rows skeleton */}
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="border-b border-border/50 last:border-b-0">
                <div className="flex items-center p-3 gap-4">
                  <Skeleton className={`h-4 ${
                    i % 3 === 0 ? 'w-[140px]' : i % 2 === 0 ? 'w-[180px]' : 'w-[120px]'
                  }`} />
                  <Skeleton className={`h-4 ${
                    i % 3 === 0 ? 'w-[160px]' : i % 2 === 0 ? 'w-[200px]' : 'w-[180px]'
                  }`} />
                  <Skeleton className="h-5 w-16 rounded-sm" />
                  <Skeleton className={`h-4 ${
                    i % 3 === 0 ? 'w-[200px]' : i % 2 === 0 ? 'w-[160px]' : 'w-[180px]'
                  }`} />
                </div>
              </div>
            ))}
            
            {/* Pagination skeleton */}
            <div className="p-4 border-t border-border">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold text-foreground">{page.title}</h1>
          <div className="border-b border-gray-300 mb-6 mt-1" style={{ borderBottomWidth: '1px' }}></div>

          <div className="rounded-lg p-6 border border-border">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <h3 className="text-xl font-semibold text-foreground mb-2">Data Coming Soon</h3>
                <p className="text-muted-foreground">We are working on getting Data.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No table data
  if (!tableData) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold text-foreground">{page.title}</h1>
          <div className="border-b border-gray-300 mb-6 mt-1" style={{ borderBottomWidth: '1px' }}></div>

          <div className="rounded-lg p-6 border border-border">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="text-4xl mb-4">📊</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">No Table Data</h3>
                <p className="text-muted-foreground">This page doesn't have a table configured yet.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <h1 className="text-3xl font-bold text-foreground">{page.title}</h1>
        <div className="border-b border-gray-300 mt-1 mb-15" style={{ borderBottomWidth: '1px' }}></div>

        {/* Professional DataTable from DataTable.tsx */}
        <DataTable
          schema={tableData.schema}
          data={tableData.data}
        />
      </div>
    </div>
  );
}

// components/domain/TableLayout.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { DataTable } from '@/components/table/DataTable';
import { Skeleton } from '@/components/ui/skeleton';
import type { TableSchema, TableData, ColumnType } from '@/types/table';

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

        // Fetch table data from API
        const response = await fetch(`/api/domain/tables/by-page/${page.id}`);

        

        if (!response.ok) {
          if (response.status === 404) {
            setError('No table found for this page');
          } else {
            setError('Failed to load table data');
          }
          return;
        }

        const result = await response.json();
        // console.log("result in table layout", result);
        // Output:
        /*
        result in table layout
        {
          "table": {
              "id": "3067c4c5-63fa-4703-8d98-00c7faa396a9",
              "name": "▶️ YouTube Channel Table",
              "schema": {
                  "columns": [
                      {
                          "id": "col_1",
                          "name": "YouTube Channel ",
                          "type": "text",
                          "align": "left",
                          "required": false,
                          "sortable": true,
                          "filterable": true,
                          "searchable": true,
                          "validation": []
                      },
                      {
                          "id": "col_2",
                          "name": "Channel Link",
                          "type": "link",
                          "align": "left",
                          "required": false,
                          "sortable": true,
                          "filterable": true,
                          "searchable": true,
                          "validation": []
                      },
                      {
                          "id": "col_3",
                          "name": "Language",
                          "type": "badge",
                          "align": "left",
                          "required": false,
                          "sortable": true,
                          "filterable": true,
                          "searchable": true,
                          "validation": []
                      },
                      {
                          "id": "col_4",
                          "name": "Channel Description",
                          "type": "description",
                          "align": "left",
                          "required": false,
                          "sortable": true,
                          "filterable": true,
                          "searchable": true,
                          "validation": []
                      }
                  ],
                  "version": 1,
                  "createdAt": "2025-10-14T07:46:09.635Z",
                  "updatedAt": "2025-10-14T07:50:25.468Z"
              },
              "data": {
                  "rows": [
                      {
                          "id": "row_1_1760428566773",
                          "col_1": "TechExplained",
                          "col_2": "https://youtube.com/techexplained",
                          "col_3": "Spanish",
                          "col_4": "Channel dedicated to tech reviews and tutorials."
                      },
                      {
                          "id": "row_2_1760428566773",
                          "col_1": "CookingWithAmy",
                          "col_2": "https://youtube.com/cookingwithamy",
                          "col_3": "Spanish",
                          "col_4": "Explore delicious recipes and cooking tips."
                      },
                      {
                          "id": "row_3_1760428566773",
                          "col_1": "TravelVibes",
                          "col_2": "https://youtube.com/travelvibes",
                          "col_3": "German",
                          "col_4": "Join us on adventures around the world."
                      },
                      {
                          "id": "row_4_1760428566773",
                          "col_1": "DailyFitness",
                          "col_2": "https://youtube.com/dailyfitness",
                          "col_3": "German",
                          "col_4": "Daily workout routines and fitness tips."
                      },
                      {
                          "id": "row_5_1760428566773",
                          "col_1": "MindMatters",
                          "col_2": "https://youtube.com/mindmatters",
                          "col_3": "French",
                          "col_4": "Understanding the human mind and behavior."
                      },
                      {
                          "id": "row_6_1760428566773",
                          "col_1": "GameVerse",
                          "col_2": "https://youtube.com/gameverse",
                          "col_3": "Arabic",
                          "col_4": "Latest gaming news and walkthroughs."
                      },
                      {
                          "id": "row_7_1760428566773",
                          "col_1": "DIYPro",
                          "col_2": "https://youtube.com/diypro",
                          "col_3": "Chinese",
                          "col_4": "Creative DIY projects and home hacks."
                      },
                      {
                          "id": "row_8_1760428566773",
                          "col_1": "NewsNow",
                          "col_2": "https://youtube.com/newsnow",
                          "col_3": "Arabic",
                          "col_4": "Breaking news and current events."
                      },
                      {
                          "id": "row_9_1760428566773",
                          "col_1": "CodeAcademy",
                          "col_2": "https://youtube.com/codeacademy",
                          "col_3": "French",
                          "col_4": "Learn programming with interactive tutorials."
                      },
                      {
                          "id": "row_10_1760428566773",
                          "col_1": "MusicBox",
                          "col_2": "https://youtube.com/musicbox",
                          "col_3": "Hindi",
                          "col_4": "Your daily dose of music and playlists."
                      },
                      {
                          "id": "row_11_1760428566773",
                          "col_1": "FilmReviewHub",
                          "col_2": "https://youtube.com/filmreviewhub",
                          "col_3": "German",
                          "col_4": "In-depth movie and TV show reviews."
                      },
                      {
                          "id": "row_12_1760428566773",
                          "col_1": "StudySmart",
                          "col_2": "https://youtube.com/studysmart",
                          "col_3": "English",
                          "col_4": "Smart studying tips and academic help."
                      },
                      {
                          "id": "row_13_1760428566773",
                          "col_1": "CraftyCorner",
                          "col_2": "https://youtube.com/craftycorner",
                          "col_3": "French",
                          "col_4": "Fun arts and crafts for all ages."
                      },
                      {
                          "id": "row_14_1760428566773",
                          "col_1": "HistoryNuggets",
                          "col_2": "https://youtube.com/historynuggets",
                          "col_3": "Arabic",
                          "col_4": "History facts and educational content."
                      },
                      {
                          "id": "row_15_1760428566773",
                          "col_1": "AutoWorld",
                          "col_2": "https://youtube.com/autoworld",
                          "col_3": "Hindi",
                          "col_4": "Everything about cars and auto tech."
                      },
                      {
                          "id": "row_16_1760428566773",
                          "col_1": "GadgetGeek",
                          "col_2": "https://youtube.com/gadgetgeek",
                          "col_3": "French",
                          "col_4": "Unboxing and reviewing the latest gadgets."
                      },
                      {
                          "id": "row_17_1760428566773",
                          "col_1": "NatureScope",
                          "col_2": "https://youtube.com/naturescope",
                          "col_3": "Chinese",
                          "col_4": "Discover the beauty of nature and wildlife."
                      },
                      {
                          "id": "row_18_1760428566773",
                          "col_1": "ArtSphere",
                          "col_2": "https://youtube.com/artsphere",
                          "col_3": "Chinese",
                          "col_4": "Art tutorials, gallery showcases, and more."
                      },
                      {
                          "id": "row_19_1760428566773",
                          "col_1": "Finance101",
                          "col_2": "https://youtube.com/finance101",
                          "col_3": "French",
                          "col_4": "Basic to advanced finance lessons."
                      },
                      {
                          "id": "row_20_1760428566773",
                          "col_1": "HealthMatters",
                          "col_2": "https://youtube.com/healthmatters",
                          "col_3": "Arabic",
                          "col_4": "Health and wellness explained."
                      }
                  ],
                  "metadata": {
                      "totalRows": 20,
                      "lastUpdated": "2025-10-14T07:56:06.773Z",
                      "importSource": "csv"
                  }
              },
              "settings": {
                  "ui": {
                      "density": "normal",
                      "showBorders": true,
                      "stickyHeader": true,
                      "alternatingRows": true
                  },
                  "export": {
                      "enabled": true,
                      "formats": [
                          "csv",
                          "json"
                      ]
                  },
                  "sorting": {
                      "enabled": true,
                      "multiSort": false
                  },
                  "filtering": {
                      "enabled": true,
                      "globalSearch": true,
                      "columnFilters": true,
                      "advancedFilters": false
                  },
                  "pagination": {
                      "enabled": true,
                      "pageSize": 25,
                      "showInfo": true,
                      "showSizeSelector": true
                  },
                  "responsive": {
                      "enabled": true,
                      "breakpoint": "md",
                      "hideColumns": [],
                      "stackColumns": false
                  }
              },
              "updatedAt": "2025-10-14T07:56:39.515Z",
              "page": {
                  "id": "88a9bf4d-0897-42ba-9c29-16b56e5cca73",
                  "title": "▶️ YouTube Channel",
                  "slug": "ytube",
                  "contentType": "table",
                  "domain": {
                      "id": "d9a88a1e-39fe-47e1-bcf2-5e13f4647055",
                      "name": "🖌️ Graphic Designing",
                      "slug": "gdesign"
                  }
              }
          }
      }
        */
        setTableData(result.table);
        // console.log("table data in table layout", result.table);
        // Output:
        /*
        table data in table layout
        {
              "id": "3067c4c5-63fa-4703-8d98-00c7faa396a9",
              "name": "▶️ YouTube Channel Table",
              "schema": {
                  "columns": [
                      {
                          "id": "col_1",
                          "name": "YouTube Channel ",
                          "type": "text",
                          "align": "left",
                          "required": false,
                          "sortable": true,
                          "filterable": true,
                          "searchable": true,
                          "validation": []
                      },
                      {
                          "id": "col_2",
                          "name": "Channel Link",
                          "type": "link",
                          "align": "left",
                          "required": false,
                          "sortable": true,
                          "filterable": true,
                          "searchable": true,
                          "validation": []
                      },
                      {
                          "id": "col_3",
                          "name": "Language",
                          "type": "badge",
                          "align": "left",
                          "required": false,
                          "sortable": true,
                          "filterable": true,
                          "searchable": true,
                          "validation": []
                      },
                      {
                          "id": "col_4",
                          "name": "Channel Description",
                          "type": "description",
                          "align": "left",
                          "required": false,
                          "sortable": true,
                          "filterable": true,
                          "searchable": true,
                          "validation": []
                      }
                  ],
                  "version": 1,
                  "createdAt": "2025-10-14T07:46:09.635Z",
                  "updatedAt": "2025-10-14T07:50:25.468Z"
              },
              "data": {
                  "rows": [
                      {
                          "id": "row_1_1760428566773",
                          "col_1": "TechExplained",
                          "col_2": "https://youtube.com/techexplained",
                          "col_3": "Spanish",
                          "col_4": "Channel dedicated to tech reviews and tutorials."
                      },
                      {
                          "id": "row_2_1760428566773",
                          "col_1": "CookingWithAmy",
                          "col_2": "https://youtube.com/cookingwithamy",
                          "col_3": "Spanish",
                          "col_4": "Explore delicious recipes and cooking tips."
                      },
                      {
                          "id": "row_3_1760428566773",
                          "col_1": "TravelVibes",
                          "col_2": "https://youtube.com/travelvibes",
                          "col_3": "German",
                          "col_4": "Join us on adventures around the world."
                      },
                      {
                          "id": "row_4_1760428566773",
                          "col_1": "DailyFitness",
                          "col_2": "https://youtube.com/dailyfitness",
                          "col_3": "German",
                          "col_4": "Daily workout routines and fitness tips."
                      },
                      {
                          "id": "row_5_1760428566773",
                          "col_1": "MindMatters",
                          "col_2": "https://youtube.com/mindmatters",
                          "col_3": "French",
                          "col_4": "Understanding the human mind and behavior."
                      },
                      {
                          "id": "row_6_1760428566773",
                          "col_1": "GameVerse",
                          "col_2": "https://youtube.com/gameverse",
                          "col_3": "Arabic",
                          "col_4": "Latest gaming news and walkthroughs."
                      },
                      {
                          "id": "row_7_1760428566773",
                          "col_1": "DIYPro",
                          "col_2": "https://youtube.com/diypro",
                          "col_3": "Chinese",
                          "col_4": "Creative DIY projects and home hacks."
                      },
                      {
                          "id": "row_8_1760428566773",
                          "col_1": "NewsNow",
                          "col_2": "https://youtube.com/newsnow",
                          "col_3": "Arabic",
                          "col_4": "Breaking news and current events."
                      },
                      {
                          "id": "row_9_1760428566773",
                          "col_1": "CodeAcademy",
                          "col_2": "https://youtube.com/codeacademy",
                          "col_3": "French",
                          "col_4": "Learn programming with interactive tutorials."
                      },
                      {
                          "id": "row_10_1760428566773",
                          "col_1": "MusicBox",
                          "col_2": "https://youtube.com/musicbox",
                          "col_3": "Hindi",
                          "col_4": "Your daily dose of music and playlists."
                      },
                      {
                          "id": "row_11_1760428566773",
                          "col_1": "FilmReviewHub",
                          "col_2": "https://youtube.com/filmreviewhub",
                          "col_3": "German",
                          "col_4": "In-depth movie and TV show reviews."
                      },
                      {
                          "id": "row_12_1760428566773",
                          "col_1": "StudySmart",
                          "col_2": "https://youtube.com/studysmart",
                          "col_3": "English",
                          "col_4": "Smart studying tips and academic help."
                      },
                      {
                          "id": "row_13_1760428566773",
                          "col_1": "CraftyCorner",
                          "col_2": "https://youtube.com/craftycorner",
                          "col_3": "French",
                          "col_4": "Fun arts and crafts for all ages."
                      },
                      {
                          "id": "row_14_1760428566773",
                          "col_1": "HistoryNuggets",
                          "col_2": "https://youtube.com/historynuggets",
                          "col_3": "Arabic",
                          "col_4": "History facts and educational content."
                      },
                      {
                          "id": "row_15_1760428566773",
                          "col_1": "AutoWorld",
                          "col_2": "https://youtube.com/autoworld",
                          "col_3": "Hindi",
                          "col_4": "Everything about cars and auto tech."
                      },
                      {
                          "id": "row_16_1760428566773",
                          "col_1": "GadgetGeek",
                          "col_2": "https://youtube.com/gadgetgeek",
                          "col_3": "French",
                          "col_4": "Unboxing and reviewing the latest gadgets."
                      },
                      {
                          "id": "row_17_1760428566773",
                          "col_1": "NatureScope",
                          "col_2": "https://youtube.com/naturescope",
                          "col_3": "Chinese",
                          "col_4": "Discover the beauty of nature and wildlife."
                      },
                      {
                          "id": "row_18_1760428566773",
                          "col_1": "ArtSphere",
                          "col_2": "https://youtube.com/artsphere",
                          "col_3": "Chinese",
                          "col_4": "Art tutorials, gallery showcases, and more."
                      },
                      {
                          "id": "row_19_1760428566773",
                          "col_1": "Finance101",
                          "col_2": "https://youtube.com/finance101",
                          "col_3": "French",
                          "col_4": "Basic to advanced finance lessons."
                      },
                      {
                          "id": "row_20_1760428566773",
                          "col_1": "HealthMatters",
                          "col_2": "https://youtube.com/healthmatters",
                          "col_3": "Arabic",
                          "col_4": "Health and wellness explained."
                      }
                  ],
                  "metadata": {
                      "totalRows": 20,
                      "lastUpdated": "2025-10-14T07:56:06.773Z",
                      "importSource": "csv"
                  }
              },
              "settings": {
                  "ui": {
                      "density": "normal",
                      "showBorders": true,
                      "stickyHeader": true,
                      "alternatingRows": true
                  },
                  "export": {
                      "enabled": true,
                      "formats": [
                          "csv",
                          "json"
                      ]
                  },
                  "sorting": {
                      "enabled": true,
                      "multiSort": false
                  },
                  "filtering": {
                      "enabled": true,
                      "globalSearch": true,
                      "columnFilters": true,
                      "advancedFilters": false
                  },
                  "pagination": {
                      "enabled": true,
                      "pageSize": 25,
                      "showInfo": true,
                      "showSizeSelector": true
                  },
                  "responsive": {
                      "enabled": true,
                      "breakpoint": "md",
                      "hideColumns": [],
                      "stackColumns": false
                  }
              },
              "updatedAt": "2025-10-14T07:56:39.515Z",
              "page": {
                  "id": "88a9bf4d-0897-42ba-9c29-16b56e5cca73",
                  "title": "▶️ YouTube Channel",
                  "slug": "ytube",
                  "contentType": "table",
                  "domain": {
                      "id": "d9a88a1e-39fe-47e1-bcf2-5e13f4647055",
                      "name": "🖌️ Graphic Designing",
                      "slug": "gdesign"
                  }
              }
          }
        */

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

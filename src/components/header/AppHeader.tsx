'use client';

import Link from 'next/link';
import { useHeaderDataFromContext } from '@/contexts/PageContextProvider';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';

export default function AppHeader() {
  const { data, loading, error } = useHeaderDataFromContext();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4 h-16 flex items-center">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <div className="font-bold text-2xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            ATNO
          </div>
        </Link>

        {/* Navigation */}
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger className="flex items-center space-x-1">
                <span>Domains</span>
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="w-[800px] p-6">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-sm text-muted-foreground">Loading domains...</div>
                    </div>
                  ) : error ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-sm text-red-500">Failed to load domains</div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-6">
                      {[1, 2, 3].map(columnNumber => (
                        <div key={columnNumber} className="space-y-4">
                          {data.columnData[columnNumber]?.map((categoryGroup) => (
                            <CategorySection 
                              key={categoryGroup.category.id}
                              categoryGroup={categoryGroup}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Footer */}
                  {!loading && !error && (
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{data.totalDomains} domains across {data.totalCategories} categories</span>
                        <Link 
                          href="/domain" 
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View all domains →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </header>
  );
}

// Category Section Component
function CategorySection({ categoryGroup }: { categoryGroup: any }) {
  const { category, domains } = categoryGroup;

  return (
    <div className="space-y-2">
      {/* Category Header */}
      <div className="flex items-center space-x-2 pb-2 border-b border-gray-100">
        <span className="text-lg">{category.icon || '📁'}</span>
        <h4 className="font-semibold text-sm text-gray-900">
          {category.name}
        </h4>
      </div>

      {/* Domain Links */}
      <div className="space-y-1">
        {domains.length > 0 ? (
          domains.map((domain: any) => (
            <NavigationMenuLink key={domain.id} asChild>
              <Link
                href={domain.url}
                className="block px-2 py-1.5 text-sm text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              >
                {domain.name}
              </Link>
            </NavigationMenuLink>
          ))
        ) : (
          <div className="px-2 py-1.5 text-xs text-gray-400 italic">
            No domains yet
          </div>
        )}
      </div>
    </div>
  );
}

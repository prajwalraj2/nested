'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_COUNTRY, SUPPORTED_COUNTRIES, type SupportedCountry } from '@/lib/countries';

/**
 * Hook to get the user's country from the cookie set by middleware
 * 
 * @returns The user's country code (e.g., "IN", "US", "GB")
 * 
 * @example
 * const userCountry = useUserCountry();
 * console.log(userCountry); // "IN"
 */
export function useUserCountry(): string {
  const [country, setCountry] = useState<string>(DEFAULT_COUNTRY);

  useEffect(() => {
    // Get country from cookie
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith('user-country='))
      ?.split('=')[1];
    
    if (cookieValue && SUPPORTED_COUNTRIES.includes(cookieValue as SupportedCountry)) {
      setCountry(cookieValue);
    }
  }, []);

  return country;
}

/**
 * Get user country on the server side (from cookies)
 * Use this in Server Components or API routes
 * 
 * @param cookieHeader - The cookie header string from the request
 * @returns The user's country code
 */
export function getUserCountryFromCookie(cookieHeader: string | null): string {
  if (!cookieHeader) return DEFAULT_COUNTRY;
  
  const cookies = cookieHeader.split('; ');
  const countryPair = cookies.find(c => c.startsWith('user-country='));
  
  if (!countryPair) return DEFAULT_COUNTRY;
  
  const country = countryPair.split('=')[1];
  
  if (SUPPORTED_COUNTRIES.includes(country as SupportedCountry)) {
    return country;
  }
  
  return DEFAULT_COUNTRY;
}


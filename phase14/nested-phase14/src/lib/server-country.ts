/**
 * Server-side country detection utilities
 * 
 * Used to get user's country from cookies in server components and API routes
 */

import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { DEFAULT_COUNTRY, ALL_COUNTRIES } from './countries';

/**
 * Get user's country from cookies (for Server Components)
 * 
 * @returns The user's country code or default country
 */
export async function getUserCountryFromCookies(): Promise<string> {
  const cookieStore = await cookies();
  const userCountry = cookieStore.get('user-country')?.value;
  return userCountry || DEFAULT_COUNTRY;
}

/**
 * Get user's country from request (for API Routes)
 * 
 * @param request - NextRequest object
 * @returns The user's country code or default country
 */
export function getUserCountryFromRequest(request: NextRequest): string {
  const userCountry = request.cookies.get('user-country')?.value;
  return userCountry || DEFAULT_COUNTRY;
}

/**
 * Build Prisma where clause for filtering by target countries
 * 
 * This creates the OR condition to match either:
 * - targetCountries contains 'ALL' (visible to everyone)
 * - targetCountries contains the user's specific country
 * 
 * @param userCountry - The user's country code
 * @returns Prisma where clause object
 */
export function buildCountryFilter(userCountry: string) {
  return {
    OR: [
      { targetCountries: { has: ALL_COUNTRIES } },
      { targetCountries: { has: userCountry } }
    ]
  };
}

/**
 * Check if content is visible to a user based on targetCountries
 * 
 * @param targetCountries - Array of country codes the content is targeted to
 * @param userCountry - The user's country code
 * @returns true if content should be shown to the user
 */
export function isContentVisibleToUser(
  targetCountries: string[] | undefined | null,
  userCountry: string
): boolean {
  // If no target countries specified, show to everyone
  if (!targetCountries || targetCountries.length === 0) {
    return true;
  }
  
  // Show if "ALL" is in target countries
  if (targetCountries.includes(ALL_COUNTRIES)) {
    return true;
  }
  
  // Show if user's country is in target countries
  return targetCountries.includes(userCountry);
}


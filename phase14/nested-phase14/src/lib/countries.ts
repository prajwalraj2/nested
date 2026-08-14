/**
 * Geo-targeting country configuration
 * 
 * This file contains all country-related constants and helper functions
 * for filtering content based on user's location.
 */

// Supported country codes (ISO 3166-1 alpha-2)
export const SUPPORTED_COUNTRIES = ['IN', 'US', 'GB', 'AU', 'CA'] as const;

// Default country when detection fails or country not supported
export const DEFAULT_COUNTRY = 'US';

// Special value that means "show to all countries"
export const ALL_COUNTRIES = 'ALL';

// Type for supported country codes
export type SupportedCountry = typeof SUPPORTED_COUNTRIES[number];

// Type for target countries (including "ALL")
export type TargetCountry = SupportedCountry | typeof ALL_COUNTRIES;

// Country display names
export const COUNTRY_NAMES: Record<TargetCountry, string> = {
  ALL: 'All Countries',
  IN: 'India',
  US: 'United States',
  GB: 'United Kingdom',
  AU: 'Australia',
  CA: 'Canada',
};

// Country flags (emoji)
export const COUNTRY_FLAGS: Record<TargetCountry, string> = {
  ALL: '🌍',
  IN: '🇮🇳',
  US: '🇺🇸',
  GB: '🇬🇧',
  AU: '🇦🇺',
  CA: '🇨🇦',
};

// Options for dropdowns (admin forms)
export const COUNTRY_OPTIONS = [
  { value: 'ALL', label: '🌍 All Countries' },
  { value: 'IN', label: '🇮🇳 India' },
  { value: 'US', label: '🇺🇸 United States' },
  { value: 'GB', label: '🇬🇧 United Kingdom' },
  { value: 'AU', label: '🇦🇺 Australia' },
  { value: 'CA', label: '🇨🇦 Canada' },
] as const;

/**
 * Check if content should be visible to a user based on their country
 * 
 * @param targetCountries - Array of country codes the content is targeted to
 * @param userCountry - The user's country code
 * @returns true if content should be shown to the user
 * 
 * @example
 * isVisibleToCountry(['ALL'], 'IN') // true
 * isVisibleToCountry(['IN', 'US'], 'IN') // true
 * isVisibleToCountry(['US'], 'IN') // false
 */
export function isVisibleToCountry(
  targetCountries: string[],
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

/**
 * Check if a country code is supported
 */
export function isSupportedCountry(country: string): country is SupportedCountry {
  return SUPPORTED_COUNTRIES.includes(country as SupportedCountry);
}

/**
 * Get display name for a country code
 */
export function getCountryName(code: string): string {
  return COUNTRY_NAMES[code as TargetCountry] || code;
}

/**
 * Get flag emoji for a country code
 */
export function getCountryFlag(code: string): string {
  return COUNTRY_FLAGS[code as TargetCountry] || '🌍';
}

/**
 * Parse targetCountries from a table row (handles comma-separated values)
 * 
 * @example
 * parseTargetCountries('IN,US,GB') // ['IN', 'US', 'GB']
 * parseTargetCountries('ALL') // ['ALL']
 * parseTargetCountries(undefined) // ['ALL']
 */
export function parseTargetCountries(value: string | undefined): string[] {
  if (!value || value.trim() === '') {
    return [ALL_COUNTRIES];
  }
  
  return value.split(',').map(c => c.trim().toUpperCase());
}

/**
 * Check if a table row should be visible based on targetCountries field
 */
export function isRowVisibleToCountry(
  row: Record<string, unknown>,
  userCountry: string
): boolean {
  const targetCountries = row.targetCountries as string | undefined;
  const parsed = parseTargetCountries(targetCountries);
  return isVisibleToCountry(parsed, userCountry);
}

/**
 * Get country options for multi-select components
 * Returns array of { code, name, flag } objects
 */
export function getCountryOptions(): Array<{ code: string; name: string; flag: string }> {
  return [
    { code: ALL_COUNTRIES, name: 'All Countries', flag: '🌐' },
    { code: 'IN', name: 'India', flag: '🇮🇳' },
    { code: 'US', name: 'United States', flag: '🇺🇸' },
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
    { code: 'AU', name: 'Australia', flag: '🇦🇺' },
    { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  ];
}


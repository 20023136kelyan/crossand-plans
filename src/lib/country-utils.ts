/**
 * Utility functions for country-related operations
 */

/**
 * Get the flag emoji for a given country code
 * @param countryCode - The ISO 3166-1 alpha-2 country code
 * @returns The flag emoji for the country, or a default emoji if not found
 */
export const getCountryFlagEmoji = (countryCode: string | null | undefined): string => {
  if (!countryCode || countryCode.length !== 2) {
    return '🌍'; // Default world emoji
  }

  // Convert country code to flag emoji using Unicode regional indicator symbols
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  
  return String.fromCodePoint(...codePoints);
};

/**
 * Get country name from country code
 * @param countryCode - The ISO 3166-1 alpha-2 country code
 * @param countries - Array of country objects with code and name properties
 * @returns The country name or 'Unknown' if not found
 */
export const getCountryName = (countryCode: string | null | undefined, countries: Array<{code: string, name: string}>): string => {
  if (!countryCode) return 'Unknown';
  
  const country = countries.find(c => c.code === countryCode);
  return country?.name || 'Unknown';
};

/**
 * Format phone number with country dial code
 * @param phoneNumber - The phone number
 * @param dialCode - The country dial code (e.g., '+1')
 * @returns Formatted phone number with dial code
 */
export const formatPhoneWithDialCode = (phoneNumber: string | null | undefined, dialCode: string | null | undefined): string => {
  if (!phoneNumber) return '';
  if (!dialCode) return phoneNumber;
  
  // Remove any existing dial code from the phone number
  const cleanNumber = phoneNumber.replace(dialCode, '').trim();
  
  return `${dialCode} ${cleanNumber}`;
};
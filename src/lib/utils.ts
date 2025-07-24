import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Added common image extensions for client-side validation
export const commonImageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'tiff'];

/**
 * Generates a valid UUID using the built-in crypto.randomUUID()
 * @returns A valid UUID string
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Ensures a UUID is valid, generating a new one if invalid
 * @param uuid - The UUID to validate
 * @returns A valid UUID (either the original or a new one)
 */
export function ensureValidUUID(uuid: string): string {
  // Simple regex check for UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(uuid)) {
    return uuid;
  }
  return crypto.randomUUID();
}

/**
 * Sanitizes itinerary items to ensure all IDs are valid UUIDs
 * @param itinerary - Array of itinerary items
 * @returns Array with valid UUIDs
 */
export function sanitizeItineraryUUIDs(itinerary: any[]): any[] {
  return itinerary.map(item => ({
    ...item,
    id: ensureValidUUID(item.id || crypto.randomUUID())
  }));
}

export function getFullName(profile: { firstName?: string | null; lastName?: string | null; name?: string | null }): string | null {
  if (profile.firstName || profile.lastName) {
    const full = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
    return full && full.length > 0 ? full : null;
  }
  return profile.name ?? null;
}
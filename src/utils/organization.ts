/**
 * Organization utilities for working with organization data
 */

/**
 * Convert an organization name to a slug format
 * This is for local slug generation (Clerk also does this automatically)
 * 
 * @param name - The organization name to convert to slug
 * @returns The slugified name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Create a URL for an organization using its slug
 * 
 * @param slug - The organization's slug
 * @param path - Optional path to append to the organization URL
 * @returns The full URL for the organization
 */
export function getOrganizationUrl(slug: string, path?: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const orgPath = `/org/${slug}`;
  return path ? `${baseUrl}${orgPath}/${path}` : `${baseUrl}${orgPath}`;
}

/**
 * Create a display name for an organization using its slug if name is not available
 * 
 * @param name - The organization name (may be null)
 * @param slug - The organization slug (should always be available)
 * @returns A display name for the organization
 */
export function getOrganizationDisplayName(name: string | null, slug: string): string {
  if (name) return name;
  
  // Convert slug to a readable name if actual name is not available
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

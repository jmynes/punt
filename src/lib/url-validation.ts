/**
 * URL validation utilities for safe redirects
 */

/**
 * Check if a URL is safe for redirect (relative path only)
 */
export function isValidRedirectUrl(url: string): boolean {
  if (!url) return false

  // Must start with / (relative path)
  if (!url.startsWith('/')) return false

  // Block protocol-relative URLs (//evil.com)
  if (url.startsWith('//')) return false

  // Block javascript: and data: URLs (case-insensitive check)
  const lower = url.toLowerCase()
  if (lower.includes('javascript:') || lower.includes('data:')) return false

  // Block backslash-based bypasses (/\evil.com)
  if (url.includes('\\')) return false

  return true
}

/**
 * Get a safe redirect URL, falling back to default if invalid
 */
export function getSafeRedirectUrl(url: string | null, fallback = '/'): string {
  if (url && isValidRedirectUrl(url)) return url
  return fallback
}

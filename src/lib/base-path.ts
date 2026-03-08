/**
 * Base path utility for subpath deployments.
 *
 * When NEXT_PUBLIC_BASE_PATH is set (e.g., "/punt"), the app can be served
 * under that subpath. This module provides helpers to prepend the basePath
 * to URLs that are not automatically handled by Next.js (fetch, EventSource,
 * window.location assignments, etc.).
 *
 * Next.js automatically handles basePath for:
 *   - <Link> component hrefs
 *   - router.push() / router.replace()
 *   - redirect() from next/navigation
 *   - next/image src
 *
 * You must use these helpers for:
 *   - fetch() calls to API routes
 *   - new EventSource() URLs
 *   - window.location.href assignments
 *   - new URL() with path-only first argument
 */

/**
 * The configured base path, or empty string if none.
 * Reads from the NEXT_PUBLIC_BASE_PATH environment variable at build time.
 */
export const basePath: string = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

/**
 * Prepend the basePath to a path string.
 * If no basePath is configured, returns the path unchanged.
 *
 * @example
 * // With NEXT_PUBLIC_BASE_PATH="/punt"
 * withBasePath('/api/projects') // => "/punt/api/projects"
 * withBasePath('/login')        // => "/punt/login"
 *
 * // Without basePath
 * withBasePath('/api/projects') // => "/api/projects"
 */
export function withBasePath(path: string): string {
  if (!basePath) return path
  return `${basePath}${path}`
}

/**
 * Prepend the basePath to a URL stored in the database (e.g., avatar or logo URLs).
 * Returns undefined if the input is null/undefined (for optional image sources).
 *
 * @example
 * // With NEXT_PUBLIC_BASE_PATH="/punt"
 * assetUrl('/uploads/avatars/foo.webp') // => "/punt/uploads/avatars/foo.webp"
 * assetUrl(null)                         // => undefined
 * assetUrl(undefined)                    // => undefined
 */
export function assetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  return withBasePath(path)
}

/**
 * Fetch wrapper that automatically prepends basePath to relative URLs.
 * Use this instead of `fetch()` for API calls with path-only URLs.
 *
 * Absolute URLs (starting with http:// or https://) are passed through unchanged.
 *
 * @example
 * apiFetch('/api/projects')           // => fetch('/punt/api/projects')
 * apiFetch('https://example.com/api') // => fetch('https://example.com/api')
 */
export function apiFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  if (typeof input === 'string' && input.startsWith('/')) {
    return fetch(withBasePath(input), init)
  }
  return fetch(input, init)
}

import type { NextAuthConfig } from 'next-auth'

// Check if demo mode is enabled (build-time check, safe for edge runtime)
const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// Base path for subpath deployments (e.g., "/punt")
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

/**
 * Auth configuration for proxy (route protection)
 * This config is used by proxy.ts (runs on Node.js runtime in Next.js 16+)
 * Kept separate from main auth.ts for cleaner separation of concerns
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl, headers } }) {
      // Demo mode: allow all routes without authentication
      if (isDemoMode) {
        return true
      }

      // Get pathname, stripping basePath prefix if present
      // Next.js includes basePath in nextUrl.pathname, so we need to strip it for route matching
      const pathname =
        basePath && nextUrl.pathname.startsWith(basePath)
          ? nextUrl.pathname.slice(basePath.length) || '/'
          : nextUrl.pathname

      // Allow requests with API key header through to API routes
      // Accepts both X-API-Key (git hooks) and X-MCP-API-Key (MCP)
      // Actual key validation happens in getMcpUser() via database lookup
      if (pathname.startsWith('/api/')) {
        const apiKey = headers.get('X-API-Key') || headers.get('X-MCP-API-Key')
        if (apiKey) {
          return true
        }
      }

      const isLoggedIn = !!auth?.user
      const isOnAuthPage =
        pathname === '/login' ||
        pathname === '/register' ||
        pathname === '/forgot-password' ||
        pathname === '/reset-password' ||
        pathname === '/verify-email' ||
        pathname === '/setup'
      const isOnAuthApi = pathname.startsWith('/api/auth')
      const isOnInvite = pathname.startsWith('/invite')
      const isOnBrandingApi = pathname === '/api/branding'
      const isOnWebhooksApi = pathname.startsWith('/api/webhooks')

      // Allow auth API routes
      if (isOnAuthApi) {
        return true
      }

      // Allow public branding API (used by login page and header)
      if (isOnBrandingApi) {
        return true
      }

      // Allow webhooks API (authenticates via signature verification)
      if (isOnWebhooksApi) {
        return true
      }

      // Allow invite pages (users need to accept before logging in)
      if (isOnInvite) {
        return true
      }

      // Redirect logged-in users away from auth pages
      if (isLoggedIn && isOnAuthPage) {
        return Response.redirect(new URL(`${basePath}/`, nextUrl))
      }

      // Protect all other routes - redirect to login if not authenticated
      if (!isLoggedIn && !isOnAuthPage) {
        const loginUrl = new URL(`${basePath}/login`, nextUrl)
        // Use stripped pathname for callbackUrl to avoid double basePath after login
        loginUrl.searchParams.set('callbackUrl', pathname)
        return Response.redirect(loginUrl)
      }

      return true
    },
  },
  providers: [], // Providers are configured in auth.ts
}

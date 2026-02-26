import type { NextAuthConfig } from 'next-auth'

// Check if demo mode is enabled (build-time check, safe for edge runtime)
const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

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

      // Allow requests with API key header through to API routes
      // Accepts both X-API-Key (git hooks) and X-MCP-API-Key (MCP)
      // Actual key validation happens in getMcpUser() via database lookup
      if (nextUrl.pathname.startsWith('/api/')) {
        const apiKey = headers.get('X-API-Key') || headers.get('X-MCP-API-Key')
        if (apiKey) {
          return true
        }
      }

      const isLoggedIn = !!auth?.user
      const isOnAuthPage =
        nextUrl.pathname === '/login' ||
        nextUrl.pathname === '/register' ||
        nextUrl.pathname === '/forgot-password' ||
        nextUrl.pathname === '/reset-password' ||
        nextUrl.pathname === '/verify-email' ||
        nextUrl.pathname === '/setup'
      const isOnAuthApi = nextUrl.pathname.startsWith('/api/auth')
      const isOnInvite = nextUrl.pathname.startsWith('/invite')
      const isOnBrandingApi = nextUrl.pathname === '/api/branding'
      const isOnWebhooksApi = nextUrl.pathname.startsWith('/api/webhooks')

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
        return Response.redirect(new URL('/', nextUrl))
      }

      // Protect all other routes - redirect to login if not authenticated
      if (!isLoggedIn && !isOnAuthPage) {
        const loginUrl = new URL('/login', nextUrl)
        loginUrl.searchParams.set('callbackUrl', nextUrl.pathname)
        return Response.redirect(loginUrl)
      }

      return true
    },
  },
  providers: [], // Providers are configured in auth.ts
}

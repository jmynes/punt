import type { NextAuthConfig } from 'next-auth'

// Check if demo mode is enabled (build-time check, safe for edge runtime)
const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// MCP API key for internal service authentication
const MCP_API_KEY = process.env.MCP_API_KEY

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

      // Allow MCP API key authentication for API routes
      if (MCP_API_KEY && nextUrl.pathname.startsWith('/api/')) {
        const apiKey = headers.get('X-MCP-API-Key')
        if (apiKey && apiKey === MCP_API_KEY) {
          return true
        }
      }

      const isLoggedIn = !!auth?.user
      const isOnAuthPage =
        nextUrl.pathname === '/login' ||
        nextUrl.pathname === '/register' ||
        nextUrl.pathname === '/forgot-password' ||
        nextUrl.pathname === '/reset-password' ||
        nextUrl.pathname === '/verify-email'
      const isOnAuthApi = nextUrl.pathname.startsWith('/api/auth')
      const isOnInvite = nextUrl.pathname.startsWith('/invite')
      const isOnBrandingApi = nextUrl.pathname === '/api/branding'

      // Allow auth API routes
      if (isOnAuthApi) {
        return true
      }

      // Allow public branding API (used by login page and header)
      if (isOnBrandingApi) {
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

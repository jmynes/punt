import type { NextAuthConfig } from 'next-auth'

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
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnAuthPage = nextUrl.pathname === '/login' || nextUrl.pathname === '/register'
      const isOnAuthApi = nextUrl.pathname.startsWith('/api/auth')
      const isOnInvite = nextUrl.pathname.startsWith('/invite')

      // Allow auth API routes
      if (isOnAuthApi) {
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

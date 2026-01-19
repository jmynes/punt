import type { NextAuthConfig } from 'next-auth'

/**
 * Edge-compatible auth configuration
 * This config is used by middleware (runs on Edge runtime)
 * Does not include database adapter or heavy dependencies
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnLogin = nextUrl.pathname === '/login'
      const isOnApi = nextUrl.pathname.startsWith('/api')
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

      // Redirect logged-in users away from login page
      if (isLoggedIn && isOnLogin) {
        return Response.redirect(new URL('/', nextUrl))
      }

      // Protect all other routes
      if (!isLoggedIn && !isOnLogin) {
        const loginUrl = new URL('/login', nextUrl)
        loginUrl.searchParams.set('callbackUrl', nextUrl.pathname)
        return Response.redirect(loginUrl)
      }

      return true
    },
  },
  providers: [], // Providers are configured in auth.ts
}

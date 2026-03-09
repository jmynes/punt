import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'

const { auth: proxy } = NextAuth(authConfig)
export { proxy }

export const config = {
  // Match all routes except static files, _next, and uploads
  // The root path '/' needs to be explicit since the regex doesn't match empty paths
  matcher: ['/', '/((?!_next/static|_next/image|favicon.ico|uploads/).*)'],
}

import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'

const { auth: proxy } = NextAuth(authConfig)
export { proxy }

export const config = {
  // Match all routes except static files, _next, and uploads
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads/).*)'],
}

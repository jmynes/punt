/**
 * Unit tests for auth.config.ts authorized callback.
 * Tests route protection and redirect URL preservation.
 */

import { describe, expect, it, vi } from 'vitest'

// Mock environment variables before importing
vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'false')
vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '')

// Need to dynamically import after setting env vars
const getAuthConfig = async () => {
  // Clear module cache to pick up fresh env vars
  vi.resetModules()
  const module = await import('@/lib/auth.config')
  return module.authConfig
}

describe('auth.config authorized callback', () => {
  describe('redirect URL preservation', () => {
    it('should preserve query string in callbackUrl when redirecting to login', async () => {
      const authConfig = await getAuthConfig()
      const authorized = authConfig.callbacks?.authorized

      if (!authorized) {
        throw new Error('authorized callback not found')
      }

      const nextUrl = new URL('http://localhost:3000/projects/PUNT/backlog?ticket=PUNT-292')
      const headers = new Headers()

      const result = authorized({
        auth: null,
        request: { nextUrl, headers } as unknown as Request,
      })

      expect(result).toBeInstanceOf(Response)
      const response = result as Response
      expect(response.status).toBe(302)

      const location = response.headers.get('location')
      expect(location).toBeTruthy()

      const redirectUrl = new URL(location as string, 'http://localhost:3000')
      expect(redirectUrl.pathname).toBe('/login')
      expect(redirectUrl.searchParams.get('callbackUrl')).toBe(
        '/projects/PUNT/backlog?ticket=PUNT-292',
      )
    })

    it('should preserve multiple query parameters in callbackUrl', async () => {
      const authConfig = await getAuthConfig()
      const authorized = authConfig.callbacks?.authorized

      if (!authorized) {
        throw new Error('authorized callback not found')
      }

      const nextUrl = new URL(
        'http://localhost:3000/projects/PUNT/backlog?ticket=PUNT-292&view=detail&tab=comments',
      )
      const headers = new Headers()

      const result = authorized({
        auth: null,
        request: { nextUrl, headers } as unknown as Request,
      })

      expect(result).toBeInstanceOf(Response)
      const response = result as Response
      const location = response.headers.get('location')
      const redirectUrl = new URL(location as string, 'http://localhost:3000')

      expect(redirectUrl.searchParams.get('callbackUrl')).toBe(
        '/projects/PUNT/backlog?ticket=PUNT-292&view=detail&tab=comments',
      )
    })

    it('should handle paths without query string', async () => {
      const authConfig = await getAuthConfig()
      const authorized = authConfig.callbacks?.authorized

      if (!authorized) {
        throw new Error('authorized callback not found')
      }

      const nextUrl = new URL('http://localhost:3000/projects/PUNT/backlog')
      const headers = new Headers()

      const result = authorized({
        auth: null,
        request: { nextUrl, headers } as unknown as Request,
      })

      expect(result).toBeInstanceOf(Response)
      const response = result as Response
      const location = response.headers.get('location')
      const redirectUrl = new URL(location as string, 'http://localhost:3000')

      expect(redirectUrl.searchParams.get('callbackUrl')).toBe('/projects/PUNT/backlog')
    })

    it('should preserve hash fragments with query strings', async () => {
      const authConfig = await getAuthConfig()
      const authorized = authConfig.callbacks?.authorized

      if (!authorized) {
        throw new Error('authorized callback not found')
      }

      // Note: URL.search includes the ? prefix, but not hash
      // The hash is only available on client-side (nextUrl won't have it in middleware)
      const nextUrl = new URL('http://localhost:3000/docs?section=api')
      const headers = new Headers()

      const result = authorized({
        auth: null,
        request: { nextUrl, headers } as unknown as Request,
      })

      expect(result).toBeInstanceOf(Response)
      const response = result as Response
      const location = response.headers.get('location')
      const redirectUrl = new URL(location as string, 'http://localhost:3000')

      expect(redirectUrl.searchParams.get('callbackUrl')).toBe('/docs?section=api')
    })
  })

  describe('public routes', () => {
    it('should allow access to login page without redirect', async () => {
      const authConfig = await getAuthConfig()
      const authorized = authConfig.callbacks?.authorized

      if (!authorized) {
        throw new Error('authorized callback not found')
      }

      const nextUrl = new URL('http://localhost:3000/login')
      const headers = new Headers()

      const result = authorized({
        auth: null,
        request: { nextUrl, headers } as unknown as Request,
      })

      expect(result).toBe(true)
    })

    it('should allow access to register page without redirect', async () => {
      const authConfig = await getAuthConfig()
      const authorized = authConfig.callbacks?.authorized

      if (!authorized) {
        throw new Error('authorized callback not found')
      }

      const nextUrl = new URL('http://localhost:3000/register')
      const headers = new Headers()

      const result = authorized({
        auth: null,
        request: { nextUrl, headers } as unknown as Request,
      })

      expect(result).toBe(true)
    })

    it('should allow access to auth API routes', async () => {
      const authConfig = await getAuthConfig()
      const authorized = authConfig.callbacks?.authorized

      if (!authorized) {
        throw new Error('authorized callback not found')
      }

      const nextUrl = new URL('http://localhost:3000/api/auth/session')
      const headers = new Headers()

      const result = authorized({
        auth: null,
        request: { nextUrl, headers } as unknown as Request,
      })

      expect(result).toBe(true)
    })
  })

  describe('authenticated users', () => {
    it('should allow authenticated users to access protected routes', async () => {
      const authConfig = await getAuthConfig()
      const authorized = authConfig.callbacks?.authorized

      if (!authorized) {
        throw new Error('authorized callback not found')
      }

      const nextUrl = new URL('http://localhost:3000/projects/PUNT/backlog')
      const headers = new Headers()

      const result = authorized({
        auth: { user: { id: '123', name: 'Test User' } },
        request: { nextUrl, headers } as unknown as Request,
      })

      expect(result).toBe(true)
    })

    it('should redirect authenticated users away from login page', async () => {
      const authConfig = await getAuthConfig()
      const authorized = authConfig.callbacks?.authorized

      if (!authorized) {
        throw new Error('authorized callback not found')
      }

      const nextUrl = new URL('http://localhost:3000/login')
      const headers = new Headers()

      const result = authorized({
        auth: { user: { id: '123', name: 'Test User' } },
        request: { nextUrl, headers } as unknown as Request,
      })

      expect(result).toBeInstanceOf(Response)
      const response = result as Response
      const location = response.headers.get('location')
      expect(location).toBe('http://localhost:3000/')
    })
  })

  describe('API routes with API key', () => {
    it('should allow API requests with X-API-Key header', async () => {
      const authConfig = await getAuthConfig()
      const authorized = authConfig.callbacks?.authorized

      if (!authorized) {
        throw new Error('authorized callback not found')
      }

      const nextUrl = new URL('http://localhost:3000/api/projects')
      const headers = new Headers()
      headers.set('X-API-Key', 'test-api-key')

      const result = authorized({
        auth: null,
        request: { nextUrl, headers } as unknown as Request,
      })

      expect(result).toBe(true)
    })

    it('should allow API requests with X-MCP-API-Key header', async () => {
      const authConfig = await getAuthConfig()
      const authorized = authConfig.callbacks?.authorized

      if (!authorized) {
        throw new Error('authorized callback not found')
      }

      const nextUrl = new URL('http://localhost:3000/api/projects')
      const headers = new Headers()
      headers.set('X-MCP-API-Key', 'test-mcp-key')

      const result = authorized({
        auth: null,
        request: { nextUrl, headers } as unknown as Request,
      })

      expect(result).toBe(true)
    })
  })
})

describe('auth.config with basePath', () => {
  it('should strip basePath from pathname in callbackUrl', async () => {
    // Set basePath env var
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/punt')
    vi.resetModules()

    const module = await import('@/lib/auth.config')
    const authConfig = module.authConfig
    const authorized = authConfig.callbacks?.authorized

    if (!authorized) {
      throw new Error('authorized callback not found')
    }

    // URL with basePath prefix (as Next.js would provide it)
    const nextUrl = new URL('http://localhost:3000/punt/projects/PUNT/backlog?ticket=PUNT-292')
    const headers = new Headers()

    const result = authorized({
      auth: null,
      request: { nextUrl, headers } as unknown as Request,
    })

    expect(result).toBeInstanceOf(Response)
    const response = result as Response
    const location = response.headers.get('location')
    const redirectUrl = new URL(location as string, 'http://localhost:3000')

    // Should redirect to /punt/login
    expect(redirectUrl.pathname).toBe('/punt/login')
    // callbackUrl should NOT have basePath prefix (to avoid double basePath after login)
    expect(redirectUrl.searchParams.get('callbackUrl')).toBe(
      '/projects/PUNT/backlog?ticket=PUNT-292',
    )

    // Clean up
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '')
  })
})

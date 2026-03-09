/**
 * Unit tests for URL validation functions.
 * Tests the security and correctness of redirect URL validation.
 */

import { describe, expect, it } from 'vitest'
import { getSafeRedirectUrl, isValidRedirectUrl } from '@/lib/url-validation'

describe('isValidRedirectUrl', () => {
  describe('valid URLs', () => {
    it('should accept simple relative paths', () => {
      expect(isValidRedirectUrl('/')).toBe(true)
      expect(isValidRedirectUrl('/projects')).toBe(true)
      expect(isValidRedirectUrl('/projects/PUNT')).toBe(true)
      expect(isValidRedirectUrl('/projects/PUNT/backlog')).toBe(true)
    })

    it('should accept paths with query strings', () => {
      expect(isValidRedirectUrl('/projects/PUNT/backlog?ticket=PUNT-292')).toBe(true)
      expect(isValidRedirectUrl('/search?q=test')).toBe(true)
      expect(isValidRedirectUrl('/page?foo=bar&baz=qux')).toBe(true)
    })

    it('should accept paths with hash fragments', () => {
      expect(isValidRedirectUrl('/docs#section')).toBe(true)
      expect(isValidRedirectUrl('/page?query=1#anchor')).toBe(true)
    })

    it('should accept paths with encoded characters', () => {
      expect(isValidRedirectUrl('/search?q=hello%20world')).toBe(true)
      expect(isValidRedirectUrl('/path%2Fwith%2Fencoded')).toBe(true)
    })
  })

  describe('invalid URLs', () => {
    it('should reject empty strings', () => {
      expect(isValidRedirectUrl('')).toBe(false)
    })

    it('should reject absolute URLs with protocols', () => {
      expect(isValidRedirectUrl('http://evil.com')).toBe(false)
      expect(isValidRedirectUrl('https://evil.com')).toBe(false)
      expect(isValidRedirectUrl('ftp://evil.com')).toBe(false)
    })

    it('should reject protocol-relative URLs', () => {
      expect(isValidRedirectUrl('//evil.com')).toBe(false)
      expect(isValidRedirectUrl('//evil.com/path')).toBe(false)
    })

    it('should reject javascript: URLs', () => {
      expect(isValidRedirectUrl('javascript:alert(1)')).toBe(false)
      expect(isValidRedirectUrl('/redirect?url=javascript:alert(1)')).toBe(false)
      expect(isValidRedirectUrl('/path?javascript:test')).toBe(false)
    })

    it('should reject javascript: URLs case-insensitively', () => {
      expect(isValidRedirectUrl('JAVASCRIPT:alert(1)')).toBe(false)
      expect(isValidRedirectUrl('JavaScript:alert(1)')).toBe(false)
      expect(isValidRedirectUrl('/page?JAVASCRIPT:test')).toBe(false)
    })

    it('should reject data: URLs', () => {
      expect(isValidRedirectUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
      expect(isValidRedirectUrl('/redirect?url=data:text/html')).toBe(false)
    })

    it('should reject data: URLs case-insensitively', () => {
      expect(isValidRedirectUrl('DATA:text/html')).toBe(false)
      expect(isValidRedirectUrl('Data:text/html')).toBe(false)
    })

    it('should reject backslash-based bypasses', () => {
      expect(isValidRedirectUrl('/\\evil.com')).toBe(false)
      expect(isValidRedirectUrl('/path\\to\\page')).toBe(false)
    })

    it('should reject paths not starting with /', () => {
      expect(isValidRedirectUrl('projects/PUNT')).toBe(false)
      expect(isValidRedirectUrl('login')).toBe(false)
    })
  })
})

describe('getSafeRedirectUrl', () => {
  describe('valid URLs', () => {
    it('should return the URL for valid paths', () => {
      expect(getSafeRedirectUrl('/dashboard')).toBe('/dashboard')
      expect(getSafeRedirectUrl('/projects/PUNT')).toBe('/projects/PUNT')
    })

    it('should preserve query strings in valid URLs', () => {
      expect(getSafeRedirectUrl('/projects/PUNT/backlog?ticket=PUNT-292')).toBe(
        '/projects/PUNT/backlog?ticket=PUNT-292',
      )
      expect(getSafeRedirectUrl('/search?q=test&page=2')).toBe('/search?q=test&page=2')
    })

    it('should preserve hash fragments in valid URLs', () => {
      expect(getSafeRedirectUrl('/docs#section')).toBe('/docs#section')
      expect(getSafeRedirectUrl('/page?query=1#anchor')).toBe('/page?query=1#anchor')
    })
  })

  describe('invalid URLs', () => {
    it('should return fallback for null input', () => {
      expect(getSafeRedirectUrl(null)).toBe('/')
      expect(getSafeRedirectUrl(null, '/dashboard')).toBe('/dashboard')
    })

    it('should return fallback for empty string', () => {
      expect(getSafeRedirectUrl('')).toBe('/')
      expect(getSafeRedirectUrl('', '/home')).toBe('/home')
    })

    it('should return fallback for absolute URLs', () => {
      expect(getSafeRedirectUrl('http://evil.com')).toBe('/')
      expect(getSafeRedirectUrl('https://evil.com', '/safe')).toBe('/safe')
    })

    it('should return fallback for protocol-relative URLs', () => {
      expect(getSafeRedirectUrl('//evil.com')).toBe('/')
    })

    it('should return fallback for javascript: URLs', () => {
      expect(getSafeRedirectUrl('javascript:alert(1)')).toBe('/')
      expect(getSafeRedirectUrl('/page?javascript:test')).toBe('/')
    })

    it('should return fallback for data: URLs', () => {
      expect(getSafeRedirectUrl('data:text/html')).toBe('/')
      expect(getSafeRedirectUrl('/page?data:text/html')).toBe('/')
    })
  })

  describe('default fallback', () => {
    it('should use "/" as default fallback', () => {
      expect(getSafeRedirectUrl('invalid')).toBe('/')
      expect(getSafeRedirectUrl(null)).toBe('/')
    })

    it('should use custom fallback when provided', () => {
      expect(getSafeRedirectUrl('invalid', '/custom')).toBe('/custom')
      expect(getSafeRedirectUrl(null, '/custom')).toBe('/custom')
    })
  })
})

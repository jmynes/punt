/**
 * Fuzz tests for URL validation (redirect safety).
 * Tests isValidRedirectUrl and getSafeRedirectUrl functions.
 */

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { getSafeRedirectUrl, isValidRedirectUrl } from '@/lib/url-validation'
import { maliciousString, urlLike } from '../arbitraries'
import { FUZZ_CONFIG } from '../setup'

describe('URL Validation Fuzz Tests', () => {
  describe('isValidRedirectUrl', () => {
    it('should never crash on any string input', () => {
      fc.assert(
        fc.property(fc.string(), (url) => {
          const result = isValidRedirectUrl(url)
          expect(typeof result).toBe('boolean')
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should never allow absolute URLs with http/https', () => {
      fc.assert(
        fc.property(
          fc.string().map((s) => `http://${s}`),
          (url) => {
            expect(isValidRedirectUrl(url)).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )

      fc.assert(
        fc.property(
          fc.string().map((s) => `https://${s}`),
          (url) => {
            expect(isValidRedirectUrl(url)).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should never allow protocol-relative URLs (//) ', () => {
      fc.assert(
        fc.property(
          fc.string().map((s) => `//${s}`),
          (url) => {
            expect(isValidRedirectUrl(url)).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should never allow javascript: URLs (case-insensitive)', () => {
      const javascriptVariants = [
        'javascript:',
        'JAVASCRIPT:',
        'JavaScript:',
        'jAvAsCrIpT:',
        'JaVaScRiPt:',
      ]

      for (const prefix of javascriptVariants) {
        fc.assert(
          fc.property(
            fc.string().map((s) => `${prefix}${s}`),
            (url) => {
              expect(isValidRedirectUrl(url)).toBe(false)
            },
          ),
          FUZZ_CONFIG.quick,
        )
      }
    })

    it('should never allow data: URLs (case-insensitive)', () => {
      const dataVariants = ['data:', 'DATA:', 'Data:', 'dAtA:']

      for (const prefix of dataVariants) {
        fc.assert(
          fc.property(
            fc.string().map((s) => `${prefix}${s}`),
            (url) => {
              expect(isValidRedirectUrl(url)).toBe(false)
            },
          ),
          FUZZ_CONFIG.quick,
        )
      }
    })

    it('should never allow URLs containing javascript: anywhere', () => {
      fc.assert(
        fc.property(fc.tuple(fc.string(), fc.string()), ([prefix, suffix]) => {
          const url = `/${prefix}javascript:${suffix}`
          expect(isValidRedirectUrl(url)).toBe(false)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should never allow URLs containing data: anywhere', () => {
      fc.assert(
        fc.property(fc.tuple(fc.string(), fc.string()), ([prefix, suffix]) => {
          const url = `/${prefix}data:${suffix}`
          expect(isValidRedirectUrl(url)).toBe(false)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should never allow backslashes', () => {
      fc.assert(
        fc.property(
          fc.string().map((s) => `/${s}\\${s}`),
          (url) => {
            expect(isValidRedirectUrl(url)).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject URLs that do not start with /', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => s.length > 0 && !s.startsWith('/')),
          (url) => {
            expect(isValidRedirectUrl(url)).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should accept valid relative paths starting with /', () => {
      fc.assert(
        fc.property(
          fc
            .array(fc.stringMatching(/^[a-zA-Z0-9_-]+$/), { minLength: 1, maxLength: 5 })
            .map((parts) => `/${parts.join('/')}`),
          (url) => {
            expect(isValidRedirectUrl(url)).toBe(true)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle URL-like arbitrary inputs safely', () => {
      fc.assert(
        fc.property(urlLike, (url) => {
          const result = isValidRedirectUrl(url)
          expect(typeof result).toBe('boolean')

          // Verify security properties on result
          if (result === true) {
            // If valid, it must start with /
            expect(url.startsWith('/')).toBe(true)
            // And not be protocol-relative
            expect(url.startsWith('//')).toBe(false)
            // And not contain dangerous protocols
            expect(url.toLowerCase()).not.toContain('javascript:')
            expect(url.toLowerCase()).not.toContain('data:')
            // And not contain backslashes
            expect(url).not.toContain('\\')
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle malicious strings safely', () => {
      fc.assert(
        fc.property(maliciousString, (input) => {
          // Should never crash
          const result = isValidRedirectUrl(input)
          expect(typeof result).toBe('boolean')
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('getSafeRedirectUrl', () => {
    it('should always return a string', () => {
      fc.assert(
        fc.property(fc.option(fc.string(), { nil: null }), (url) => {
          const result = getSafeRedirectUrl(url)
          expect(typeof result).toBe('string')
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should return fallback for invalid URLs', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.string().filter((s) => !isValidRedirectUrl(s)),
            fc.string({ minLength: 1 }).map((s) => `/${s.replace(/[^a-zA-Z0-9]/g, '')}`),
          ),
          ([invalidUrl, fallback]) => {
            const result = getSafeRedirectUrl(invalidUrl, fallback)
            expect(result).toBe(fallback)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should return URL for valid URLs', () => {
      fc.assert(
        fc.property(
          fc
            .array(fc.stringMatching(/^[a-zA-Z0-9_-]+$/), { minLength: 1, maxLength: 3 })
            .map((parts) => `/${parts.join('/')}`),
          (validUrl) => {
            const result = getSafeRedirectUrl(validUrl)
            expect(result).toBe(validUrl)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should use default fallback of "/" when not specified', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !isValidRedirectUrl(s)),
          (invalidUrl) => {
            const result = getSafeRedirectUrl(invalidUrl)
            expect(result).toBe('/')
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle null input', () => {
      expect(getSafeRedirectUrl(null)).toBe('/')
      expect(getSafeRedirectUrl(null, '/dashboard')).toBe('/dashboard')
    })

    it('should never return dangerous URLs', () => {
      fc.assert(
        fc.property(fc.option(fc.string(), { nil: null }), (url) => {
          const result = getSafeRedirectUrl(url)

          // Result should always be safe
          expect(result.toLowerCase()).not.toContain('javascript:')
          expect(result.toLowerCase()).not.toContain('data:')
          expect(result).not.toContain('\\')
          expect(result).not.toMatch(/^\/\//)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })
})

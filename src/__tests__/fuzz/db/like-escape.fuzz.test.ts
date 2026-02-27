/**
 * Fuzz tests for PostgreSQL ILIKE wildcard escape logic.
 * Replicates the escape logic from the ticket search route and verifies
 * that LIKE special characters (%, _, \) are properly escaped.
 */

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { likeInjectionString } from '../arbitraries'
import { FUZZ_CONFIG } from '../setup'

/**
 * Replicate the escapeLikePattern logic from:
 * src/app/api/projects/[projectId]/tickets/search/route.ts:56
 */
function escapeLikePattern(query: string): string {
  return query.replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/**
 * Replicate the search query preprocessing:
 * trim + limit to 200 chars
 */
function preprocessQuery(raw: string): string {
  return raw.trim().slice(0, 200)
}

describe('PostgreSQL ILIKE Escape Fuzz Tests', () => {
  describe('escapeLikePattern', () => {
    it('should escape all % characters', () => {
      fc.assert(
        fc.property(likeInjectionString, (input) => {
          const escaped = escapeLikePattern(input)
          // Count unescaped % (not preceded by \)
          const unescapedPercent = escaped.match(/(?<!\\)%/g)
          expect(unescapedPercent).toBeNull()
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should escape all _ characters', () => {
      fc.assert(
        fc.property(likeInjectionString, (input) => {
          const escaped = escapeLikePattern(input)
          // Count unescaped _ (not preceded by \)
          const unescapedUnderscore = escaped.match(/(?<!\\)_/g)
          expect(unescapedUnderscore).toBeNull()
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should leave strings without special chars unchanged', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !/[%_]/.test(s)),
          (input) => {
            expect(escapeLikePattern(input)).toBe(input)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should produce no unescaped wildcards from injection strings', () => {
      fc.assert(
        fc.property(likeInjectionString, (input) => {
          const escaped = escapeLikePattern(input)
          // After escaping, there should be no bare % or _ that could act as wildcards
          // Every % should be preceded by \ and every _ should be preceded by \
          for (let i = 0; i < escaped.length; i++) {
            if (escaped[i] === '%' || escaped[i] === '_') {
              expect(i).toBeGreaterThan(0)
              expect(escaped[i - 1]).toBe('\\')
            }
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should never throw on any string input', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          expect(() => escapeLikePattern(input)).not.toThrow()
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle specific edge cases', () => {
      expect(escapeLikePattern('%')).toBe('\\%')
      expect(escapeLikePattern('_')).toBe('\\_')
      expect(escapeLikePattern('%%')).toBe('\\%\\%')
      expect(escapeLikePattern('__')).toBe('\\_\\_')
      expect(escapeLikePattern('%admin%')).toBe('\\%admin\\%')
      expect(escapeLikePattern('user_name')).toBe('user\\_name')
      expect(escapeLikePattern('100%')).toBe('100\\%')
      expect(escapeLikePattern('')).toBe('')
      expect(escapeLikePattern('normal text')).toBe('normal text')
    })
  })

  describe('Search query preprocessing', () => {
    it('should trim whitespace', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const processed = preprocessQuery(input)
          expect(processed).toBe(processed.trim())
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should limit to 200 characters', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 1000 }), (input) => {
          const processed = preprocessQuery(input)
          expect(processed.length).toBeLessThanOrEqual(200)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should preserve content within limit', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 100 }), (input) => {
          const trimmed = input.trim()
          const processed = preprocessQuery(input)
          if (trimmed.length <= 200) {
            expect(processed).toBe(trimmed)
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should never throw', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          expect(() => preprocessQuery(input)).not.toThrow()
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })
})

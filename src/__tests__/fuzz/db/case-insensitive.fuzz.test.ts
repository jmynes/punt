/**
 * Fuzz tests for username case-insensitive handling.
 * Tests the JavaScript-level properties the app relies on for
 * case-insensitive username matching after removing the usernameLower column.
 */

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { caseVariantUsername } from '../arbitraries'
import { FUZZ_CONFIG } from '../setup'

// Username validation regex from the app (3-30 chars, alphanumeric + underscore + hyphen)
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,30}$/

describe('Username Case-Insensitive Handling Fuzz Tests', () => {
  describe('Case-insensitive matching via toLowerCase', () => {
    it('should produce same toLowerCase for case variants', () => {
      fc.assert(
        fc.property(caseVariantUsername, ({ original, variant }) => {
          expect(original.toLowerCase()).toBe(variant.toLowerCase())
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should be idempotent — applying toLowerCase twice gives same result', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const once = input.toLowerCase()
          const twice = once.toLowerCase()
          expect(once).toBe(twice)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('NFC normalization', () => {
    it('should be idempotent — applied twice equals applied once', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const once = input.normalize('NFC')
          const twice = once.normalize('NFC')
          expect(once).toBe(twice)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should normalize combining characters', () => {
      // e + combining acute = é
      const combined = 'e\u0301' // e + combining acute accent
      const precomposed = '\u00e9' // é precomposed
      expect(combined.normalize('NFC')).toBe(precomposed)
    })

    it('should normalize case variants consistently after NFC', () => {
      fc.assert(
        fc.property(caseVariantUsername, ({ original, variant }) => {
          const normalizedOrig = original.normalize('NFC').toLowerCase()
          const normalizedVariant = variant.normalize('NFC').toLowerCase()
          expect(normalizedOrig).toBe(normalizedVariant)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('Username regex validation', () => {
    it('should accept valid usernames regardless of case', () => {
      fc.assert(
        fc.property(caseVariantUsername, ({ original, variant }) => {
          // Both should pass regex if they're 3-30 chars of valid chars
          if (USERNAME_REGEX.test(original)) {
            expect(USERNAME_REGEX.test(variant)).toBe(true)
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject Cyrillic/Unicode lookalikes', () => {
      const lookalikes = [
        'аdmin', // Cyrillic 'а' (U+0430)
        'usеr', // Cyrillic 'е' (U+0435)
        'rооt', // Cyrillic 'о' (U+043E)
        'ᴀdmin', // Small caps A (U+1D00)
        'admin\u200B', // Zero-width space
        'admin\u0000', // Null byte
        'аdмin', // Mixed Cyrillic
      ]

      for (const username of lookalikes) {
        expect(USERNAME_REGEX.test(username)).toBe(false)
      }
    })

    it('should reject usernames outside length bounds', () => {
      // Too short
      fc.assert(
        fc.property(
          fc
            .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')), {
              minLength: 0,
              maxLength: 2,
            })
            .map((c) => c.join('')),
          (short) => {
            expect(USERNAME_REGEX.test(short)).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )

      // Too long
      fc.assert(
        fc.property(
          fc
            .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')), {
              minLength: 31,
              maxLength: 50,
            })
            .map((c) => c.join('')),
          (long) => {
            expect(USERNAME_REGEX.test(long)).toBe(false)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject special characters', () => {
      const invalid = [
        'user name', // space
        'user@name', // @
        'user.name', // .
        'user/name', // /
        "user'name", // '
        'user"name', // "
        'user<name', // <
        'user>name', // >
      ]

      for (const username of invalid) {
        expect(USERNAME_REGEX.test(username)).toBe(false)
      }
    })
  })

  describe('PostgreSQL mode: insensitive equivalence', () => {
    it('should ensure case-insensitive findFirst would match case variants', () => {
      // This tests the JavaScript-level property that Prisma mode:'insensitive' relies on:
      // if two strings differ only in case, ILIKE comparison should find both.
      // We verify by checking that the canonical form (lowercase) is identical.
      fc.assert(
        fc.property(caseVariantUsername, ({ original, variant }) => {
          const canonicalOrig = original.toLowerCase()
          const canonicalVariant = variant.toLowerCase()
          // PostgreSQL ILIKE effectively compares lowercased versions
          expect(canonicalOrig).toBe(canonicalVariant)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })
})

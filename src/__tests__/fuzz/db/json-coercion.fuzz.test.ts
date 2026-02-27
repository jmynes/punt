/**
 * Fuzz tests for JSON coercion functions that changed in the PostgreSQL migration.
 * Verifies that coerceJsonArray, coerceRecoveryCodes, and parsePermissions
 * handle both native JSON (PostgreSQL) and legacy string formats safely.
 */

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { ALL_PERMISSIONS, parsePermissions } from '@/lib/permissions/constants'
import { _coerceJsonArrayForTesting as coerceJsonArray } from '@/lib/system-settings'
import { countRemainingRecoveryCodes, markRecoveryCodeUsed } from '@/lib/totp'
import {
  garbageJsonInput,
  legacyPermissionsString,
  mixedPermissionsArray,
  nativeJsonArray,
  validPermissionsArray,
} from '../arbitraries'
import { FUZZ_CONFIG } from '../setup'

describe('JSON Coercion Fuzz Tests', () => {
  describe('coerceJsonArray', () => {
    const fallback = ['default']

    it('should return native arrays as-is', () => {
      fc.assert(
        fc.property(nativeJsonArray, (arr) => {
          const result = coerceJsonArray(arr, fallback)
          expect(result).toEqual(arr)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should parse legacy JSON-stringified arrays', () => {
      fc.assert(
        fc.property(nativeJsonArray, (arr) => {
          const stringified = JSON.stringify(arr)
          const result = coerceJsonArray(stringified, fallback)
          expect(result).toEqual(arr)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should return fallback for garbage input', () => {
      fc.assert(
        fc.property(garbageJsonInput, (input) => {
          const result = coerceJsonArray(input, fallback)
          // Should be either the actual value (if valid) or the fallback
          expect(Array.isArray(result)).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should never throw on any input', () => {
      fc.assert(
        fc.property(fc.anything(), (input) => {
          expect(() => coerceJsonArray(input, fallback)).not.toThrow()
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should return fallback for null, undefined, numbers, booleans', () => {
      for (const input of [null, undefined, 42, true, false, 0, NaN]) {
        const result = coerceJsonArray(input, fallback)
        expect(result).toEqual(fallback)
      }
    })

    it('should return fallback for non-array JSON strings', () => {
      for (const input of ['{"key": "value"}', '42', '"hello"', 'true']) {
        const result = coerceJsonArray(input, fallback)
        expect(result).toEqual(fallback)
      }
    })

    it('should return fallback for invalid JSON strings', () => {
      for (const input of ['{invalid', '[broken', 'not-json', '']) {
        const result = coerceJsonArray(input, fallback)
        expect(result).toEqual(fallback)
      }
    })
  })

  describe('coerceRecoveryCodes (via markRecoveryCodeUsed / countRemainingRecoveryCodes)', () => {
    it('should handle native arrays', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 60 }), { minLength: 1, maxLength: 8 }),
          (codes) => {
            const count = countRemainingRecoveryCodes(codes)
            expect(count).toBe(codes.filter((c) => c !== '').length)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle legacy JSON strings', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 60 }), { minLength: 1, maxLength: 8 }),
          (codes) => {
            const stringified = JSON.stringify(codes)
            const count = countRemainingRecoveryCodes(stringified)
            expect(count).toBe(codes.filter((c) => c !== '').length)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should never throw on garbage input', () => {
      fc.assert(
        fc.property(garbageJsonInput, (input) => {
          expect(() => countRemainingRecoveryCodes(input)).not.toThrow()
          expect(() => markRecoveryCodeUsed(input, 0)).not.toThrow()
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should never throw on fc.anything()', () => {
      fc.assert(
        fc.property(fc.anything(), (input) => {
          expect(() => countRemainingRecoveryCodes(input)).not.toThrow()
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should return 0 for empty/falsy input', () => {
      for (const input of [null, undefined, '', 0, false]) {
        expect(countRemainingRecoveryCodes(input)).toBe(0)
      }
    })

    it('should mark code at index as used', () => {
      const codes = ['hash1', 'hash2', 'hash3']
      const result = markRecoveryCodeUsed(codes, 1)
      expect(result[1]).toBe('')
      expect(result[0]).toBe('hash1')
      expect(result[2]).toBe('hash3')
    })
  })

  describe('parsePermissions', () => {
    it('should accept native arrays of valid permissions', () => {
      fc.assert(
        fc.property(validPermissionsArray, (perms) => {
          const result = parsePermissions(perms)
          expect(result).toEqual(perms)
          for (const p of result) {
            expect(ALL_PERMISSIONS).toContain(p)
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should parse legacy JSON-stringified permission arrays', () => {
      fc.assert(
        fc.property(legacyPermissionsString, (str) => {
          const result = parsePermissions(str)
          for (const p of result) {
            expect(ALL_PERMISSIONS).toContain(p)
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should filter invalid entries from mixed arrays', () => {
      fc.assert(
        fc.property(mixedPermissionsArray, (perms) => {
          const result = parsePermissions(perms)
          for (const p of result) {
            expect(ALL_PERMISSIONS).toContain(p)
          }
          expect(result.length).toBeLessThanOrEqual(perms.length)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should return empty for null/undefined/falsy input', () => {
      for (const input of [null, undefined, false, 0, '']) {
        expect(parsePermissions(input)).toEqual([])
      }
    })

    it('should return empty for non-array/non-string input', () => {
      for (const input of [42, true, { key: 'value' }]) {
        expect(parsePermissions(input)).toEqual([])
      }
    })

    it('should never throw on any input', () => {
      fc.assert(
        fc.property(fc.anything(), (input) => {
          expect(() => parsePermissions(input)).not.toThrow()
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should ensure every returned value is a member of ALL_PERMISSIONS', () => {
      fc.assert(
        fc.property(fc.anything(), (input) => {
          const result = parsePermissions(input)
          expect(Array.isArray(result)).toBe(true)
          for (const p of result) {
            expect(ALL_PERMISSIONS).toContain(p)
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })
})

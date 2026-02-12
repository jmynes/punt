/**
 * Fuzz tests for password validation.
 * Tests the validatePasswordStrength function with various inputs.
 */

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { validatePasswordStrength } from '@/lib/password'
import { passwordString } from '../arbitraries'
import { FUZZ_CONFIG } from '../setup'

describe('Password Validation Fuzz Tests', () => {
  describe('validatePasswordStrength', () => {
    it('should never crash on any string input', () => {
      fc.assert(
        fc.property(fc.string(), (password) => {
          // Should never throw
          const result = validatePasswordStrength(password)

          // Result should always have valid structure
          expect(result).toHaveProperty('valid')
          expect(result).toHaveProperty('errors')
          expect(typeof result.valid).toBe('boolean')
          expect(Array.isArray(result.errors)).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should never crash on any string input', () => {
      fc.assert(
        fc.property(fc.string(), (password) => {
          const result = validatePasswordStrength(password)
          expect(result).toHaveProperty('valid')
          expect(result).toHaveProperty('errors')
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should return valid=true iff all requirements are met', () => {
      fc.assert(
        fc.property(fc.string(), (password) => {
          const result = validatePasswordStrength(password)

          const hasMinLength = password.length >= 12
          const hasUppercase = /[A-Z]/.test(password)
          const hasLowercase = /[a-z]/.test(password)
          const hasNumber = /[0-9]/.test(password)

          const shouldBeValid = hasMinLength && hasUppercase && hasLowercase && hasNumber

          expect(result.valid).toBe(shouldBeValid)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should have error count matching failed requirements', () => {
      fc.assert(
        fc.property(fc.string(), (password) => {
          const result = validatePasswordStrength(password)

          // Count expected errors
          let expectedErrors = 0
          if (password.length < 12) expectedErrors++
          if (!/[A-Z]/.test(password)) expectedErrors++
          if (!/[a-z]/.test(password)) expectedErrors++
          if (!/[0-9]/.test(password)) expectedErrors++

          expect(result.errors.length).toBe(expectedErrors)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle security-focused password strings', () => {
      fc.assert(
        fc.property(passwordString, (password) => {
          // Should never throw, even with malicious inputs
          const result = validatePasswordStrength(password)

          expect(result).toHaveProperty('valid')
          expect(result).toHaveProperty('errors')
          expect(typeof result.valid).toBe('boolean')
          expect(Array.isArray(result.errors)).toBe(true)

          // All errors should be strings
          for (const error of result.errors) {
            expect(typeof error).toBe('string')
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should be consistent across multiple calls with same input', () => {
      fc.assert(
        fc.property(fc.string(), (password) => {
          const result1 = validatePasswordStrength(password)
          const result2 = validatePasswordStrength(password)

          expect(result1.valid).toBe(result2.valid)
          expect(result1.errors).toEqual(result2.errors)
        }),
        FUZZ_CONFIG.quick,
      )
    })

    it('should validate known-good passwords as valid', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 8, maxLength: 100 }).map((base) => `Aa1${base}`), // Ensures uppercase, lowercase, number, and length >= 12
          (password) => {
            // Only test if the generated password actually meets requirements
            if (password.length >= 12) {
              const result = validatePasswordStrength(password)
              expect(result.valid).toBe(true)
              expect(result.errors).toHaveLength(0)
            }
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject passwords that are too short', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 11 }), (password) => {
          const result = validatePasswordStrength(password)
          expect(result.valid).toBe(false)
          expect(result.errors.some((e) => e.includes('12 characters'))).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle empty string', () => {
      const result = validatePasswordStrength('')
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(4) // All 4 requirements fail
    })

    it('should handle very long strings', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1000, maxLength: 10000 }), (password) => {
          // Should complete without timeout or memory issues
          const result = validatePasswordStrength(password)
          expect(result).toHaveProperty('valid')
        }),
        { ...FUZZ_CONFIG.quick, timeout: 5000 },
      )
    })
  })
})

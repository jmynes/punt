/**
 * Fuzz tests for registration schema validation.
 * Tests the Zod schema used in the registration API.
 */

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { invalidUsername, usernameArb, validUsername } from '../arbitraries'
import { emailLike, maliciousString, passwordString } from '../arbitraries/primitives'
import { FUZZ_CONFIG } from '../setup'

// Replicate the registration schema from the API route
const registerSchema = z.object({
  username: z
    .string()
    .transform((s) => s.normalize('NFC'))
    .pipe(
      z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .max(30, 'Username must be at most 30 characters')
        .regex(
          /^[a-zA-Z0-9_-]+$/,
          'Username can only contain letters, numbers, underscores, and hyphens',
        ),
    ),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  password: z.string().min(1, 'Password is required'),
})

describe('Registration Schema Fuzz Tests', () => {
  describe('Schema parsing', () => {
    it('should never crash on any input object', () => {
      fc.assert(
        fc.property(
          fc.record({
            username: fc.oneof(fc.string(), fc.anything()),
            name: fc.oneof(fc.string(), fc.anything()),
            email: fc.oneof(fc.string(), fc.anything()),
            password: fc.oneof(fc.string(), fc.anything()),
          }),
          (input) => {
            // Should never throw
            const result = registerSchema.safeParse(input)
            expect(result).toHaveProperty('success')
            expect(typeof result.success).toBe('boolean')
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should never crash on arbitrary JSON', () => {
      fc.assert(
        fc.property(fc.jsonValue(), (input) => {
          const result = registerSchema.safeParse(input)
          expect(result).toHaveProperty('success')
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should never crash on malicious string inputs', () => {
      fc.assert(
        fc.property(
          fc.record({
            username: maliciousString,
            name: maliciousString,
            email: maliciousString,
            password: maliciousString,
          }),
          (input) => {
            const result = registerSchema.safeParse(input)
            expect(result).toHaveProperty('success')
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('Username validation', () => {
    it('should accept valid usernames', () => {
      fc.assert(
        fc.property(validUsername, (username) => {
          const result = registerSchema.safeParse({
            username,
            name: 'Test User',
            email: 'test@example.com',
            password: 'Password123!',
          })

          expect(result.success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject invalid usernames', () => {
      fc.assert(
        fc.property(invalidUsername, (username) => {
          const result = registerSchema.safeParse({
            username,
            name: 'Test User',
            email: 'test@example.com',
            password: 'Password123!',
          })

          // Most invalid usernames should fail (some edge cases might pass)
          if (username.length >= 3 && username.length <= 30 && /^[a-zA-Z0-9_-]+$/.test(username)) {
            // This is actually valid
            expect(result.success).toBe(true)
          } else {
            expect(result.success).toBe(false)
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject usernames with special characters', () => {
      const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '+', '=', ' ', '.']

      for (const char of specialChars) {
        const result = registerSchema.safeParse({
          username: `user${char}name`,
          name: 'Test',
          email: '',
          password: 'test',
        })

        expect(result.success).toBe(false)
      }
    })

    it('should apply Unicode normalization consistently', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 3, maxLength: 30 }), (username) => {
          // NFC normalization should be applied
          const normalized = username.normalize('NFC')

          const result1 = registerSchema.safeParse({
            username,
            name: 'Test',
            email: '',
            password: 'test',
          })

          const result2 = registerSchema.safeParse({
            username: normalized,
            name: 'Test',
            email: '',
            password: 'test',
          })

          // Both should have same success status after normalization
          expect(result1.success).toBe(result2.success)

          // If successful, the data should be the same
          if (result1.success && result2.success) {
            expect(result1.data.username).toBe(result2.data.username)
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('Name validation', () => {
    it('should accept non-empty names', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (name) => {
          const result = registerSchema.safeParse({
            username: 'validuser',
            name,
            email: '',
            password: 'test',
          })

          expect(result.success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject empty names', () => {
      const result = registerSchema.safeParse({
        username: 'validuser',
        name: '',
        email: '',
        password: 'test',
      })

      expect(result.success).toBe(false)
    })

    it('should handle names with special characters', () => {
      fc.assert(
        fc.property(maliciousString, (name) => {
          // Skip empty strings which are expected to fail
          if (name.length === 0) return

          const result = registerSchema.safeParse({
            username: 'validuser',
            name,
            email: '',
            password: 'test',
          })

          // Should not crash, and non-empty names should be accepted
          expect(result).toHaveProperty('success')
          expect(result.success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('Email validation', () => {
    // Simple email generator compatible with Zod's stricter validator
    const simpleEmail = fc
      .tuple(
        fc
          .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
            minLength: 1,
            maxLength: 20,
          })
          .map((chars) => chars.join('')),
        fc.constantFrom('example.com', 'test.org', 'mail.io'),
      )
      .map(([local, domain]) => `${local}@${domain}`)

    it('should accept valid emails', () => {
      fc.assert(
        fc.property(simpleEmail, (email) => {
          const result = registerSchema.safeParse({
            username: 'validuser',
            name: 'Test',
            email,
            password: 'test',
          })

          expect(result.success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should accept empty string for email', () => {
      const result = registerSchema.safeParse({
        username: 'validuser',
        name: 'Test',
        email: '',
        password: 'test',
      })

      expect(result.success).toBe(true)
    })

    it('should reject invalid emails', () => {
      const invalidEmails = [
        'invalid',
        '@nodomain',
        'no@tld',
        'spaces in@email.com',
        'missing@.com',
        '@.com',
        'double@@at.com',
      ]

      for (const email of invalidEmails) {
        const result = registerSchema.safeParse({
          username: 'validuser',
          name: 'Test',
          email,
          password: 'test',
        })

        expect(result.success).toBe(false)
      }
    })

    it('should handle email-like strings safely', () => {
      fc.assert(
        fc.property(emailLike, (email) => {
          const result = registerSchema.safeParse({
            username: 'validuser',
            name: 'Test',
            email,
            password: 'test',
          })

          // Should not crash
          expect(result).toHaveProperty('success')
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('Password validation', () => {
    it('should accept non-empty passwords', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (password) => {
          const result = registerSchema.safeParse({
            username: 'validuser',
            name: 'Test',
            email: '',
            password,
          })

          expect(result.success).toBe(true)
        }),
        FUZZ_CONFIG.standard,
      )
    })

    it('should reject empty passwords', () => {
      const result = registerSchema.safeParse({
        username: 'validuser',
        name: 'Test',
        email: '',
        password: '',
      })

      expect(result.success).toBe(false)
    })

    it('should handle password strings with special chars', () => {
      fc.assert(
        fc.property(passwordString, (password) => {
          const result = registerSchema.safeParse({
            username: 'validuser',
            name: 'Test',
            email: '',
            password,
          })

          // Should not crash
          expect(result).toHaveProperty('success')

          // Empty passwords should fail, others should pass schema (strength is checked separately)
          if (password.length > 0) {
            expect(result.success).toBe(true)
          } else {
            expect(result.success).toBe(false)
          }
        }),
        FUZZ_CONFIG.standard,
      )
    })
  })

  describe('Full registration payload', () => {
    // Simple email generator that's compatible with Zod's validator
    const simpleEmail = fc
      .tuple(
        fc
          .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
            minLength: 1,
            maxLength: 20,
          })
          .map((chars) => chars.join('')),
        fc.constantFrom('example.com', 'test.org', 'mail.io'),
      )
      .map(([local, domain]) => `${local}@${domain}`)

    it('should accept complete valid payloads', () => {
      fc.assert(
        fc.property(
          validUsername,
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.option(simpleEmail, { nil: '' }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (username, name, email, password) => {
            const result = registerSchema.safeParse({
              username,
              name,
              email: email || '',
              password,
            })

            expect(result.success).toBe(true)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle missing fields', () => {
      const testCases = [
        {},
        { username: 'user' },
        { name: 'Test' },
        { password: 'pass' },
        { username: 'user', name: 'Test' },
        { username: 'user', password: 'pass' },
        { name: 'Test', password: 'pass' },
      ]

      for (const testCase of testCases) {
        const result = registerSchema.safeParse(testCase)
        expect(result.success).toBe(false)
      }
    })

    it('should handle extra fields gracefully', () => {
      fc.assert(
        fc.property(
          fc.record({
            username: validUsername,
            name: fc.string({ minLength: 1 }),
            email: fc.constant(''),
            password: fc.string({ minLength: 1 }),
            extraField: fc.anything(),
            anotherExtra: fc.anything(),
          }),
          (input) => {
            const result = registerSchema.safeParse(input)
            // Extra fields should be ignored (not cause failure)
            expect(result.success).toBe(true)
          },
        ),
        FUZZ_CONFIG.standard,
      )
    })

    it('should handle null and undefined values', () => {
      const testCases = [
        { username: null, name: 'Test', email: '', password: 'test' },
        { username: 'user', name: null, email: '', password: 'test' },
        { username: 'user', name: 'Test', email: null, password: 'test' },
        { username: 'user', name: 'Test', email: '', password: null },
        { username: undefined, name: 'Test', email: '', password: 'test' },
        { username: 'user', name: undefined, email: '', password: 'test' },
      ]

      for (const testCase of testCases) {
        const result = registerSchema.safeParse(testCase)
        expect(result.success).toBe(false)
      }
    })
  })

  describe('Error messages', () => {
    it('should provide meaningful error messages', () => {
      const result = registerSchema.safeParse({
        username: 'ab', // Too short
        name: '', // Empty
        email: 'invalid', // Not an email
        password: '', // Empty
      })

      expect(result.success).toBe(false)

      if (!result.success) {
        const errors = result.error.flatten()
        expect(errors.fieldErrors).toHaveProperty('username')
        expect(errors.fieldErrors).toHaveProperty('name')
        expect(errors.fieldErrors).toHaveProperty('email')
        expect(errors.fieldErrors).toHaveProperty('password')
      }
    })
  })
})

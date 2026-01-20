import { describe, expect, it } from 'vitest'
import { hashPassword, validatePasswordStrength, verifyPassword } from '../password'

describe('Password Validation', () => {
  describe('validatePasswordStrength', () => {
    // Basic requirements
    it('should reject passwords shorter than 12 characters', () => {
      const result = validatePasswordStrength('Abc1234567')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Password must be at least 12 characters long')
    })

    it('should reject passwords without uppercase letters', () => {
      const result = validatePasswordStrength('abcdefghijk1')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one uppercase letter')
    })

    it('should reject passwords without lowercase letters', () => {
      const result = validatePasswordStrength('ABCDEFGHIJK1')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one lowercase letter')
    })

    it('should reject passwords without numbers', () => {
      const result = validatePasswordStrength('Abcdefghijkl')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one number')
    })

    it('should accept valid passwords meeting all requirements', () => {
      const result = validatePasswordStrength('Abcdefghijk1')
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    // Special characters - ALL should be allowed
    describe('special characters', () => {
      const specialChars = [
        '!',
        '@',
        '#',
        '$',
        '%',
        '^',
        '&',
        '*',
        '(',
        ')',
        '-',
        '_',
        '=',
        '+',
        '[',
        ']',
        '{',
        '}',
        '|',
        '\\',
        ':',
        ';',
        '"',
        "'",
        '<',
        '>',
        ',',
        '.',
        '?',
        '/',
        '`',
        '~',
        ' ',
        '\t',
      ]

      specialChars.forEach((char) => {
        it(`should allow special character: ${char === ' ' ? 'space' : char === '\t' ? 'tab' : char}`, () => {
          const password = `Abcdefghi1${char}k`
          const result = validatePasswordStrength(password)
          expect(result.valid).toBe(true)
          expect(result.errors).toHaveLength(0)
        })
      })
    })

    // Unicode characters
    describe('unicode characters', () => {
      const unicodeChars = [
        'é',
        'ñ',
        'ü',
        'ß',
        'ç',
        'ø',
        'å',
        'æ', // European
        '中',
        '文',
        '日',
        '本',
        '語', // CJK
        'א',
        'ב',
        'ג', // Hebrew
        'α',
        'β',
        'γ',
        'δ', // Greek
        '😀',
        '🔐',
        '🎉', // Emoji
        '→',
        '←',
        '↑',
        '↓', // Arrows
        '•',
        '★',
        '♠',
        '♣', // Symbols
      ]

      unicodeChars.forEach((char) => {
        it(`should allow unicode character: ${char}`, () => {
          const password = `Abcdefghi1${char}k`
          const result = validatePasswordStrength(password)
          expect(result.valid).toBe(true)
          expect(result.errors).toHaveLength(0)
        })
      })
    })

    // Edge cases
    describe('edge cases', () => {
      it('should handle empty string', () => {
        const result = validatePasswordStrength('')
        expect(result.valid).toBe(false)
      })

      it('should handle very long passwords', () => {
        const longPassword = `A${'a'.repeat(998)}1`
        const result = validatePasswordStrength(longPassword)
        expect(result.valid).toBe(true)
      })

      it('should handle password with only whitespace plus requirements', () => {
        const password = 'Aa1         ' // 12 chars with spaces
        const result = validatePasswordStrength(password)
        expect(result.valid).toBe(true)
      })

      it('should handle null bytes', () => {
        const password = 'Abcdefghi1\0k'
        const result = validatePasswordStrength(password)
        expect(result.valid).toBe(true)
      })

      it('should handle newlines', () => {
        const password = 'Abcdefghi1\nk'
        const result = validatePasswordStrength(password)
        expect(result.valid).toBe(true)
      })

      it('should handle carriage returns', () => {
        const password = 'Abcdefghi1\rk'
        const result = validatePasswordStrength(password)
        expect(result.valid).toBe(true)
      })
    })

    // SQL injection attempts (should be allowed - validation doesn't block them)
    describe('SQL injection strings', () => {
      const sqlInjections = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        '1; SELECT * FROM users',
        "' UNION SELECT * FROM passwords--",
      ]

      sqlInjections.forEach((injection) => {
        it(`should allow SQL-like string in password: ${injection.substring(0, 20)}...`, () => {
          // Add uppercase and number to meet requirements
          const password = `A1${injection}`.padEnd(12, 'x')
          const result = validatePasswordStrength(password)
          // Should be valid (or invalid only due to length/case/number requirements)
          // The SQL string itself should not cause rejection
          if (
            password.length >= 12 &&
            /[A-Z]/.test(password) &&
            /[a-z]/.test(password) &&
            /[0-9]/.test(password)
          ) {
            expect(result.valid).toBe(true)
          }
        })
      })
    })

    // XSS attempts (should be allowed in password)
    describe('XSS-like strings', () => {
      const xssStrings = [
        '<script>alert(1)</script>',
        '"><img src=x onerror=alert(1)>',
        "javascript:alert('XSS')",
        '<svg onload=alert(1)>',
      ]

      xssStrings.forEach((xss) => {
        it(`should allow XSS-like string in password: ${xss.substring(0, 20)}...`, () => {
          const password = `A1${xss}`.padEnd(12, 'x')
          const result = validatePasswordStrength(password)
          if (
            password.length >= 12 &&
            /[A-Z]/.test(password) &&
            /[a-z]/.test(password) &&
            /[0-9]/.test(password)
          ) {
            expect(result.valid).toBe(true)
          }
        })
      })
    })
  })

  describe('hashPassword and verifyPassword', () => {
    it('should hash and verify a simple password', async () => {
      const password = 'Abcdefghijk1'
      const hash = await hashPassword(password)
      expect(hash).not.toBe(password)
      expect(await verifyPassword(password, hash)).toBe(true)
      expect(await verifyPassword('wrong', hash)).toBe(false)
    })

    // Test that all special characters work with bcrypt
    describe('special characters with bcrypt', () => {
      const specialChars = [
        '!',
        '@',
        '#',
        '$',
        '%',
        '^',
        '&',
        '*',
        '(',
        ')',
        '[',
        ']',
        '{',
        '}',
        '|',
        '\\',
        ':',
        ';',
        '"',
        "'",
        '<',
        '>',
        ',',
        '.',
        '?',
        '/',
        '`',
        '~',
        ' ',
      ]

      specialChars.forEach((char) => {
        it(`should hash and verify password with special char: ${char === ' ' ? 'space' : char}`, async () => {
          const password = `Abcdefghi1${char}k`
          const hash = await hashPassword(password)
          expect(await verifyPassword(password, hash)).toBe(true)
          expect(await verifyPassword(password.replace(char, 'X'), hash)).toBe(false)
        })
      })
    })

    // Unicode with bcrypt
    describe('unicode characters with bcrypt', () => {
      const unicodeChars = ['é', 'ñ', '中', '文', '😀', '🔐']

      unicodeChars.forEach((char) => {
        it(`should hash and verify password with unicode: ${char}`, async () => {
          const password = `Abcdefghi1${char}k`
          const hash = await hashPassword(password)
          expect(await verifyPassword(password, hash)).toBe(true)
        })
      })
    })

    // Edge cases with bcrypt
    it('should handle very long passwords', async () => {
      // Note: bcrypt truncates at 72 bytes, but this shouldn't cause errors
      const longPassword = `A${'a'.repeat(100)}1`
      const hash = await hashPassword(longPassword)
      expect(await verifyPassword(longPassword, hash)).toBe(true)
    })

    it('should handle password with null bytes', async () => {
      // Note: bcrypt may truncate at null byte
      const password = 'Abcdefghi1\0klmnop'
      const hash = await hashPassword(password)
      expect(await verifyPassword(password, hash)).toBe(true)
    })

    it('should handle password with newlines', async () => {
      const password = 'Abcdefghi1\nklmnop'
      const hash = await hashPassword(password)
      expect(await verifyPassword(password, hash)).toBe(true)
    })
  })
})

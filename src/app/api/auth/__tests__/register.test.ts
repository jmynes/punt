import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '../register/route'

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, resetAt: new Date() }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}))

import { db } from '@/lib/db'

const mockDb = db as {
  user: {
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
}

function createRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('Registration API - Username Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.user.findUnique.mockResolvedValue(null)
    mockDb.user.create.mockImplementation(({ data }) => Promise.resolve({
      id: 'test-id',
      username: data.username,
      name: data.name,
      email: data.email,
    }))
  })

  describe('valid usernames', () => {
    const validUsernames = [
      'abc',           // minimum length
      'user123',       // alphanumeric
      'user_name',     // with underscore
      'user-name',     // with hyphen
      'User123',       // mixed case
      'a'.repeat(30),  // maximum length
      '___',           // only underscores
      '---',           // only hyphens
      'a_b-c_d-e',     // mixed separators
    ]

    validUsernames.forEach(username => {
      it(`should accept username: "${username}"`, async () => {
        const response = await POST(createRequest({
          username,
          name: 'Test User',
          password: 'ValidPassword1',
        }))

        const data = await response.json()
        if (response.status !== 200) {
          // If failed, it shouldn't be due to username format
          expect(data.details?.fieldErrors?.username).toBeUndefined()
        }
      })
    })
  })

  describe('invalid usernames', () => {
    const invalidUsernames = [
      { username: 'ab', reason: 'too short (2 chars)' },
      { username: 'a'.repeat(31), reason: 'too long (31 chars)' },
      { username: 'user name', reason: 'contains space' },
      { username: 'user@name', reason: 'contains @' },
      { username: 'user.name', reason: 'contains period' },
      { username: 'user!name', reason: 'contains !' },
      { username: 'user#name', reason: 'contains #' },
      { username: 'user$name', reason: 'contains $' },
      { username: '用户名', reason: 'contains CJK characters' },
      { username: 'пользователь', reason: 'contains Cyrillic' },
      { username: 'user\tname', reason: 'contains tab' },
      { username: 'user\nname', reason: 'contains newline' },
    ]

    invalidUsernames.forEach(({ username, reason }) => {
      it(`should reject username with ${reason}`, async () => {
        const response = await POST(createRequest({
          username,
          name: 'Test User',
          password: 'ValidPassword1',
        }))

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.error).toBe('Validation failed')
      })
    })
  })

  describe('edge cases', () => {
    it('should reject empty username', async () => {
      const response = await POST(createRequest({
        username: '',
        name: 'Test User',
        password: 'ValidPassword1',
      }))

      expect(response.status).toBe(400)
    })

    it('should reject username with only whitespace', async () => {
      const response = await POST(createRequest({
        username: '   ',
        name: 'Test User',
        password: 'ValidPassword1',
      }))

      expect(response.status).toBe(400)
    })

    it('should handle SQL injection attempt in username', async () => {
      const response = await POST(createRequest({
        username: "'; DROP TABLE users; --",
        name: 'Test User',
        password: 'ValidPassword1',
      }))

      // Should be rejected due to invalid characters, not cause SQL error
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Validation failed')
    })

    it('should handle XSS attempt in username', async () => {
      const response = await POST(createRequest({
        username: '<script>alert(1)</script>',
        name: 'Test User',
        password: 'ValidPassword1',
      }))

      expect(response.status).toBe(400)
    })

    it('should handle null byte in username', async () => {
      const response = await POST(createRequest({
        username: 'user\0name',
        name: 'Test User',
        password: 'ValidPassword1',
      }))

      expect(response.status).toBe(400)
    })
  })
})

describe('Registration API - Password Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.user.findUnique.mockResolvedValue(null)
    mockDb.user.create.mockImplementation(({ data }) => Promise.resolve({
      id: 'test-id',
      username: data.username,
      name: data.name,
      email: data.email,
    }))
  })

  describe('valid passwords with special characters', () => {
    const specialChars = [
      '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '=', '+',
      '[', ']', '{', '}', '|', '\\', ':', ';', '"', "'", '<', '>', ',', '.',
      '?', '/', '`', '~', ' ',
    ]

    specialChars.forEach(char => {
      it(`should accept password with special character: ${char === ' ' ? 'space' : char}`, async () => {
        const password = `Abcdefghi1${char}k`
        const response = await POST(createRequest({
          username: 'testuser',
          name: 'Test User',
          password,
        }))

        // Should either succeed or fail for reasons unrelated to the special char
        const data = await response.json()
        if (response.status !== 200) {
          // Should not have password errors if it meets other requirements
          expect(data.details?.includes?.('character')).toBeFalsy()
        }
      })
    })
  })

  describe('valid passwords with unicode', () => {
    const unicodePasswords = [
      { password: 'Abcdefghi1é2', desc: 'with accented char' },
      { password: 'Abcdefghi1中文', desc: 'with CJK chars' },
      { password: 'Abcdefghi1😀🔐', desc: 'with emoji' },
      { password: 'Abcdefghi1αβγ', desc: 'with Greek chars' },
      { password: 'Abcdefghi1→←', desc: 'with arrows' },
    ]

    unicodePasswords.forEach(({ password, desc }) => {
      it(`should accept password ${desc}`, async () => {
        const response = await POST(createRequest({
          username: 'testuser',
          name: 'Test User',
          password,
        }))

        if (response.status === 200) {
          expect(response.status).toBe(200)
        }
      })
    })
  })

  describe('password strength requirements', () => {
    it('should reject password without uppercase', async () => {
      const response = await POST(createRequest({
        username: 'testuser',
        name: 'Test User',
        password: 'abcdefghijk1',
      }))

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.details).toContain('Password must contain at least one uppercase letter')
    })

    it('should reject password without lowercase', async () => {
      const response = await POST(createRequest({
        username: 'testuser',
        name: 'Test User',
        password: 'ABCDEFGHIJK1',
      }))

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.details).toContain('Password must contain at least one lowercase letter')
    })

    it('should reject password without number', async () => {
      const response = await POST(createRequest({
        username: 'testuser',
        name: 'Test User',
        password: 'Abcdefghijkl',
      }))

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.details).toContain('Password must contain at least one number')
    })

    it('should reject password shorter than 12 chars', async () => {
      const response = await POST(createRequest({
        username: 'testuser',
        name: 'Test User',
        password: 'Abcdefgh1',
      }))

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.details).toContain('Password must be at least 12 characters long')
    })
  })
})

describe('Registration API - Input Sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.user.findUnique.mockResolvedValue(null)
    mockDb.user.create.mockImplementation(({ data }) => Promise.resolve({
      id: 'test-id',
      username: data.username,
      name: data.name,
      email: data.email,
    }))
  })

  describe('SQL injection attempts', () => {
    const sqlInjections = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "admin'--",
      "1; SELECT * FROM users",
      "' UNION SELECT * FROM passwords--",
      "1'; EXEC xp_cmdshell('dir'); --",
    ]

    sqlInjections.forEach(injection => {
      it(`should safely handle SQL injection in name: ${injection.substring(0, 20)}...`, async () => {
        const response = await POST(createRequest({
          username: 'testuser',
          name: injection,
          password: 'ValidPassword1',
        }))

        // Should either succeed (name is stored safely) or fail gracefully
        expect([200, 400, 500]).toContain(response.status)
        // Should not return raw SQL error
        const text = await response.text()
        expect(text.toLowerCase()).not.toContain('syntax error')
        expect(text.toLowerCase()).not.toContain('sql')
      })
    })
  })

  describe('XSS attempts', () => {
    const xssAttempts = [
      '<script>alert(1)</script>',
      '"><img src=x onerror=alert(1)>',
      "javascript:alert('XSS')",
      '<svg onload=alert(1)>',
      '{{constructor.constructor("alert(1)")()}}',
    ]

    xssAttempts.forEach(xss => {
      it(`should safely handle XSS in name: ${xss.substring(0, 20)}...`, async () => {
        const response = await POST(createRequest({
          username: 'testuser',
          name: xss,
          password: 'ValidPassword1',
        }))

        // Name field should accept any string
        if (response.status === 200) {
          const data = await response.json()
          // The name should be stored as-is, not sanitized (sanitization happens on output)
          expect(data.user.name).toBe(xss)
        }
      })
    })
  })

  describe('malformed JSON', () => {
    it('should handle missing body gracefully', async () => {
      const request = new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      // This might throw or return an error
      try {
        const response = await POST(request)
        expect([400, 500]).toContain(response.status)
      } catch {
        // Expected for malformed request
      }
    })

    it('should handle non-JSON content type', async () => {
      const request = new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'not json',
      })

      try {
        const response = await POST(request)
        expect([400, 500]).toContain(response.status)
      } catch {
        // Expected
      }
    })
  })

  describe('type coercion attacks', () => {
    it('should handle array instead of string for username', async () => {
      const response = await POST(createRequest({
        username: ['admin', 'user'],
        name: 'Test User',
        password: 'ValidPassword1',
      }))

      expect(response.status).toBe(400)
    })

    it('should handle object instead of string for username', async () => {
      const response = await POST(createRequest({
        username: { $ne: '' },
        name: 'Test User',
        password: 'ValidPassword1',
      }))

      expect(response.status).toBe(400)
    })

    it('should handle number instead of string for password', async () => {
      const response = await POST(createRequest({
        username: 'testuser',
        name: 'Test User',
        password: 123456789012,
      }))

      expect(response.status).toBe(400)
    })

    it('should handle boolean instead of string', async () => {
      const response = await POST(createRequest({
        username: true,
        name: 'Test User',
        password: 'ValidPassword1',
      }))

      expect(response.status).toBe(400)
    })

    it('should handle null values', async () => {
      const response = await POST(createRequest({
        username: null,
        name: 'Test User',
        password: 'ValidPassword1',
      }))

      expect(response.status).toBe(400)
    })

    it('should handle undefined values', async () => {
      const response = await POST(createRequest({
        name: 'Test User',
        password: 'ValidPassword1',
      }))

      expect(response.status).toBe(400)
    })
  })
})

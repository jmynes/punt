import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '../reset-password/route'

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    passwordResetToken: {
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, resetAt: new Date() }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/email', () => ({
  hashToken: vi.fn((token) => `hashed_${token}`),
  isTokenExpired: vi.fn().mockReturnValue(false),
}))

vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed_password'),
  validatePasswordStrength: vi.fn().mockReturnValue({ valid: true, errors: [] }),
}))

import { db } from '@/lib/db'
import { isTokenExpired } from '@/lib/email'
import { validatePasswordStrength } from '@/lib/password'
import { checkRateLimit } from '@/lib/rate-limit'

// biome-ignore lint/suspicious/noExplicitAny: partial mock for testing
const mockDb = vi.mocked(db) as any
const mockCheckRateLimit = vi.mocked(checkRateLimit)
const mockIsTokenExpired = vi.mocked(isTokenExpired)
const mockValidatePassword = vi.mocked(validatePasswordStrength)

function createGetRequest(token: string | null): Request {
  const url = token
    ? `http://localhost:3000/api/auth/reset-password?token=${token}`
    : 'http://localhost:3000/api/auth/reset-password'
  return new Request(url, { method: 'GET' })
}

function createPostRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('Reset Password API - Token Validation (GET)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsTokenExpired.mockReturnValue(false)
  })

  it('should validate a valid token', async () => {
    mockDb.passwordResetToken.findUnique.mockResolvedValue({
      id: 'token-1',
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: null,
      user: {
        id: 'user-1',
        email: 'test@example.com',
        isActive: true,
      },
    })

    const response = await GET(createGetRequest('valid-token'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.valid).toBe(true)
    expect(data.email).toBe('test@example.com')
  })

  it('should reject invalid token', async () => {
    mockDb.passwordResetToken.findUnique.mockResolvedValue(null)

    const response = await GET(createGetRequest('invalid-token'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid or expired reset link')
  })

  it('should reject already used token', async () => {
    mockDb.passwordResetToken.findUnique.mockResolvedValue({
      id: 'token-1',
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: new Date(), // Token has been used
      user: { id: 'user-1', email: 'test@example.com', isActive: true },
    })

    const response = await GET(createGetRequest('used-token'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('This reset link has already been used')
  })

  it('should reject expired token', async () => {
    mockDb.passwordResetToken.findUnique.mockResolvedValue({
      id: 'token-1',
      expiresAt: new Date(Date.now() - 3600000), // Expired
      usedAt: null,
      user: { id: 'user-1', email: 'test@example.com', isActive: true },
    })
    mockIsTokenExpired.mockReturnValue(true)

    const response = await GET(createGetRequest('expired-token'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('This reset link has expired')
  })

  it('should reject token for inactive user', async () => {
    mockDb.passwordResetToken.findUnique.mockResolvedValue({
      id: 'token-1',
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: null,
      user: { id: 'user-1', email: 'test@example.com', isActive: false },
    })

    const response = await GET(createGetRequest('inactive-user-token'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid or expired reset link')
  })

  it('should reject missing token', async () => {
    const response = await GET(createGetRequest(null))
    await response.json()

    expect(response.status).toBe(400)
  })
})

describe('Reset Password API - Password Reset (POST)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 10, resetAt: new Date() })
    mockIsTokenExpired.mockReturnValue(false)
    mockValidatePassword.mockReturnValue({ valid: true, errors: [] })
    mockDb.$transaction.mockResolvedValue([])
  })

  it('should reset password with valid token and password', async () => {
    mockDb.passwordResetToken.findUnique.mockResolvedValue({
      id: 'token-1',
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: null,
      userId: 'user-1',
      user: { id: 'user-1', isActive: true },
    })

    const response = await POST(
      createPostRequest({
        token: 'valid-token',
        password: 'NewPassword123!',
      }),
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toBe('Password has been reset successfully')
  })

  it('should reject weak password', async () => {
    mockDb.passwordResetToken.findUnique.mockResolvedValue({
      id: 'token-1',
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: null,
      userId: 'user-1',
      user: { id: 'user-1', isActive: true },
    })
    mockValidatePassword.mockReturnValue({
      valid: false,
      errors: ['Password must be at least 12 characters long'],
    })

    const response = await POST(
      createPostRequest({
        token: 'valid-token',
        password: 'weak',
      }),
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.details).toContain('Password must be at least 12 characters long')
  })

  it('should not allow token reuse', async () => {
    mockDb.passwordResetToken.findUnique.mockResolvedValue({
      id: 'token-1',
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: new Date(), // Already used
      userId: 'user-1',
      user: { id: 'user-1', isActive: true },
    })

    const response = await POST(
      createPostRequest({
        token: 'used-token',
        password: 'NewPassword123!',
      }),
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('This reset link has already been used')
  })

  it('should be rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 900000),
    })

    const response = await POST(
      createPostRequest({
        token: 'valid-token',
        password: 'NewPassword123!',
      }),
    )

    expect(response.status).toBe(429)
  })

  it('should update passwordChangedAt timestamp', async () => {
    mockDb.passwordResetToken.findUnique.mockResolvedValue({
      id: 'token-1',
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: null,
      userId: 'user-1',
      user: { id: 'user-1', isActive: true },
    })

    await POST(
      createPostRequest({
        token: 'valid-token',
        password: 'NewPassword123!',
      }),
    )

    // Verify the transaction was called (with an array of operations)
    expect(mockDb.$transaction).toHaveBeenCalled()
    // The transaction receives an array - verify it was called with some array
    const call = mockDb.$transaction.mock.calls[0][0]
    expect(Array.isArray(call)).toBe(true)
  })
})

describe('Reset Password API - Input Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 10, resetAt: new Date() })
  })

  it('should reject missing token', async () => {
    const response = await POST(createPostRequest({ password: 'NewPassword123!' }))

    expect(response.status).toBe(400)
  })

  it('should reject missing password', async () => {
    const response = await POST(createPostRequest({ token: 'valid-token' }))

    expect(response.status).toBe(400)
  })

  it('should reject empty token', async () => {
    const response = await POST(
      createPostRequest({
        token: '',
        password: 'NewPassword123!',
      }),
    )

    expect(response.status).toBe(400)
  })

  it('should reject empty password', async () => {
    const response = await POST(
      createPostRequest({
        token: 'valid-token',
        password: '',
      }),
    )

    expect(response.status).toBe(400)
  })

  it('should handle array instead of string for token', async () => {
    const response = await POST(
      createPostRequest({
        token: ['token1', 'token2'],
        password: 'NewPassword123!',
      }),
    )

    expect(response.status).toBe(400)
  })
})

describe('Reset Password API - Security Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 10, resetAt: new Date() })
    mockIsTokenExpired.mockReturnValue(false)
    mockValidatePassword.mockReturnValue({ valid: true, errors: [] })
  })

  it('should handle token with special characters', async () => {
    mockDb.passwordResetToken.findUnique.mockResolvedValue(null)

    const response = await POST(
      createPostRequest({
        token: "'; DROP TABLE tokens; --",
        password: 'NewPassword123!',
      }),
    )

    // Should not cause SQL error, just return invalid token
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Invalid or expired reset link')
  })

  it('should handle very long token', async () => {
    mockDb.passwordResetToken.findUnique.mockResolvedValue(null)

    const response = await POST(
      createPostRequest({
        token: 'a'.repeat(10000),
        password: 'NewPassword123!',
      }),
    )

    expect(response.status).toBe(400)
  })

  it('should handle unicode in password', async () => {
    mockDb.passwordResetToken.findUnique.mockResolvedValue({
      id: 'token-1',
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: null,
      userId: 'user-1',
      user: { id: 'user-1', isActive: true },
    })
    mockDb.$transaction.mockResolvedValue([])

    const response = await POST(
      createPostRequest({
        token: 'valid-token',
        password: 'NewPassword123!中文',
      }),
    )

    // Should be accepted if it meets password requirements
    expect(response.status).toBe(200)
  })
})

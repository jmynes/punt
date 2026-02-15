import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../forgot-password/route'

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findFirst: vi.fn(),
    },
    passwordResetToken: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, resetAt: new Date() }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/email', () => ({
  generateToken: vi.fn().mockReturnValue('test-token-abc123'),
  hashToken: vi.fn().mockReturnValue('hashed-token'),
  getExpirationDate: vi.fn().mockReturnValue(new Date(Date.now() + 3600000)),
  getAppUrl: vi.fn().mockReturnValue('http://localhost:3000'),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  isEmailFeatureEnabled: vi.fn().mockResolvedValue(true),
  TOKEN_EXPIRY: { PASSWORD_RESET: 3600000 },
}))

import { db } from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/email'
import { checkRateLimit } from '@/lib/rate-limit'

// biome-ignore lint/suspicious/noExplicitAny: partial mock for testing
const mockDb = vi.mocked(db) as any
const mockCheckRateLimit = vi.mocked(checkRateLimit)
const mockSendEmail = vi.mocked(sendPasswordResetEmail)

function createRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('Forgot Password API - Email Enumeration Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 10, resetAt: new Date() })
  })

  it('should return same response for existing email', async () => {
    mockDb.user.findFirst.mockResolvedValue({
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
    })

    const response = await POST(createRequest({ email: 'test@example.com' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toBe(
      'If an account with that email exists, a password reset link has been sent.',
    )
  })

  it('should return same response for non-existing email', async () => {
    mockDb.user.findFirst.mockResolvedValue(null)

    const response = await POST(createRequest({ email: 'nonexistent@example.com' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toBe(
      'If an account with that email exists, a password reset link has been sent.',
    )
  })

  it('should only send email when user exists', async () => {
    // Test with existing user
    mockDb.user.findFirst.mockResolvedValue({
      id: 'user-1',
      name: 'Test User',
      email: 'existing@example.com',
    })
    await POST(createRequest({ email: 'existing@example.com' }))
    expect(mockSendEmail).toHaveBeenCalledTimes(1)

    vi.clearAllMocks()

    // Test with non-existing user
    mockDb.user.findFirst.mockResolvedValue(null)
    await POST(createRequest({ email: 'nonexistent@example.com' }))
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('should normalize email to lowercase', async () => {
    mockDb.user.findFirst.mockResolvedValue(null)

    await POST(createRequest({ email: 'TEST@EXAMPLE.COM' }))

    expect(mockDb.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: 'test@example.com',
        isActive: true,
      },
      select: expect.any(Object),
    })
  })

  it('should not send email for inactive users', async () => {
    // findFirst with isActive: true will return null for inactive users
    mockDb.user.findFirst.mockResolvedValue(null)

    const response = await POST(createRequest({ email: 'inactive@example.com' }))

    expect(response.status).toBe(200)
    expect(mockSendEmail).not.toHaveBeenCalled()
  })
})

describe('Forgot Password API - Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.user.findFirst.mockResolvedValue(null)
  })

  it('should rate limit by email', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 3600000),
    })

    const response = await POST(createRequest({ email: 'test@example.com' }))

    expect(response.status).toBe(429)
    const data = await response.json()
    expect(data.error).toContain('Too many requests')
  })

  it('should rate limit by IP after email check passes', async () => {
    mockCheckRateLimit
      .mockResolvedValueOnce({ allowed: true, remaining: 2, resetAt: new Date() }) // email check
      .mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + 3600000),
      }) // IP check

    const response = await POST(createRequest({ email: 'test@example.com' }))

    expect(response.status).toBe(429)
  })

  it('should set rate limit headers on 429', async () => {
    const resetAt = new Date(Date.now() + 3600000)
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt,
    })

    const response = await POST(createRequest({ email: 'test@example.com' }))

    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(response.headers.get('X-RateLimit-Reset')).toBe(resetAt.toISOString())
  })
})

describe('Forgot Password API - Input Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 10, resetAt: new Date() })
  })

  it('should reject invalid email format', async () => {
    const response = await POST(createRequest({ email: 'not-an-email' }))

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Invalid request data')
  })

  it('should reject empty email', async () => {
    const response = await POST(createRequest({ email: '' }))

    expect(response.status).toBe(400)
  })

  it('should reject missing email field', async () => {
    const response = await POST(createRequest({}))

    expect(response.status).toBe(400)
  })

  it('should reject array instead of string', async () => {
    const response = await POST(createRequest({ email: ['test@example.com'] }))

    expect(response.status).toBe(400)
  })

  it('should handle SQL injection in email', async () => {
    mockDb.user.findFirst.mockResolvedValue(null)

    const response = await POST(createRequest({ email: "test@example.com'; DROP TABLE users; --" }))

    // Should fail validation due to invalid email format
    expect(response.status).toBe(400)
  })
})

describe('Forgot Password API - Token Security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 10, resetAt: new Date() })
    mockDb.user.findFirst.mockResolvedValue({
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
    })
  })

  it('should delete old tokens before creating new one', async () => {
    await POST(createRequest({ email: 'test@example.com' }))

    expect(mockDb.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    })
    expect(mockDb.passwordResetToken.create).toHaveBeenCalled()
  })

  it('should store hashed token, not plaintext', async () => {
    await POST(createRequest({ email: 'test@example.com' }))

    expect(mockDb.passwordResetToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tokenHash: 'hashed-token', // Should be hash, not 'test-token-abc123'
      }),
    })
  })
})

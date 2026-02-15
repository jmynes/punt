import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '../verify-email/route'

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    emailVerificationToken: {
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
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

import { db } from '@/lib/db'
import { isTokenExpired } from '@/lib/email'
import { checkRateLimit } from '@/lib/rate-limit'

// biome-ignore lint/suspicious/noExplicitAny: partial mock for testing
const mockDb = vi.mocked(db) as any
const mockCheckRateLimit = vi.mocked(checkRateLimit)
const mockIsTokenExpired = vi.mocked(isTokenExpired)

function createGetRequest(token: string | null): Request {
  const url = token
    ? `http://localhost:3000/api/auth/verify-email?token=${token}`
    : 'http://localhost:3000/api/auth/verify-email'
  return new Request(url, { method: 'GET' })
}

function createPostRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('Verify Email API - Token Validation (GET)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsTokenExpired.mockReturnValue(false)
  })

  it('should validate a valid token', async () => {
    mockDb.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'token-1',
      email: 'new@example.com',
      expiresAt: new Date(Date.now() + 3600000),
      user: {
        id: 'user-1',
        email: 'old@example.com',
        isActive: true,
      },
    })

    const response = await GET(createGetRequest('valid-token'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.valid).toBe(true)
    expect(data.email).toBe('new@example.com')
    expect(data.currentEmail).toBe('old@example.com')
    expect(data.willUpdateEmail).toBe(true)
  })

  it('should indicate when email is same (verification only)', async () => {
    mockDb.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'token-1',
      email: 'same@example.com',
      expiresAt: new Date(Date.now() + 3600000),
      user: {
        id: 'user-1',
        email: 'same@example.com',
        isActive: true,
      },
    })

    const response = await GET(createGetRequest('valid-token'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.willUpdateEmail).toBe(false)
  })

  it('should reject invalid token', async () => {
    mockDb.emailVerificationToken.findUnique.mockResolvedValue(null)

    const response = await GET(createGetRequest('invalid-token'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid or expired verification link')
  })

  it('should reject expired token', async () => {
    mockDb.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'token-1',
      email: 'test@example.com',
      expiresAt: new Date(Date.now() - 3600000),
      user: { id: 'user-1', email: 'test@example.com', isActive: true },
    })
    mockIsTokenExpired.mockReturnValue(true)

    const response = await GET(createGetRequest('expired-token'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('This verification link has expired')
  })

  it('should reject token for inactive user', async () => {
    mockDb.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'token-1',
      email: 'test@example.com',
      expiresAt: new Date(Date.now() + 3600000),
      user: { id: 'user-1', email: 'test@example.com', isActive: false },
    })

    const response = await GET(createGetRequest('inactive-token'))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid or expired verification link')
  })

  it('should reject missing token', async () => {
    const response = await GET(createGetRequest(null))

    expect(response.status).toBe(400)
  })
})

describe('Verify Email API - Email Verification (POST)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 10, resetAt: new Date() })
    mockIsTokenExpired.mockReturnValue(false)
    mockDb.$transaction.mockResolvedValue([])
  })

  it('should verify email with valid token', async () => {
    mockDb.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'token-1',
      email: 'verified@example.com',
      expiresAt: new Date(Date.now() + 3600000),
      userId: 'user-1',
      user: { id: 'user-1', email: 'verified@example.com', isActive: true },
    })

    const response = await POST(createPostRequest({ token: 'valid-token' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toBe('Email verified successfully')
  })

  it('should update email when different', async () => {
    mockDb.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'token-1',
      email: 'new@example.com',
      expiresAt: new Date(Date.now() + 3600000),
      userId: 'user-1',
      user: { id: 'user-1', email: 'old@example.com', isActive: true },
    })
    mockDb.user.findUnique.mockResolvedValue(null) // No conflict

    const response = await POST(createPostRequest({ token: 'valid-token' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.emailUpdated).toBe(true)
    expect(data.email).toBe('new@example.com')
  })

  it('should reject if new email is already taken', async () => {
    mockDb.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'token-1',
      email: 'taken@example.com',
      expiresAt: new Date(Date.now() + 3600000),
      userId: 'user-1',
      user: { id: 'user-1', email: 'old@example.com', isActive: true },
    })
    mockDb.user.findUnique.mockResolvedValue({ id: 'user-2' }) // Different user has this email

    const response = await POST(createPostRequest({ token: 'valid-token' }))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Email address is already in use')
  })

  it('should be rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 900000),
    })

    const response = await POST(createPostRequest({ token: 'valid-token' }))

    expect(response.status).toBe(429)
  })

  it('should delete all verification tokens after success', async () => {
    mockDb.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'token-1',
      email: 'test@example.com',
      expiresAt: new Date(Date.now() + 3600000),
      userId: 'user-1',
      user: { id: 'user-1', email: 'test@example.com', isActive: true },
    })

    await POST(createPostRequest({ token: 'valid-token' }))

    // Verify the transaction was called (with an array of operations)
    expect(mockDb.$transaction).toHaveBeenCalled()
    // The transaction receives an array - verify it was called with some array
    const call = mockDb.$transaction.mock.calls[0][0]
    expect(Array.isArray(call)).toBe(true)
  })
})

describe('Verify Email API - Input Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 10, resetAt: new Date() })
  })

  it('should reject missing token', async () => {
    const response = await POST(createPostRequest({}))

    expect(response.status).toBe(400)
  })

  it('should reject empty token', async () => {
    const response = await POST(createPostRequest({ token: '' }))

    expect(response.status).toBe(400)
  })

  it('should reject array instead of string', async () => {
    const response = await POST(createPostRequest({ token: ['token1', 'token2'] }))

    expect(response.status).toBe(400)
  })

  it('should handle token with special characters safely', async () => {
    mockDb.emailVerificationToken.findUnique.mockResolvedValue(null)

    const response = await POST(createPostRequest({ token: "'; DROP TABLE tokens; --" }))

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Invalid or expired verification link')
  })
})

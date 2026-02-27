import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '../rate-limit'

// Mock the database
vi.mock('@/lib/db', () => ({
  db: {
    rateLimit: {
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'

// biome-ignore lint/suspicious/noExplicitAny: partial mock for testing
const mockDb = vi.mocked(db) as any

describe('Rate Limit Configuration', () => {
  it('should have rate limits for login', () => {
    expect(RATE_LIMITS['auth/login']).toEqual({
      limit: 10,
      windowMs: 15 * 60 * 1000,
    })
  })

  it('should have rate limits for registration', () => {
    expect(RATE_LIMITS['auth/register']).toEqual({
      limit: 5,
      windowMs: 60 * 60 * 1000,
    })
  })

  it('should have rate limits for password reset', () => {
    expect(RATE_LIMITS['auth/forgot-password']).toEqual({
      limit: 3,
      windowMs: 60 * 60 * 1000,
    })
  })

  it('should have rate limits for email verification', () => {
    expect(RATE_LIMITS['auth/verify-email']).toEqual({
      limit: 10,
      windowMs: 15 * 60 * 1000,
    })
  })

  it('should have rate limits for password change', () => {
    expect(RATE_LIMITS['me/password']).toEqual({
      limit: 5,
      windowMs: 15 * 60 * 1000,
    })
  })

  it('should have rate limits for account deletion', () => {
    expect(RATE_LIMITS['me/account/delete']).toEqual({
      limit: 3,
      windowMs: 60 * 60 * 1000,
    })
  })
})

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should allow first request and create rate limit record', async () => {
    mockDb.rateLimit.deleteMany.mockResolvedValue({ count: 0 })
    mockDb.rateLimit.findUnique.mockResolvedValue(null)
    mockDb.rateLimit.upsert.mockResolvedValue({})

    const result = await checkRateLimit('127.0.0.1', 'auth/login')

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(9) // 10 - 1
    expect(mockDb.rateLimit.upsert).toHaveBeenCalled()
  })

  it('should allow requests within limit', async () => {
    const windowStart = new Date()
    mockDb.rateLimit.deleteMany.mockResolvedValue({ count: 0 })
    mockDb.rateLimit.findUnique.mockResolvedValue({
      identifier: '127.0.0.1',
      endpoint: 'auth/login',
      count: 5,
      windowStart,
    })
    mockDb.rateLimit.update.mockResolvedValue({})

    const result = await checkRateLimit('127.0.0.1', 'auth/login')

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4) // 10 - 5 - 1
  })

  it('should deny requests exceeding limit', async () => {
    const windowStart = new Date()
    mockDb.rateLimit.deleteMany.mockResolvedValue({ count: 0 })
    mockDb.rateLimit.findUnique.mockResolvedValue({
      identifier: '127.0.0.1',
      endpoint: 'auth/login',
      count: 10, // At limit
      windowStart,
    })

    const result = await checkRateLimit('127.0.0.1', 'auth/login')

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('should reset count after window expires', async () => {
    const expiredWindowStart = new Date(Date.now() - 20 * 60 * 1000) // 20 minutes ago
    mockDb.rateLimit.deleteMany.mockResolvedValue({ count: 0 })
    mockDb.rateLimit.findUnique.mockResolvedValue({
      identifier: '127.0.0.1',
      endpoint: 'auth/login',
      count: 10, // At limit
      windowStart: expiredWindowStart, // But window expired
    })
    mockDb.rateLimit.upsert.mockResolvedValue({})

    const result = await checkRateLimit('127.0.0.1', 'auth/login')

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(9) // Reset to limit - 1
    expect(mockDb.rateLimit.upsert).toHaveBeenCalled() // Should reset
  })

  it('should use default rate limit for unknown endpoints', async () => {
    mockDb.rateLimit.deleteMany.mockResolvedValue({ count: 0 })
    mockDb.rateLimit.findUnique.mockResolvedValue(null)
    mockDb.rateLimit.upsert.mockResolvedValue({})

    const result = await checkRateLimit('127.0.0.1', 'unknown/endpoint')

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(99) // Default is 100 - 1
  })

  it('should clean up old rate limit entries', async () => {
    mockDb.rateLimit.deleteMany.mockResolvedValue({ count: 5 })
    mockDb.rateLimit.findUnique.mockResolvedValue(null)
    mockDb.rateLimit.upsert.mockResolvedValue({})

    await checkRateLimit('127.0.0.1', 'auth/login')

    expect(mockDb.rateLimit.deleteMany).toHaveBeenCalledWith({
      where: { windowStart: { lt: expect.any(Date) } },
    })
  })

  it('should return correct resetAt time', async () => {
    const windowStart = new Date()
    mockDb.rateLimit.deleteMany.mockResolvedValue({ count: 0 })
    mockDb.rateLimit.findUnique.mockResolvedValue({
      identifier: '127.0.0.1',
      endpoint: 'auth/login',
      count: 10,
      windowStart,
    })

    const result = await checkRateLimit('127.0.0.1', 'auth/login')

    expect(result.resetAt.getTime()).toBe(
      windowStart.getTime() + RATE_LIMITS['auth/login'].windowMs,
    )
  })
})

describe('getClientIp', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should use X-Forwarded-For when TRUST_PROXY is true', () => {
    process.env.TRUST_PROXY = 'true'
    const request = new Request('http://localhost', {
      headers: {
        'X-Forwarded-For': '203.0.113.50, 70.41.3.18, 150.172.238.178',
      },
    })

    const ip = getClientIp(request)

    expect(ip).toBe('203.0.113.50')
  })

  it('should use X-Real-IP when X-Forwarded-For is absent', () => {
    process.env.TRUST_PROXY = 'true'
    const request = new Request('http://localhost', {
      headers: {
        'X-Real-IP': '203.0.113.50',
      },
    })

    const ip = getClientIp(request)

    expect(ip).toBe('203.0.113.50')
  })

  it('should NOT trust proxy headers when TRUST_PROXY is false', () => {
    process.env.TRUST_PROXY = 'false'
    const request = new Request('http://localhost', {
      headers: {
        'X-Forwarded-For': '203.0.113.50',
        'User-Agent': 'TestAgent',
        'Accept-Language': 'en-US',
      },
    })

    const ip = getClientIp(request)

    expect(ip.startsWith('fingerprint:')).toBe(true)
    expect(ip).not.toBe('203.0.113.50')
  })

  it('should use fingerprint when TRUST_PROXY is not set', () => {
    delete process.env.TRUST_PROXY
    const request = new Request('http://localhost', {
      headers: {
        'User-Agent': 'TestAgent',
        'Accept-Language': 'en-US',
      },
    })

    const ip = getClientIp(request)

    expect(ip.startsWith('fingerprint:')).toBe(true)
  })

  it('should generate different fingerprints for different clients', () => {
    delete process.env.TRUST_PROXY
    const request1 = new Request('http://localhost', {
      headers: {
        'User-Agent': 'Chrome/100',
        'Accept-Language': 'en-US',
      },
    })
    const request2 = new Request('http://localhost', {
      headers: {
        'User-Agent': 'Firefox/98',
        'Accept-Language': 'de-DE',
      },
    })

    const ip1 = getClientIp(request1)
    const ip2 = getClientIp(request2)

    expect(ip1).not.toBe(ip2)
  })

  it('should generate consistent fingerprint for same client', () => {
    delete process.env.TRUST_PROXY
    const headers = {
      'User-Agent': 'TestAgent',
      'Accept-Language': 'en-US',
      'Accept-Encoding': 'gzip, deflate',
    }
    const request1 = new Request('http://localhost', { headers })
    const request2 = new Request('http://localhost', { headers })

    const ip1 = getClientIp(request1)
    const ip2 = getClientIp(request2)

    expect(ip1).toBe(ip2)
  })
})

describe('Rate Limiting Security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should track different endpoints separately', async () => {
    mockDb.rateLimit.deleteMany.mockResolvedValue({ count: 0 })
    mockDb.rateLimit.findUnique.mockResolvedValue(null)
    mockDb.rateLimit.upsert.mockResolvedValue({})

    await checkRateLimit('127.0.0.1', 'auth/login')
    await checkRateLimit('127.0.0.1', 'auth/register')

    // Should have created two separate records
    expect(mockDb.rateLimit.upsert).toHaveBeenCalledTimes(2)
    expect(mockDb.rateLimit.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { identifier_endpoint: { identifier: '127.0.0.1', endpoint: 'auth/login' } },
      }),
    )
    expect(mockDb.rateLimit.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { identifier_endpoint: { identifier: '127.0.0.1', endpoint: 'auth/register' } },
      }),
    )
  })

  it('should track different identifiers separately', async () => {
    mockDb.rateLimit.deleteMany.mockResolvedValue({ count: 0 })
    mockDb.rateLimit.findUnique.mockResolvedValue(null)
    mockDb.rateLimit.upsert.mockResolvedValue({})

    await checkRateLimit('127.0.0.1', 'auth/login')
    await checkRateLimit('192.168.1.1', 'auth/login')

    expect(mockDb.rateLimit.upsert).toHaveBeenCalledTimes(2)
  })

  it('should increment count atomically', async () => {
    const windowStart = new Date()
    mockDb.rateLimit.deleteMany.mockResolvedValue({ count: 0 })
    mockDb.rateLimit.findUnique.mockResolvedValue({
      identifier: '127.0.0.1',
      endpoint: 'auth/login',
      count: 5,
      windowStart,
    })
    mockDb.rateLimit.update.mockResolvedValue({})

    await checkRateLimit('127.0.0.1', 'auth/login')

    expect(mockDb.rateLimit.update).toHaveBeenCalledWith({
      where: { identifier_endpoint: { identifier: '127.0.0.1', endpoint: 'auth/login' } },
      data: { count: { increment: 1 } },
    })
  })
})

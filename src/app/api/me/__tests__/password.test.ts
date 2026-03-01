import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PATCH } from '../password/route'

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, resetAt: new Date() }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('new_hashed_password'),
  verifyPassword: vi.fn().mockResolvedValue(true),
  validatePasswordStrength: vi.fn().mockReturnValue({ valid: true, errors: [] }),
}))

vi.mock('@/lib/demo/demo-config', () => ({
  isDemoMode: vi.fn().mockReturnValue(false),
}))

vi.mock('@/lib/totp', () => ({
  decryptTotpSecret: vi.fn(),
  verifyTotpToken: vi.fn(),
  verifyRecoveryCode: vi.fn(),
  markRecoveryCodeUsed: vi.fn(),
}))

import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/demo/demo-config'
import { validatePasswordStrength, verifyPassword } from '@/lib/password'
import { checkRateLimit } from '@/lib/rate-limit'

// biome-ignore lint/suspicious/noExplicitAny: partial mock for testing
const mockDb = vi.mocked(db) as any
const mockRequireAuth = vi.mocked(requireAuth)
const mockCheckRateLimit = vi.mocked(checkRateLimit)
const mockVerifyPassword = vi.mocked(verifyPassword)
const mockValidatePassword = vi.mocked(validatePasswordStrength)
const mockIsDemoMode = vi.mocked(isDemoMode)

function createRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/me/password', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('Password Change API - Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsDemoMode.mockReturnValue(false)
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 10, resetAt: new Date() })
  })

  it('should require authentication', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))

    const response = await PATCH(
      createRequest({
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
      }),
    )

    expect(response.status).toBe(401)
  })

  it('should reject disabled accounts', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Account disabled'))

    const response = await PATCH(
      createRequest({
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
      }),
    )

    expect(response.status).toBe(403)
  })
})

describe('Password Change API - Current Password Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsDemoMode.mockReturnValue(false)
    mockRequireAuth.mockResolvedValue({
      id: 'user-1',
      username: 'testuser',
      email: null,
      name: 'Test User',
      avatar: null,
      isSystemAdmin: false,
      isActive: true,
    })
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 10, resetAt: new Date() })
    mockDb.user.findUnique.mockResolvedValue({ passwordHash: 'current_hash' })
    mockValidatePassword.mockReturnValue({ valid: true, errors: [] })
  })

  it('should verify current password', async () => {
    mockVerifyPassword.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    mockDb.user.update.mockResolvedValue({})

    const response = await PATCH(
      createRequest({
        currentPassword: 'CorrectPassword123!',
        newPassword: 'NewPassword123!',
      }),
    )

    expect(response.status).toBe(200)
    expect(mockVerifyPassword).toHaveBeenCalledWith('CorrectPassword123!', 'current_hash')
  })

  it('should reject new password that matches current password', async () => {
    mockVerifyPassword.mockResolvedValue(true)
    mockDb.user.findUnique.mockResolvedValue({ passwordHash: 'current_hash' })

    const response = await PATCH(
      createRequest({
        currentPassword: 'SamePassword123!',
        newPassword: 'SamePassword123!',
      }),
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('New password must be different from your current password')
  })

  it('should reject incorrect current password', async () => {
    mockVerifyPassword.mockResolvedValue(false)

    const response = await PATCH(
      createRequest({
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewPassword123!',
      }),
    )
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Invalid password')
  })

  it('should reject if user has no password hash', async () => {
    mockDb.user.findUnique.mockResolvedValue({ passwordHash: null })

    const response = await PATCH(
      createRequest({
        currentPassword: 'Password123!',
        newPassword: 'NewPassword123!',
      }),
    )
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Invalid credentials')
  })
})

describe('Password Change API - Password Strength Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsDemoMode.mockReturnValue(false)
    mockRequireAuth.mockResolvedValue({
      id: 'user-1',
      username: 'testuser',
      email: null,
      name: 'Test User',
      avatar: null,
      isSystemAdmin: false,
      isActive: true,
    })
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 10, resetAt: new Date() })
    mockDb.user.findUnique.mockResolvedValue({ passwordHash: 'current_hash' })
    // First call: auth (true), second call: same-password check (false = different password)
    mockVerifyPassword.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
  })

  it('should reject weak password', async () => {
    mockValidatePassword.mockReturnValue({
      valid: false,
      errors: ['Password must be at least 12 characters long'],
    })

    const response = await PATCH(
      createRequest({
        currentPassword: 'CurrentPassword123!',
        newPassword: 'weak',
      }),
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Password does not meet requirements')
    expect(data.details).toContain('Password must be at least 12 characters long')
  })

  it('should reject password without uppercase', async () => {
    mockValidatePassword.mockReturnValue({
      valid: false,
      errors: ['Password must contain at least one uppercase letter'],
    })

    const response = await PATCH(
      createRequest({
        currentPassword: 'CurrentPassword123!',
        newPassword: 'newpassword123!',
      }),
    )

    expect(response.status).toBe(400)
  })

  it('should accept strong password', async () => {
    mockValidatePassword.mockReturnValue({ valid: true, errors: [] })
    mockDb.user.update.mockResolvedValue({})

    const response = await PATCH(
      createRequest({
        currentPassword: 'CurrentPassword123!',
        newPassword: 'StrongPassword123!',
      }),
    )

    expect(response.status).toBe(200)
  })
})

describe('Password Change API - Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsDemoMode.mockReturnValue(false)
    mockRequireAuth.mockResolvedValue({
      id: 'user-1',
      username: 'testuser',
      email: null,
      name: 'Test User',
      avatar: null,
      isSystemAdmin: false,
      isActive: true,
    })
  })

  it('should rate limit password change attempts', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 900000),
    })

    const response = await PATCH(
      createRequest({
        currentPassword: 'Password123!',
        newPassword: 'NewPassword123!',
      }),
    )

    expect(response.status).toBe(429)
    const data = await response.json()
    expect(data.error).toContain('Too many requests')
  })

  it('should include rate limit headers on 429', async () => {
    const resetAt = new Date(Date.now() + 900000)
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt,
    })

    const response = await PATCH(
      createRequest({
        currentPassword: 'Password123!',
        newPassword: 'NewPassword123!',
      }),
    )

    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(response.headers.get('X-RateLimit-Reset')).toBe(resetAt.toISOString())
  })
})

describe('Password Change API - Session Invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsDemoMode.mockReturnValue(false)
    mockRequireAuth.mockResolvedValue({
      id: 'user-1',
      username: 'testuser',
      email: null,
      name: 'Test User',
      avatar: null,
      isSystemAdmin: false,
      isActive: true,
    })
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 10, resetAt: new Date() })
    mockDb.user.findUnique.mockResolvedValue({ passwordHash: 'current_hash' })
    // First call: auth (true), second call: same-password check (false = different password)
    mockVerifyPassword.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    mockValidatePassword.mockReturnValue({ valid: true, errors: [] })
  })

  it('should update passwordChangedAt to invalidate sessions', async () => {
    mockDb.user.update.mockResolvedValue({})

    await PATCH(
      createRequest({
        currentPassword: 'CurrentPassword123!',
        newPassword: 'NewPassword123!',
      }),
    )

    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        passwordChangedAt: expect.any(Date),
      }),
    })
  })
})

describe('Password Change API - Input Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsDemoMode.mockReturnValue(false)
    mockRequireAuth.mockResolvedValue({
      id: 'user-1',
      username: 'testuser',
      email: null,
      name: 'Test User',
      avatar: null,
      isSystemAdmin: false,
      isActive: true,
    })
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 10, resetAt: new Date() })
  })

  it('should reject missing currentPassword', async () => {
    const response = await PATCH(createRequest({ newPassword: 'NewPassword123!' }))

    expect(response.status).toBe(400)
  })

  it('should reject missing newPassword', async () => {
    const response = await PATCH(createRequest({ currentPassword: 'CurrentPassword123!' }))

    expect(response.status).toBe(400)
  })

  it('should reject empty currentPassword', async () => {
    const response = await PATCH(
      createRequest({
        currentPassword: '',
        newPassword: 'NewPassword123!',
      }),
    )

    expect(response.status).toBe(400)
  })

  it('should reject empty newPassword', async () => {
    const response = await PATCH(
      createRequest({
        currentPassword: 'CurrentPassword123!',
        newPassword: '',
      }),
    )

    expect(response.status).toBe(400)
  })
})

describe('Password Change API - Demo Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsDemoMode.mockReturnValue(true)
  })

  it('should return success in demo mode', async () => {
    mockValidatePassword.mockReturnValue({ valid: true, errors: [] })

    const response = await PATCH(
      createRequest({
        currentPassword: 'CurrentPassword123!',
        newPassword: 'NewPassword123!',
      }),
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toContain('demo mode')
  })

  it('should still validate password strength in demo mode', async () => {
    mockValidatePassword.mockReturnValue({
      valid: false,
      errors: ['Password too weak'],
    })

    const response = await PATCH(
      createRequest({
        currentPassword: 'CurrentPassword123!',
        newPassword: 'weak',
      }),
    )

    expect(response.status).toBe(400)
  })
})

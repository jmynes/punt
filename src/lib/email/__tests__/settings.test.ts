import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import {
  getAppName,
  getAppUrl,
  getEmailSettings,
  isEmailEnabled,
  isEmailFeatureEnabled,
} from '../settings'

vi.mock('@/lib/db', () => ({
  db: { systemSettings: { upsert: vi.fn() } },
}))

const mockUpsert = vi.mocked(db.systemSettings.upsert)

function settings(overrides: Record<string, unknown> = {}) {
  return {
    id: 'system-settings',
    emailEnabled: true,
    emailProvider: 'smtp',
    emailFromAddress: 'from@x.com',
    emailFromName: 'Sender',
    smtpHost: 'smtp.x.com',
    smtpPort: 587,
    smtpUsername: 'user',
    smtpSecure: true,
    emailPasswordReset: true,
    emailWelcome: false,
    emailVerification: false,
    emailInvitations: true,
    ...overrides,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('getEmailSettings', () => {
  it('maps stored settings through', async () => {
    mockUpsert.mockResolvedValue(settings() as never)
    const result = await getEmailSettings()
    expect(result.emailProvider).toBe('smtp')
    expect(result.emailFromAddress).toBe('from@x.com')
  })

  it('falls back to defaults for an invalid provider and blank fields', async () => {
    mockUpsert.mockResolvedValue(
      settings({ emailProvider: 'bogus', emailFromName: '', smtpHost: '' }) as never,
    )
    const result = await getEmailSettings()
    expect(result.emailProvider).toBe('none')
    expect(result.emailFromName).toBe('PUNT')
    expect(result.smtpHost).toBe('')
  })
})

describe('isEmailEnabled', () => {
  it('is true only when enabled and a provider is set', async () => {
    mockUpsert.mockResolvedValue(settings() as never)
    expect(await isEmailEnabled()).toBe(true)

    mockUpsert.mockResolvedValue(settings({ emailProvider: 'none' }) as never)
    expect(await isEmailEnabled()).toBe(false)

    mockUpsert.mockResolvedValue(settings({ emailEnabled: false }) as never)
    expect(await isEmailEnabled()).toBe(false)
  })
})

describe('isEmailFeatureEnabled', () => {
  it('returns false when email is disabled overall', async () => {
    mockUpsert.mockResolvedValue(settings({ emailEnabled: false }) as never)
    expect(await isEmailFeatureEnabled('passwordReset')).toBe(false)
  })

  it('reflects the per-feature flags', async () => {
    mockUpsert.mockResolvedValue(
      settings({ emailPasswordReset: true, emailWelcome: false, emailInvitations: true }) as never,
    )
    expect(await isEmailFeatureEnabled('passwordReset')).toBe(true)
    expect(await isEmailFeatureEnabled('welcome')).toBe(false)
    expect(await isEmailFeatureEnabled('invitations')).toBe(true)
    expect(await isEmailFeatureEnabled('verification')).toBe(false)
  })
})

describe('environment helpers', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('getAppUrl combines base URL and basePath', () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://app.example.com')
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/punt')
    expect(getAppUrl()).toBe('https://app.example.com/punt')
  })

  it('getAppUrl falls back to localhost', () => {
    vi.stubEnv('NEXTAUTH_URL', '')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '')
    expect(getAppUrl()).toBe('http://localhost:3000')
  })

  it('getAppName uses the env override or default', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_NAME', 'MyTracker')
    expect(getAppName()).toBe('MyTracker')
    vi.stubEnv('NEXT_PUBLIC_APP_NAME', '')
    expect(getAppName()).toBe('PUNT')
  })
})

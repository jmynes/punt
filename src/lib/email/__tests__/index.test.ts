import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import {
  isEmailConfigured,
  renderTemplate,
  sendEmail,
  sendPasswordResetEmail,
  sendTestEmail,
  sendVerificationEmail,
} from '../index'

vi.mock('@/lib/db', () => ({ db: { systemSettings: { upsert: vi.fn() } } }))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockUpsert = vi.mocked(db.systemSettings.upsert)

function settings(overrides: Record<string, unknown> = {}) {
  return {
    id: 'system-settings',
    emailEnabled: true,
    emailProvider: 'console',
    emailFromAddress: 'from@x.com',
    emailFromName: 'Sender',
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
    smtpSecure: true,
    emailPasswordReset: true,
    emailWelcome: false,
    emailVerification: true,
    emailInvitations: true,
    ...overrides,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('sendEmail', () => {
  const message = { to: 'a@b.com', subject: 'Hi', html: '<p>hi</p>' }

  it('sends via the configured provider (console) and reports success', async () => {
    mockUpsert.mockResolvedValue(settings() as never)
    expect(await sendEmail(message)).toEqual({ success: true })
  })

  it('returns an error when email is disabled', async () => {
    mockUpsert.mockResolvedValue(settings({ emailEnabled: false }) as never)
    expect(await sendEmail(message)).toEqual({ success: false, error: 'Email is disabled' })
  })

  it('returns an error when the provider is not configured', async () => {
    // smtp without EMAIL_SMTP_PASSWORD is not configured
    mockUpsert.mockResolvedValue(settings({ emailProvider: 'smtp', smtpHost: 'h' }) as never)
    const result = await sendEmail(message)
    expect(result.success).toBe(false)
    expect(result.error).toContain('not configured')
  })
})

describe('isEmailConfigured', () => {
  it('is false when disabled or provider is none', async () => {
    mockUpsert.mockResolvedValue(settings({ emailProvider: 'none' }) as never)
    expect(await isEmailConfigured()).toBe(false)
  })

  it('is true for a configured console provider', async () => {
    mockUpsert.mockResolvedValue(settings() as never)
    expect(await isEmailConfigured()).toBe(true)
  })
})

describe('renderTemplate', () => {
  it('renders a React Email template to an HTML string', async () => {
    const { TestEmail } = await import('../templates/test-email')
    const html = await renderTemplate(
      TestEmail({ recipientEmail: 'a@b.com', appName: 'PUNT', appUrl: 'http://x' }),
    )
    expect(typeof html).toBe('string')
    expect(html.length).toBeGreaterThan(0)
  })
})

describe('templated senders respect their feature flags', () => {
  it('sendPasswordResetEmail is gated by emailPasswordReset', async () => {
    mockUpsert.mockResolvedValue(settings({ emailPasswordReset: false }) as never)
    const off = await sendPasswordResetEmail('a@b.com', { resetUrl: 'http://x', userName: 'A' })
    expect(off).toEqual({ success: false, error: 'Password reset emails are disabled' })

    mockUpsert.mockResolvedValue(settings({ emailPasswordReset: true }) as never)
    const on = await sendPasswordResetEmail('a@b.com', { resetUrl: 'http://x', userName: 'A' })
    expect(on.success).toBe(true)
  })

  it('sendVerificationEmail is gated by emailVerification', async () => {
    mockUpsert.mockResolvedValue(settings({ emailVerification: false }) as never)
    const off = await sendVerificationEmail('a@b.com', {
      verificationUrl: 'http://x',
      userName: 'A',
    })
    expect(off).toEqual({ success: false, error: 'Email verification is disabled' })
  })

  it('sendTestEmail renders and sends regardless of feature flags', async () => {
    mockUpsert.mockResolvedValue(settings() as never)
    expect((await sendTestEmail('a@b.com')).success).toBe(true)
  })
})

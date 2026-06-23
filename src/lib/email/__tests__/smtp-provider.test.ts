import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SmtpProvider } from '../providers/smtp-provider'
import type { EmailSettings } from '../types'

const sendMail = vi.fn()
const verify = vi.fn()
const createTransport = vi.fn(() => ({ sendMail, verify }))

vi.mock('nodemailer', () => ({
  default: { createTransport: (...a: unknown[]) => createTransport(...a) },
}))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }))

function settings(overrides: Partial<EmailSettings> = {}): EmailSettings {
  return {
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

const message = { to: 'a@b.com', subject: 'Hi', html: '<p>hi</p>' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('EMAIL_SMTP_PASSWORD', 'secret')
})
afterEach(() => vi.unstubAllEnvs())

describe('SmtpProvider configuration', () => {
  it('is configured with host, from address, and a password', () => {
    expect(new SmtpProvider(settings()).isConfigured()).toBe(true)
  })

  it('is not configured without a password', () => {
    vi.stubEnv('EMAIL_SMTP_PASSWORD', '')
    expect(new SmtpProvider(settings()).isConfigured()).toBe(false)
  })

  it('does not build a transporter without host or password', () => {
    vi.stubEnv('EMAIL_SMTP_PASSWORD', '')
    new SmtpProvider(settings())
    expect(createTransport).not.toHaveBeenCalled()
  })
})

describe('SmtpProvider.send', () => {
  it('sends and returns true on success', async () => {
    sendMail.mockResolvedValue({ messageId: 'mid-1' })
    const result = await new SmtpProvider(settings()).send(message)
    expect(result).toBe(true)
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@b.com', subject: 'Hi', from: '"Sender" <from@x.com>' }),
    )
  })

  it('returns false when the transporter is not configured', async () => {
    vi.stubEnv('EMAIL_SMTP_PASSWORD', '')
    expect(await new SmtpProvider(settings()).send(message)).toBe(false)
  })

  it('returns false when sendMail throws', async () => {
    sendMail.mockRejectedValue(new Error('smtp down'))
    expect(await new SmtpProvider(settings()).send(message)).toBe(false)
  })
})

describe('SmtpProvider.verify', () => {
  it('returns success when the transporter verifies', async () => {
    verify.mockResolvedValue(true)
    expect(await new SmtpProvider(settings()).verify()).toEqual({ success: true })
  })

  it('returns an error when verification fails', async () => {
    verify.mockRejectedValue(new Error('bad creds'))
    expect(await new SmtpProvider(settings()).verify()).toEqual({
      success: false,
      error: 'bad creds',
    })
  })

  it('returns not-configured when there is no transporter', async () => {
    vi.stubEnv('EMAIL_SMTP_PASSWORD', '')
    expect(await new SmtpProvider(settings()).verify()).toEqual({
      success: false,
      error: 'SMTP not configured',
    })
  })
})

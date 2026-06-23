import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResendProvider } from '../providers/resend-provider'
import type { EmailSettings } from '../types'

const send = vi.fn()
const ResendCtor = vi.fn()

vi.mock('resend', () => ({
  Resend: class {
    emails = { send }
    constructor(...args: unknown[]) {
      ResendCtor(...args)
    }
  },
}))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }))

function settings(overrides: Partial<EmailSettings> = {}): EmailSettings {
  return {
    emailEnabled: true,
    emailProvider: 'resend',
    emailFromAddress: 'from@x.com',
    emailFromName: 'Sender',
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
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
  vi.stubEnv('EMAIL_RESEND_API_KEY', 'key-123')
})
afterEach(() => vi.unstubAllEnvs())

describe('ResendProvider configuration', () => {
  it('is configured with an API key and from address', () => {
    expect(new ResendProvider(settings()).isConfigured()).toBe(true)
  })

  it('is not configured without an API key', () => {
    vi.stubEnv('EMAIL_RESEND_API_KEY', '')
    expect(new ResendProvider(settings()).isConfigured()).toBe(false)
  })
})

describe('ResendProvider.send', () => {
  it('sends and returns true on success', async () => {
    send.mockResolvedValue({ data: { id: 'rid-1' }, error: null })
    const result = await new ResendProvider(settings()).send(message)
    expect(result).toBe(true)
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['a@b.com'], from: '"Sender" <from@x.com>' }),
    )
  })

  it('returns false when the client is not configured', async () => {
    vi.stubEnv('EMAIL_RESEND_API_KEY', '')
    expect(await new ResendProvider(settings()).send(message)).toBe(false)
  })

  it('returns false when the Resend API returns an error', async () => {
    send.mockResolvedValue({ data: null, error: { message: 'rejected' } })
    expect(await new ResendProvider(settings()).send(message)).toBe(false)
  })

  it('returns false when send throws', async () => {
    send.mockRejectedValue(new Error('network'))
    expect(await new ResendProvider(settings()).send(message)).toBe(false)
  })
})
